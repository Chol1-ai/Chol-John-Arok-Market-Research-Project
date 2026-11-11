(function () {
  'use strict';

  const OUTLET_LABEL = {
    FOODIZO_HAM_TOWERS: 'Foodizo · Ham Towers',
    OBUNUZI_YMCA: 'Obunuzi · Opposite YMCA'
  };
  const STATUS_COPY = {
    AWAITING_PAYMENT: 'Order received. Pay cash at the counter before kitchen preparation starts.',
    PENDING: 'Your order is queued for the kitchen.',
    PREPARING: 'The kitchen is preparing your order.',
    READY: 'Your order is ready for pickup.',
    OUT_FOR_DELIVERY: 'Your order has been dispatched and is on the way.',
    COMPLETED: 'This order has been completed. Thank you!',
    CANCELLED: 'This order was cancelled. Please contact the outlet if you need help.'
  };
  const elements = {
    notice: document.getElementById('tracker-notice'),
    form: document.getElementById('tracker-form'),
    token: document.getElementById('tracker-token'),
    outlet: document.getElementById('tracker-outlet'),
    submit: document.getElementById('tracker-submit'),
    result: document.getElementById('tracker-result'),
    channel: document.getElementById('result-channel'),
    status: document.getElementById('result-status'),
    order: document.getElementById('result-order'),
    destination: document.getElementById('result-destination'),
    items: document.getElementById('result-items'),
    updated: document.getElementById('result-updated'),
    refresh: document.getElementById('tracker-refresh')
  };
  let token = '';
  let outlet = '';
  let pollTimer = null;
  let requestInProgress = false;

  function showNotice(message) {
    elements.notice.textContent = message;
    elements.notice.hidden = false;
  }

  function hideNotice() {
    elements.notice.textContent = '';
    elements.notice.hidden = true;
  }

  async function getOrderStatus() {
    const query = new URLSearchParams({ outlet });
    const response = await fetch(
      `/api/v1/orders/token/${encodeURIComponent(token)}?${query.toString()}`,
      { credentials: 'same-origin' }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || data.error || `Could not load order status (${response.status}).`);
    }
    return data;
  }

  function renderOrder(data) {
    const isDelivery = data.channel === 'PHONE_DELIVERY';
    const status = isDelivery ? (data.deliveryStatus || data.status) : data.status;
    elements.channel.textContent = isDelivery ? 'Delivery order' : 'Pickup order';
    elements.status.textContent = STATUS_COPY[status] || `Order status: ${status}`;
    elements.order.textContent =
      `${data.displayToken || token} · ${data.orderNumber} · ${OUTLET_LABEL[data.outlet] || data.outlet}`;
    elements.destination.hidden = !isDelivery || !data.destination;
    elements.destination.textContent = isDelivery && data.destination
      ? `Delivery area: ${data.destination}`
      : '';
    elements.items.replaceChildren();
    (data.items || []).forEach((item) => {
      const line = document.createElement('li');
      line.textContent = `${item.quantity} × ${item.name}`;
      elements.items.appendChild(line);
    });
    elements.updated.textContent = `Last updated ${new Date().toLocaleTimeString()}. Status refreshes automatically.`;
    elements.result.hidden = false;
    elements.refresh.disabled = false;

    if (status === 'COMPLETED' || status === 'CANCELLED') {
      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = null;
    } else if (!pollTimer) {
      pollTimer = window.setInterval(() => {
        refreshStatus().catch((error) => showNotice(error.message));
      }, 10000);
    }
  }

  async function refreshStatus() {
    if (!token || requestInProgress) return;
    requestInProgress = true;
    elements.refresh.disabled = true;
    hideNotice();
    try {
      const data = await getOrderStatus();
      renderOrder(data);
    } finally {
      requestInProgress = false;
      elements.refresh.disabled = false;
    }
  }

  async function trackOrder(nextToken, nextOutlet, updateUrl) {
    token = nextToken.trim();
    outlet = nextOutlet;
    elements.token.value = token;
    elements.outlet.value = outlet;
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = null;
    elements.result.hidden = true;
    if (updateUrl) {
      const query = new URLSearchParams({ token, outlet });
      history.replaceState(null, '', `${location.pathname}?${query.toString()}`);
    }
    await refreshStatus();
  }

  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!elements.form.reportValidity()) return;
    elements.submit.disabled = true;
    const label = elements.submit.textContent;
    elements.submit.textContent = 'Looking up order…';
    trackOrder(elements.token.value, elements.outlet.value, true)
      .catch((error) => showNotice(error.message))
      .finally(() => {
        elements.submit.disabled = false;
        elements.submit.textContent = label;
      });
  });

  elements.refresh.addEventListener('click', () => {
    refreshStatus().catch((error) => showNotice(error.message));
  });

  const params = new URLSearchParams(location.search);
  const queryToken = params.get('token');
  const queryOutlet = params.get('outlet');
  if (queryOutlet && Object.prototype.hasOwnProperty.call(OUTLET_LABEL, queryOutlet)) {
    elements.outlet.value = queryOutlet;
  }
  if (queryToken) {
    elements.token.value = queryToken;
    if (queryOutlet && Object.prototype.hasOwnProperty.call(OUTLET_LABEL, queryOutlet)) {
      trackOrder(queryToken, queryOutlet, false).catch((error) => showNotice(error.message));
    } else {
      showNotice('Choose the outlet where you placed the order to look up this token.');
    }
  }
})();
