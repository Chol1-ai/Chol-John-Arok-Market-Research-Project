(function () {
  'use strict';

  const OUTLET_LABEL = {
    FOODIZO_HAM_TOWERS: 'Foodizo · Ham Towers',
    OBUNUZI_YMCA: 'Obunuzi · Opposite YMCA'
  };
  const CART_STORAGE_PREFIX = 'foodizo-customer-cart-v1:';
  const LAST_OUTLET_STORAGE_KEY = 'foodizo-customer-last-outlet';
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
    deliveryFeeRow: document.getElementById('delivery-fee-row'),
    deliveryFee: document.getElementById('delivery-fee'),
    search: document.getElementById('search'),
    menuTitle: document.getElementById('menu-title'),
    menuDescription: document.getElementById('menu-description'),
    menu: document.getElementById('menu'),
    layout: document.querySelector('.customer-layout'),
    cartPanel: document.getElementById('cart-panel'),
    cartNav: document.querySelector('[data-customer-cart]'),
    cartToggle: document.getElementById('cart-toggle'),
    cartToggleSummary: document.getElementById('cart-toggle-summary'),
    cartClose: document.getElementById('cart-close'),
    cartTitle: document.getElementById('cart-title'),
    cartReview: document.getElementById('cart-review'),
    proceedToCheckout: document.getElementById('proceed-to-checkout'),
    checkoutBack: document.getElementById('checkout-back'),
    cartLines: document.getElementById('cart-lines'),
    cartTotal: document.getElementById('cart-total'),
    checkoutForm: document.getElementById('checkout-form'),
    submitOrder: document.getElementById('submit-order'),
    trackingTitle: document.getElementById('tracking-title'),
    trackingToken: document.getElementById('tracking-token'),
    trackingTokenLabel: document.getElementById('tracking-token-label')
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
    const categories = window.FOODIZO_MENU_CATEGORIES || [];
    const category = categories.find((entry) => entry.name === item.category);
    return category ? category.image : null;
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

  function persistCart() {
    try {
      localStorage.setItem(
        `${CART_STORAGE_PREFIX}${state.outlet}`,
        JSON.stringify(Array.from(state.cart.entries()))
      );
    } catch (error) {
      showNotice(`Could not save your cart in this browser: ${error.message}`);
    }
  }

  function persistLastOutlet() {
    try {
      localStorage.setItem(LAST_OUTLET_STORAGE_KEY, state.outlet);
    } catch (error) {
      showNotice(`Could not save your selected outlet: ${error.message}`);
    }
  }

  function saveActiveOrder() {
    if (window.FoodizoReadyNotifications && state.token) {
      window.FoodizoReadyNotifications.setActiveOrder({
        token: state.token,
        outlet: state.outlet,
        channel: state.channel
      });
    }
  }

  function restoreCart() {
    let saved;
    try {
      const serialized = localStorage.getItem(`${CART_STORAGE_PREFIX}${state.outlet}`);
      if (!serialized) return;
      saved = JSON.parse(serialized);
    } catch (error) {
      showNotice(`Could not restore your saved cart: ${error.message}`);
      return;
    }

    if (!Array.isArray(saved)) {
      showNotice('Could not restore your saved cart because its data is invalid.');
      return;
    }

    let skippedItems = false;
    for (const entry of saved) {
      if (!Array.isArray(entry) || entry.length !== 2) {
        skippedItems = true;
        continue;
      }
      const [itemId, quantity] = entry;
      if (typeof itemId !== 'string' || !Number.isSafeInteger(quantity) || quantity < 1) {
        skippedItems = true;
        continue;
      }
      const item = state.menu.find((row) => row.id === itemId);
      if (item && item.isAvailable && !item.is86) state.cart.set(itemId, quantity);
      else skippedItems = true;
    }
    if (skippedItems) showNotice('Some saved cart items were omitted because they are no longer available.');
  }

  function hideNotice() {
    elements.notice.hidden = true;
    elements.notice.textContent = '';
  }

  async function loadMenu(options) {
    const preserveCart = Boolean(options && options.preserveCart);
    elements.menu.innerHTML = '<div class="customer-empty">Loading today’s menu…</div>';
    const data = await request(`/api/v1/menu-items?outlet=${encodeURIComponent(state.outlet)}`);
    state.menu = (data.items || []).filter((item) => item.isActive);
    if (preserveCart) {
      for (const itemId of state.cart.keys()) {
        const item = state.menu.find((row) => row.id === itemId);
        if (!item || !item.isAvailable || item.is86) state.cart.delete(itemId);
      }
      persistCart();
    } else {
      state.cart.clear();
      restoreCart();
    }
    state.category = 'ALL';
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
    elements.submitOrder.textContent = isDelivery ? 'Place delivery order' : 'Place pickup order';
    renderCart();
  }

  function selectedDeliveryFee() {
    return state.channel === 'PHONE_DELIVERY' && state.selectedZone
      ? Number(state.selectedZone.feeUgx)
      : 0;
  }

  function setCheckoutStep(isCheckout) {
    elements.cartReview.hidden = isCheckout;
    elements.checkoutForm.hidden = !isCheckout;
    elements.cartTitle.textContent = isCheckout ? 'Checkout' : 'Your cart';
  }

  function renderMenu() {
    const query = elements.search.value.trim().toLowerCase();
    const categories = window.FOODIZO_MENU_CATEGORIES || [];
    const category = categories.find((entry) => entry.name === state.category);
    elements.menuTitle.textContent = category ? category.name : 'Menu';
    elements.menuDescription.textContent = category ? category.description : '';
    elements.menuDescription.hidden = !category;
    const items = state.menu.filter((item) =>
      (state.category === 'ALL' || item.category === state.category) &&
      (!query || `${item.name} ${item.category} ${item.description || ''}`.toLowerCase().includes(query))
    );
    if (!items.length) {
      const filter = query || (state.category !== 'ALL' ? state.category : null);
      const message = filter
        ? `No items match “${filter}”.`
        : 'No menu items available.';
      elements.menu.innerHTML =
        `<div class="customer-empty">${escapeHtml(message)}</div>`;
      return;
    }
    elements.menu.innerHTML = items.map((item) => {
      const available = item.isAvailable && !item.is86;
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
            ${item.description ? `<p class="customer-meal-description">${escapeHtml(item.description)}</p>` : ''}
            ${available ? '' : '<span class="customer-meal-unavailable">Temporarily unavailable</span>'}
            <div class="customer-meal-bottom">
              <span class="customer-meal-price">${formatUgx(item.priceUgx)}</span>
              <button class="customer-add" type="button" data-add-id="${escapeHtml(item.id)}"
                ${available ? '' : 'disabled'}
                aria-label="${available ? 'Add' : 'Unavailable'} ${escapeHtml(item.name)}">${
                  available ? '+' : '×'
                }</button>
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
    const hasItems = lines.length > 0;
    elements.cartPanel.hidden = !hasItems;
    elements.cartToggle.hidden = !hasItems;
    elements.layout.classList.toggle('has-cart', hasItems);
    if (!hasItems) {
      elements.cartPanel.classList.remove('is-open');
      document.body.classList.remove('cart-open');
      elements.cartToggle.setAttribute('aria-expanded', 'false');
      setCheckoutStep(false);
    }
    elements.cartTotal.textContent = formatUgx(total);
    elements.cartToggleSummary.textContent =
      `${count} ${count === 1 ? 'item' : 'items'} · ${formatUgx(total)}`;
    elements.deliveryFee.textContent = formatUgx(deliveryFee);
    elements.proceedToCheckout.disabled = !hasItems;
    elements.submitOrder.disabled = !lines.length ||
      (state.channel === 'PHONE_DELIVERY' && (!state.selectedZone || !state.zones.length));
    document.dispatchEvent(new Event('customer-cart-change'));
    elements.cartLines.innerHTML = lines.length ? lines.map(({ item, quantity }) => `
      <div class="customer-cart-line">
        <span class="customer-cart-line-name">${escapeHtml(item.name)}</span>
        <span class="customer-cart-qty">
          <button class="customer-qty-button" type="button" data-cart-change="-1" data-id="${escapeHtml(item.id)}" aria-label="Remove one ${escapeHtml(item.name)}">−</button>
          <strong>${quantity}</strong>
          <button class="customer-qty-button" type="button" data-cart-change="1" data-id="${escapeHtml(item.id)}" aria-label="Add one ${escapeHtml(item.name)}">+</button>
        </span>
      </div>
    `).join('') : '';
  }

  function changeQuantity(itemId, delta) {
    const item = state.menu.find((row) => row.id === itemId);
    if (!item || (delta > 0 && (!item.isAvailable || item.is86))) return;
    const next = (state.cart.get(itemId) || 0) + delta;
    if (next <= 0) state.cart.delete(itemId);
    else state.cart.set(itemId, next);
    persistCart();
    renderCart();
  }

  function setCartOpen(open) {
    elements.cartPanel.classList.toggle('is-open', open);
    document.body.classList.toggle('cart-open', open);
    elements.cartToggle.setAttribute('aria-expanded', String(open));
    if (open) elements.cartClose.focus();
    else elements.cartToggle.focus();
  }

  function openCartFromNav() {
    if (!state.cart.size) {
      showNotice('Your cart is empty.');
      return;
    }
    setCheckoutStep(false);
    setCartOpen(true);
    elements.cartPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      saveActiveOrder();
      state.cart.clear();
      persistCart();
      history.replaceState(null, '', `/order?token=${encodeURIComponent(state.token)}&outlet=${encodeURIComponent(state.outlet)}`);
      showTrackingScreen();
      await refreshTracking();
    } catch (error) {
      const stockMessage = 'Some ingredients are temporarily unavailable. Review the refreshed menu and update your order.';
      const message =
        error.code === 'INSUFFICIENT_INGREDIENT_STOCK' || error.code === 'MENU_ITEM_UNAVAILABLE'
          ? stockMessage
          : error.message || 'Could not place your order. Please try again.';
      showNotice(message);
      if (error.code === 'MENU_ITEM_UNAVAILABLE' || error.code === 'INSUFFICIENT_INGREDIENT_STOCK') {
        try {
          await loadMenu({ preserveCart: true });
        } catch (refreshError) {
          showNotice(`${message} Menu refresh failed: ${refreshError.message}`);
        }
      }
    } finally {
      elements.submitOrder.textContent = state.channel === 'PHONE_DELIVERY'
        ? 'Place delivery order'
        : 'Place pickup order';
      renderCart();
    }
  }

  function showTrackingScreen() {
    elements.cartPanel.classList.remove('is-open');
    document.body.classList.remove('cart-open');
    elements.cartToggle.setAttribute('aria-expanded', 'false');
    elements.orderScreen.hidden = true;
    elements.trackingScreen.hidden = false;
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
    state.channel = data.channel;
    state.outlet = data.outlet;
    const isDelivery = data.channel === 'PHONE_DELIVERY';
    const deliveryStatus = data.deliveryStatus || data.status;
    const statusLabels = isDelivery
      ? {
          AWAITING_PAYMENT: 'Payment required',
          PENDING: 'Order received',
          PREPARING: 'Preparing your order',
          READY: 'Ready for dispatch',
          OUT_FOR_DELIVERY: 'On the way',
          COMPLETED: 'Delivered',
          CANCELLED: 'Order cancelled'
        }
      : {
          AWAITING_PAYMENT: 'Payment required',
          PENDING: 'Order received',
          PREPARING: 'Preparing your order',
          READY: 'Ready for pickup',
          COMPLETED: 'Order collected',
          CANCELLED: 'Order cancelled'
        };
    const statusLabel = statusLabels[deliveryStatus] || `Order status: ${deliveryStatus}`;
    elements.trackingTitle.textContent = statusLabel;
    elements.trackingTokenLabel.textContent = isDelivery ? 'Delivery token' : 'Pickup token';
    document.title = `${statusLabel} | Foodizo & Obunuzi`;
    if (window.FoodizoReadyNotifications) {
      if (deliveryStatus === 'READY') {
        window.FoodizoReadyNotifications.notifyReady({
          token: data.token || state.token,
          outlet: state.outlet,
          channel: state.channel,
          createdAt: data.createdAt
        });
      }
      if (deliveryStatus === 'COMPLETED' || deliveryStatus === 'CANCELLED') {
        window.FoodizoReadyNotifications.clearActiveOrder(state.token, state.outlet);
      }
    }
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
    persistCart();
    updateFulfillment();
  }

  function wireEvents() {
    elements.outlet.addEventListener('change', async () => {
      state.outlet = elements.outlet.value;
      persistLastOutlet();
      hideNotice();
      try { await Promise.all([loadMenu(), loadZones()]); } catch (error) { showNotice(error.message); }
    });
    elements.fulfillment.addEventListener('change', updateFulfillment);
    elements.deliveryZone.addEventListener('change', () => {
      state.selectedZone = state.zones.find((zone) => zone.id === elements.deliveryZone.value) || null;
      renderCart();
    });
    elements.search.addEventListener('input', renderMenu);
    elements.menu.addEventListener('click', (event) => {
      const button = event.target.closest('[data-add-id]');
      if (button) changeQuantity(button.dataset.addId, 1);
    });
    elements.cartLines.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cart-change]');
      if (button) changeQuantity(button.dataset.id, Number(button.dataset.cartChange));
    });
    elements.cartToggle.addEventListener('click', () => setCartOpen(true));
    elements.cartClose.addEventListener('click', () => setCartOpen(false));
    elements.cartNav.addEventListener('click', (event) => {
      if (location.pathname !== '/order' || new URLSearchParams(location.search).has('token')) return;
      event.preventDefault();
      const currentUrl = new URL(location.href);
      currentUrl.hash = 'cart';
      history.replaceState(null, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
      openCartFromNav();
    });
    window.addEventListener('hashchange', () => {
      if (location.hash === '#cart' && !new URLSearchParams(location.search).has('token')) {
        openCartFromNav();
      }
    });
    elements.proceedToCheckout.addEventListener('click', () => {
      if (!state.cart.size) return;
      setCheckoutStep(true);
      const nameField = elements.checkoutForm.querySelector('[name="customerName"]');
      if (nameField) nameField.focus();
    });
    elements.checkoutBack.addEventListener('click', () => {
      setCheckoutStep(false);
      elements.proceedToCheckout.focus();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && elements.cartPanel.classList.contains('is-open')) {
        setCartOpen(false);
      }
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
    } else {
      try {
        const savedOutlet = localStorage.getItem(LAST_OUTLET_STORAGE_KEY);
        if (savedOutlet && Object.prototype.hasOwnProperty.call(OUTLET_LABEL, savedOutlet)) {
          state.outlet = savedOutlet;
        }
      } catch (error) {
        showNotice(`Could not restore your selected outlet: ${error.message}`);
      }
    }
    elements.outlet.value = state.outlet;
    persistLastOutlet();
    const requestedFulfillment = params.get('fulfillment');
    if (requestedFulfillment === 'TAKEAWAY_PICKUP' || requestedFulfillment === 'PHONE_DELIVERY') {
      elements.fulfillment.value = requestedFulfillment;
      state.channel = requestedFulfillment;
    }
    try {
      await Promise.all([loadMenu(), loadZones()]);
      const requestedZoneId = params.get('deliveryZoneId');
      if (requestedZoneId && state.channel === 'PHONE_DELIVERY') {
        state.selectedZone = state.zones.find((zone) => zone.id === requestedZoneId) || null;
        elements.deliveryZone.value = state.selectedZone ? state.selectedZone.id : '';
      }
      const requestedCategory = params.get('category');
      if (requestedCategory && state.menu.some((item) => item.category === requestedCategory)) {
        state.category = requestedCategory;
      }
      const requestedSearch = params.get('q');
      if (requestedSearch) elements.search.value = requestedSearch;
      renderMenu();
      const token = params.get('token');
      if (token) {
        state.token = token;
        saveActiveOrder();
        showTrackingScreen();
        await refreshTracking();
      } else {
        updateFulfillment();
        if (location.hash === '#cart') openCartFromNav();
      }
    } catch (error) {
      showNotice(error.message || 'Could not load the restaurant menu.');
    }
  }

  init();
})();
