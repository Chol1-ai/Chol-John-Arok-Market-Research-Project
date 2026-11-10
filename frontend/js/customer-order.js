(function () {
  'use strict';

  const OUTLET_LABEL = {
    FOODIZO_HAM_TOWERS: 'Foodizo · Ham Towers',
    OBUNUZI_YMCA: 'Obunuzi · Opposite YMCA'
  };
  const STATUS_COPY = {
    AWAITING_PAYMENT: 'Order received. Show this token and pay cash at the counter. Preparation starts after staff records payment.',
    PENDING: 'Your order is queued for the kitchen.',
    PREPARING: 'The kitchen is preparing your order.',
    READY: 'Your order is ready for pickup at the counter.',
    COMPLETED: 'This order has been collected. Thank you!',
    CANCELLED: 'This order was cancelled. Please speak with staff if you need help.'
  };
  const state = {
    outlet: 'FOODIZO_HAM_TOWERS',
    channel: 'TAKEAWAY_PICKUP',
    menu: [],
    zones: [],
    selectedZone: null,
    category: 'ALL',
    cart: new Map(),
    token: null,
    pollTimer: null
  };
  const elements = {
    notice: document.getElementById('notice'),
    orderScreen: document.getElementById('order-screen'),
    trackingScreen: document.getElementById('tracking-screen'),
    outlet: document.getElementById('outlet'),
    fulfillment: document.getElementById('fulfillment'),
    deliveryFields: document.getElementById('delivery-fields'),
    deliveryZone: document.getElementById('delivery-zone'),
    deliveryNote: document.getElementById('delivery-note'),
    deliveryZoneHint: document.getElementById('delivery-zone-hint'),
    deliveryFeeRow: document.getElementById('delivery-fee-row'),
    deliveryFee: document.getElementById('delivery-fee'),
    paymentNoteTitle: document.getElementById('payment-note-title'),
    paymentNoteCopy: document.getElementById('payment-note-copy'),
    search: document.getElementById('search'),
    categories: document.getElementById('categories'),
    menu: document.getElementById('menu'),
    cartLines: document.getElementById('cart-lines'),
    cartCount: document.getElementById('cart-count'),
    cartTotal: document.getElementById('cart-total'),
    checkoutForm: document.getElementById('checkout-form'),
    submitOrder: document.getElementById('submit-order'),
    trackingCopy: document.getElementById('tracking-copy'),
    trackingToken: document.getElementById('tracking-token'),
    trackingOrder: document.getElementById('tracking-order'),
    trackingStatus: document.getElementById('tracking-status'),
    trackingCashNote: document.getElementById('tracking-cash-note')
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function formatUgx(value) {
    return `UGX ${Number(value || 0).toLocaleString('en-UG')}`;
  }

  function defaultMealImage(item) {
    const name = item.name.toLowerCase();
    if (name.includes('water')) return '/images/foodizo-bottled-water.jpg';
    if (name.includes('juice')) return '/images/foodizo-juice.jpg';
    if (name.includes('chicken') && name.includes('chips')) return '/images/foodizo-chicken-chips.jpg';
    if (name.includes('chips')) return '/images/foodizo-plain-chips.jpg';
    if (name.includes('matooke')) return '/images/foodizo-matooke.jpg';
    if (name.includes('rice') && name.includes('beans')) return '/images/foodizo-rice-beans.jpg';
    if (name.includes('luwombo') || name.includes('tilapia') || name.includes('fish')) {
      return '/images/foodizo-luwombo.jpg';
    }
    if (name.includes('rolex')) return '/images/foodizo-rolex.jpg';
    return null;
  }

  async function request(path, options) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options && options.body ? { 'Content-Type': 'application/json' } : {}),
        ...((options && options.headers) || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `Request failed (${response.status}).`);
      error.code = data.code;
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function showNotice(message) {
    elements.notice.textContent = message;
    elements.notice.hidden = false;
  }

  function hideNotice() {
    elements.notice.hidden = true;
    elements.notice.textContent = '';
  }

  async function loadMenu() {
    elements.menu.innerHTML = '<div class="customer-empty">Loading today’s menu…</div>';
    const data = await request(`/api/v1/menu-items?outlet=${encodeURIComponent(state.outlet)}`);
    state.menu = (data.items || []).filter((item) => item.isActive && item.isAvailable);
    state.cart.clear();
    state.category = 'ALL';
    renderCategories();
    renderMenu();
    renderCart();
  }

  async function loadZones() {
    const data = await request(`/api/v1/orders/delivery-zones?outlet=${encodeURIComponent(state.outlet)}`);
    state.zones = data.zones || [];
    state.selectedZone = null;
    elements.deliveryZone.innerHTML = '<option value="">Choose your delivery area</option>' +
      state.zones.map((zone) =>
        `<option value="${escapeHtml(zone.id)}">${escapeHtml(zone.name)} · ${formatUgx(zone.feeUgx)}</option>`
      ).join('');
    elements.deliveryZone.disabled = state.zones.length === 0;
    elements.deliveryZoneHint.textContent = state.zones.length
      ? 'Choose an area to see the delivery fee and estimated time.'
      : 'No delivery areas are currently available at this outlet.';
    renderCart();
  }

  function updateFulfillment() {
    state.channel = elements.fulfillment.value;
    const isDelivery = state.channel === 'PHONE_DELIVERY';
    document.title = isDelivery ? 'Order for delivery | Foodizo & Obunuzi' : 'Order for pickup | Foodizo & Obunuzi';
    elements.deliveryFields.hidden = !isDelivery;
    elements.deliveryZone.required = isDelivery;
    elements.deliveryNote.required = isDelivery;
    elements.deliveryFeeRow.hidden = !isDelivery;
    elements.paymentNoteTitle.textContent = isDelivery
      ? 'Cash on delivery'
      : 'Cash at the outlet counter';
    elements.paymentNoteCopy.textContent = isDelivery
      ? 'Pay the full amount, including the delivery fee, to the rider at handoff. The kitchen starts preparing your order right away.'
      : 'Show your pickup token and pay the full amount. Kitchen preparation starts after staff records your payment.';
    elements.submitOrder.textContent = isDelivery ? 'Place delivery order' : 'Place pickup order';
    renderCart();
  }

  function selectedDeliveryFee() {
    return state.channel === 'PHONE_DELIVERY' && state.selectedZone
      ? Number(state.selectedZone.feeUgx)
      : 0;
  }

  function renderCategories() {
    const categories = ['ALL', ...new Set(state.menu.map((item) => item.category).filter(Boolean))];
    if (!categories.includes(state.category)) state.category = 'ALL';
    elements.categories.innerHTML = categories.map((category) => `
      <button class="customer-category" type="button" data-category="${escapeHtml(category)}"
        aria-pressed="${state.category === category}">${escapeHtml(category === 'ALL' ? 'All meals' : category)}</button>
    `).join('');
  }

  function renderMenu() {
    const query = elements.search.value.trim().toLowerCase();
    const items = state.menu.filter((item) =>
      (state.category === 'ALL' || item.category === state.category) &&
      (!query || `${item.name} ${item.category}`.toLowerCase().includes(query))
    );
    if (!items.length) {
      elements.menu.innerHTML = '<div class="customer-empty">No available meals match. Try another category or outlet.</div>';
      return;
    }
    elements.menu.innerHTML = items.map((item) => {
      const uploadedImage = typeof item.imageUrl === 'string' &&
        item.imageUrl.startsWith('/api/v1/menu-items/images/')
        ? item.imageUrl
        : null;
      const fallbackImage = item.hideOriginalImage ? null : defaultMealImage(item);
      const image = uploadedImage || fallbackImage
        ? `<img src="${escapeHtml(uploadedImage || fallbackImage)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
        : escapeHtml(item.name.slice(0, 1).toUpperCase());
      return `
        <article class="customer-meal">
          <div class="customer-meal-photo">${image}</div>
          <div class="customer-meal-info">
            <h3>${escapeHtml(item.name)}</h3>
            <span class="customer-meal-category">${escapeHtml(item.category)}</span>
            <div class="customer-meal-bottom">
              <span class="customer-meal-price">${formatUgx(item.priceUgx)}</span>
              <button class="customer-add" type="button" data-add-id="${escapeHtml(item.id)}"
                aria-label="Add ${escapeHtml(item.name)}">+</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
    elements.menu.querySelectorAll('.customer-meal-photo img').forEach((image) => {
      image.addEventListener('error', () => {
        const item = items.find((row) => row.name === image.alt);
        const fallbackImage = item && !item.hideOriginalImage ? defaultMealImage(item) : null;
        if (fallbackImage && image.src !== new URL(fallbackImage, location.href).href) {
          image.src = fallbackImage;
          return;
        }
        image.parentElement.textContent = image.alt.slice(0, 1).toUpperCase();
      }, { once: true });
    });
  }

  function renderCart() {
    const lines = Array.from(state.cart.entries()).map(([id, quantity]) => {
      const item = state.menu.find((row) => row.id === id);
      return item ? { item, quantity } : null;
    }).filter(Boolean);
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce((sum, line) => sum + line.item.priceUgx * line.quantity, 0);
    const deliveryFee = selectedDeliveryFee();
    const total = subtotal + deliveryFee;
    elements.cartCount.textContent = String(count);
    elements.cartTotal.textContent = formatUgx(total);
    elements.deliveryFee.textContent = formatUgx(deliveryFee);
    elements.submitOrder.disabled = !lines.length ||
      (state.channel === 'PHONE_DELIVERY' && (!state.selectedZone || !state.zones.length));
    elements.cartLines.innerHTML = lines.length ? lines.map(({ item, quantity }) => `
      <div class="customer-cart-line">
        <span class="customer-cart-line-name">${escapeHtml(item.name)}</span>
        <span class="customer-cart-qty">
          <button class="customer-qty-button" type="button" data-cart-change="-1" data-id="${escapeHtml(item.id)}" aria-label="Remove one ${escapeHtml(item.name)}">−</button>
          <strong>${quantity}</strong>
          <button class="customer-qty-button" type="button" data-cart-change="1" data-id="${escapeHtml(item.id)}" aria-label="Add one ${escapeHtml(item.name)}">+</button>
        </span>
      </div>
    `).join('') : '<p class="customer-empty">Your bag is empty.</p>';
  }

  function changeQuantity(itemId, delta) {
    const next = (state.cart.get(itemId) || 0) + delta;
    if (next <= 0) state.cart.delete(itemId);
    else state.cart.set(itemId, next);
    renderCart();
  }

  async function submitOrder(event) {
    event.preventDefault();
    hideNotice();
    const lines = Array.from(state.cart.entries()).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
    if (!lines.length) return;

    const formData = new FormData(elements.checkoutForm);
    elements.submitOrder.disabled = true;
    elements.submitOrder.textContent = 'Placing order…';
    try {
      const data = await request('/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify({
          outlet: state.outlet,
          channel: state.channel,
          customerName: String(formData.get('customerName') || '').trim(),
          customerPhone: String(formData.get('customerPhone') || '').trim(),
          ...(state.channel === 'PHONE_DELIVERY' ? {
            deliveryZoneId: state.selectedZone && state.selectedZone.id,
            deliveryAddressNote: elements.deliveryNote.value.trim()
          } : {}),
          items: lines
        })
      });
      if (!data.order || !data.order.tokenNumber) {
        throw new Error('The order was accepted but no pickup token was returned. Please ask staff for help.');
      }
      state.token = data.order.tokenNumber;
      history.replaceState(null, '', `/order?token=${encodeURIComponent(state.token)}&outlet=${encodeURIComponent(state.outlet)}`);
      showTrackingScreen();
      await refreshTracking();
    } catch (error) {
      showNotice(error.message || 'Could not place your order. Please try again.');
      if (error.code === 'MENU_ITEM_UNAVAILABLE' || error.code === 'INSUFFICIENT_INGREDIENT_STOCK') {
        try { await loadMenu(); } catch (refreshError) { showNotice(`${error.message} Menu refresh failed: ${refreshError.message}`); }
      }
    } finally {
      elements.submitOrder.textContent = state.channel === 'PHONE_DELIVERY'
        ? 'Place delivery order'
        : 'Place pickup order';
      renderCart();
    }
  }

  function showTrackingScreen() {
    elements.orderScreen.hidden = true;
    elements.trackingScreen.hidden = false;
    elements.trackingCopy.textContent = state.channel === 'PHONE_DELIVERY'
      ? `Delivery from ${OUTLET_LABEL[state.outlet] || state.outlet}. Pay cash to the rider at handoff.`
      : `Pickup from ${OUTLET_LABEL[state.outlet] || state.outlet}.`;
    elements.trackingToken.textContent = state.token || '—';
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(() => refreshTracking().catch((error) => showNotice(error.message)), 10000);
  }

  async function refreshTracking() {
    if (!state.token) return;
    hideNotice();
    const path = `/api/v1/orders/token/${encodeURIComponent(state.token)}?outlet=${encodeURIComponent(state.outlet)}`;
    const data = await request(path);
    elements.trackingToken.textContent = data.displayToken || state.token;
    elements.trackingOrder.textContent = `${data.orderNumber} · ${OUTLET_LABEL[data.outlet] || data.outlet}`;
    state.channel = data.channel;
    state.outlet = data.outlet;
    const isDelivery = data.channel === 'PHONE_DELIVERY';
    document.title = isDelivery ? 'Delivery order status | Foodizo & Obunuzi' : 'Pickup order status | Foodizo & Obunuzi';
    document.getElementById('tracking-channel-label').textContent = isDelivery ? 'Delivery order status' : 'Pickup order status';
    document.getElementById('tracking-token-label').textContent = isDelivery ? 'Delivery token' : 'Pickup token';
    elements.trackingCopy.textContent = data.channel === 'PHONE_DELIVERY'
      ? `Delivery from ${OUTLET_LABEL[data.outlet] || data.outlet}. Pay cash to the rider at handoff.`
      : `Pickup from ${OUTLET_LABEL[data.outlet] || data.outlet}.`;
    elements.trackingStatus.textContent = isDelivery
      ? {
          PENDING: 'Your order is queued for the kitchen. The rider will collect cash on delivery.',
          READY: 'Your order is ready for rider dispatch.',
          COMPLETED: 'This order was delivered. Thank you!'
        }[data.status] || STATUS_COPY[data.status] || `Order status: ${data.status}`
      : STATUS_COPY[data.status] || `Order status: ${data.status}`;
    elements.trackingCashNote.textContent = data.channel === 'PHONE_DELIVERY'
      ? `Delivery destination: ${data.destination || 'selected area'}. Pay the order total, including the delivery fee, to the rider at handoff.`
      : data.status === 'AWAITING_PAYMENT'
        ? 'This order is not in the kitchen yet. Pay cash at the counter before preparation begins.'
        : 'Your pickup token is linked to this live order status.';
    if (data.status === 'CANCELLED' || data.status === 'COMPLETED') {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function startNewOrder() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.token = null;
    history.replaceState(null, '', '/order');
    elements.trackingScreen.hidden = true;
    elements.orderScreen.hidden = false;
    elements.checkoutForm.reset();
    state.cart.clear();
    updateFulfillment();
  }

  function wireEvents() {
    elements.outlet.addEventListener('change', async () => {
      state.outlet = elements.outlet.value;
      hideNotice();
      try { await Promise.all([loadMenu(), loadZones()]); } catch (error) { showNotice(error.message); }
    });
    elements.fulfillment.addEventListener('change', updateFulfillment);
    elements.deliveryZone.addEventListener('change', () => {
      state.selectedZone = state.zones.find((zone) => zone.id === elements.deliveryZone.value) || null;
      elements.deliveryZoneHint.textContent = state.selectedZone
        ? `${state.selectedZone.landmarkHint || state.selectedZone.landmarkGroup} · ${state.selectedZone.etaMinMinutes}–${state.selectedZone.etaMaxMinutes} min`
        : 'Choose an area to see the delivery fee and estimated time.';
      renderCart();
    });
    elements.search.addEventListener('input', renderMenu);
    elements.categories.addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      state.category = button.dataset.category;
      renderCategories();
      renderMenu();
    });
    elements.menu.addEventListener('click', (event) => {
      const button = event.target.closest('[data-add-id]');
      if (button) changeQuantity(button.dataset.addId, 1);
    });
    elements.cartLines.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cart-change]');
      if (button) changeQuantity(button.dataset.id, Number(button.dataset.cartChange));
    });
    elements.checkoutForm.addEventListener('submit', submitOrder);
    document.getElementById('tracking-refresh').addEventListener('click', () => {
      refreshTracking().catch((error) => showNotice(error.message));
    });
    document.getElementById('new-order').addEventListener('click', startNewOrder);
  }

  async function init() {
    wireEvents();
    const params = new URLSearchParams(location.search);
    const requestedOutlet = params.get('outlet');
    if (requestedOutlet && Object.prototype.hasOwnProperty.call(OUTLET_LABEL, requestedOutlet)) {
      state.outlet = requestedOutlet;
      elements.outlet.value = requestedOutlet;
    }
    try {
      await Promise.all([loadMenu(), loadZones()]);
      const token = params.get('token');
      if (token) {
        state.token = token;
        showTrackingScreen();
        await refreshTracking();
      } else {
        updateFulfillment();
      }
    } catch (error) {
      showNotice(error.message || 'Could not load the restaurant menu.');
    }
  }

  init();
})();
