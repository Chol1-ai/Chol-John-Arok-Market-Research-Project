(function () {
  'use strict';

  const OUTLET_LABEL = {
    FOODIZO_HAM_TOWERS: 'Foodizo · Ham Towers',
    OBUNUZI_YMCA: 'Obunuzi · Opposite YMCA'
  };
  const APP_CONFIG = window.FoodizoAppConfig || { outlet: 'FOODIZO_HAM_TOWERS' };
  Object.keys(OUTLET_LABEL).forEach((outlet) => {
    if (outlet !== APP_CONFIG.outlet) delete OUTLET_LABEL[outlet];
  });
  const STATUS_COPY = {
    AWAITING_PAYMENT: 'Order received. Pay cash at the counter before kitchen preparation starts.',
    PENDING: 'Your order is queued for the kitchen.',
    PREPARING: 'The kitchen is preparing your order.',
    READY: 'Your order is ready for pickup.',
    OUT_FOR_DELIVERY: 'Your order has been dispatched and is on the way.',
    COMPLETED: 'This order has been completed. Thank you!',
    CANCELLED: 'This order was cancelled. Please contact the outlet if you need help.'
  };
  const TRACKING_ACCESS_KEY = 'foodizo-delivery-tracking-access-v1';
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
    refresh: document.getElementById('tracker-refresh'),
    liveMapCard: document.getElementById('tracker-live-map-card'),
    liveState: document.getElementById('tracker-live-state'),
    liveMap: document.getElementById('tracker-live-map'),
    liveMapEmpty: document.getElementById('tracker-live-map-empty'),
    liveUpdated: document.getElementById('tracker-live-updated')
  };
  let token = '';
  let outlet = '';
  let deliveryToken = '';
  let pollTimer = null;
  let requestInProgress = false;
  let liveMap = null;
  let liveMarker = null;
  let lastMapPosition = null;

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

  async function getDeliveryTracking() {
    const response = await fetch('/api/v1/delivery-tracking/customer', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${deliveryToken}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || data.error || `Could not load delivery tracking (${response.status}).`);
    }
    return data;
  }

  function initializeLiveMap() {
    if (liveMap) return liveMap;
    if (!window.L) return null;
    liveMap = window.L.map(elements.liveMap, { scrollWheelZoom: false })
      .setView([0.3335, 32.5686], 14);
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(liveMap);
    window.requestAnimationFrame(() => liveMap.invalidateSize());
    return liveMap;
  }

  function renderLiveLocation(data) {
    elements.liveMapCard.hidden = false;
    const updatedAtMs = data.locationUpdatedAt
      ? new Date(data.locationUpdatedAt).getTime()
      : 0;
    const updateIsStale = !updatedAtMs || Date.now() - updatedAtMs > 120000;
    elements.liveState.textContent = updateIsStale && data.trackingStatus === 'SHARING'
      ? 'No recent GPS update'
      : ({
          SHARING: 'Live GPS sharing',
          PAUSED: 'Sharing paused',
          INVITED: 'Waiting for rider to start',
          STOPPED: 'Location sharing stopped'
      }[data.trackingStatus] || 'Location unavailable');

    const validLocation =
      Number.isFinite(Number(data.latitude)) &&
      Number.isFinite(Number(data.longitude)) &&
      data.latitude !== null &&
      data.longitude !== null &&
      Number(data.latitude) >= -90 &&
      Number(data.latitude) <= 90 &&
      Number(data.longitude) >= -180 &&
      Number(data.longitude) <= 180;
    const map = initializeLiveMap();
    if (!map) {
      elements.liveMapEmpty.hidden = false;
      elements.liveMapEmpty.textContent = 'The map could not be loaded. Check your internet connection and refresh.';
      return;
    }

    if (!validLocation) {
      if (liveMarker) {
        liveMap.removeLayer(liveMarker);
        liveMarker = null;
      }
      lastMapPosition = null;
      elements.liveMapEmpty.hidden = false;
      elements.liveMapEmpty.textContent = data.trackingStatus === 'STOPPED'
        ? 'Location sharing has stopped. No live rider location is available.'
        : data.trackingStatus === 'PAUSED'
          ? 'The rider paused sharing. The last location is unavailable.'
          : data.trackingStatus === 'SHARING'
            ? 'Waiting for the rider’s first GPS fix.'
          : 'The map is centered on Makerere. The rider’s location will appear after sharing starts.';
      elements.liveUpdated.textContent = 'No current rider location.';
      return;
    }

    const position = [Number(data.latitude), Number(data.longitude)];
    const positionKey = position.join(',');
    const icon = window.L.divIcon({
      className: '',
      html: '<span class="customer-rider-marker" aria-hidden="true">●</span>',
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
    if (!liveMarker) {
      liveMarker = window.L.marker(position, { icon }).addTo(map);
    } else {
      liveMarker.setLatLng(position);
    }
    if (data.riderName) {
      const riderLabel = document.createElement('span');
      riderLabel.textContent = String(data.riderName);
      liveMarker.bindTooltip(riderLabel, { direction: 'top' });
    }
    if (positionKey !== lastMapPosition) {
      map.panTo(position);
      lastMapPosition = positionKey;
    }
    elements.liveMapEmpty.hidden = true;
    const age = updatedAtMs ? new Date(updatedAtMs).toLocaleTimeString() : 'Unknown';
    const accuracy = data.accuracyM !== null &&
      data.accuracyM !== undefined &&
      Number.isFinite(Number(data.accuracyM))
      ? ` · accuracy ±${Math.round(Number(data.accuracyM))} m`
      : '';
    elements.liveUpdated.textContent =
      `Last GPS update: ${age}${accuracy}${updateIsStale ? ' · the rider’s phone may be offline or the page may be suspended' : ''}`;
  }

  function renderDeliveryTracking(data) {
    const status = data.deliveryStatus || 'OUT_FOR_DELIVERY';
    const statusCopy = {
      AWAITING_PAYMENT: 'Payment is required before preparation.',
      PENDING: 'Your order is queued for the kitchen.',
      PREPARING: 'The kitchen is preparing your order.',
      READY: 'Your order is ready and waiting for rider dispatch.',
      OUT_FOR_DELIVERY: 'Your order has been dispatched.',
      COMPLETED: 'This delivery is complete. Thank you!',
      CANCELLED: 'This order was cancelled. Please contact the outlet if you need help.'
    };
    outlet = data.outlet || outlet;
    token = data.tokenNumber || token;
    elements.channel.textContent = 'Private delivery tracking';
    elements.status.textContent = statusCopy[status] || `Delivery status: ${status}`;
    elements.order.textContent =
      `${data.tokenNumber || 'Delivery'} · ${data.orderNumber} · ${OUTLET_LABEL[outlet] || outlet}`;
    elements.destination.hidden = !data.destination;
    elements.destination.textContent = data.destination ? `Delivery area: ${data.destination}` : '';
    elements.items.replaceChildren();
    elements.updated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
    elements.result.hidden = false;
    elements.form.hidden = true;
    elements.refresh.disabled = false;
    renderLiveLocation(data);

    if (status === 'COMPLETED' || status === 'CANCELLED') {
      if (window.FoodizoReadyNotifications && data.tokenNumber && outlet) {
        window.FoodizoReadyNotifications.clearActiveOrder(data.tokenNumber, outlet);
      }
      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = null;
    } else {
      if (window.FoodizoReadyNotifications && data.tokenNumber && outlet) {
        window.FoodizoReadyNotifications.setActiveOrder({
          token: data.tokenNumber,
          outlet,
          channel: 'PHONE_DELIVERY',
          deliveryTrackingUrl: `/tracker#delivery=${deliveryToken}`
        });
      }
    }
    if (status !== 'COMPLETED' && status !== 'CANCELLED' && !pollTimer) {
      pollTimer = window.setInterval(() => {
        refreshStatus().catch((error) => showNotice(error.message));
      }, 10000);
    }
  }

  function renderOrder(data) {
    elements.liveMapCard.hidden = true;
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
    elements.updated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
    elements.result.hidden = false;
    elements.refresh.disabled = false;

    if (window.FoodizoReadyNotifications) {
      const activeOrder = {
        token: data.token || token,
        outlet: data.outlet || outlet,
        channel: data.channel,
        createdAt: data.createdAt
      };
      if (status === 'READY') window.FoodizoReadyNotifications.notifyReady(activeOrder);
      if (status === 'COMPLETED' || status === 'CANCELLED') {
        window.FoodizoReadyNotifications.clearActiveOrder(token, outlet);
      } else {
        window.FoodizoReadyNotifications.setActiveOrder(activeOrder);
      }
    }

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
    if ((!token && !deliveryToken) || requestInProgress) return;
    requestInProgress = true;
    elements.refresh.disabled = true;
    hideNotice();
    try {
      if (deliveryToken) {
        const data = await getDeliveryTracking();
        renderDeliveryTracking(data);
      } else {
        const data = await getOrderStatus();
        renderOrder(data);
      }
    } finally {
      requestInProgress = false;
      elements.refresh.disabled = false;
    }
  }

  async function trackOrder(nextToken, nextOutlet, updateUrl) {
    deliveryToken = '';
    try {
      window.sessionStorage.removeItem(TRACKING_ACCESS_KEY);
    } catch (error) {
      showNotice(`Could not clear the previous delivery link: ${error.message}`);
    }
    elements.form.hidden = false;
    elements.liveMapCard.hidden = true;
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
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const hashDeliveryToken = hashParams.get('delivery');
  try {
    if (hashDeliveryToken && /^[A-Za-z0-9_-]{43}$/.test(hashDeliveryToken)) {
      deliveryToken = hashDeliveryToken;
      window.sessionStorage.setItem(TRACKING_ACCESS_KEY, deliveryToken);
      history.replaceState(null, '', `${location.pathname}${location.search}`);
    } else if (queryToken) {
      window.sessionStorage.removeItem(TRACKING_ACCESS_KEY);
    } else {
      const savedDeliveryToken = window.sessionStorage.getItem(TRACKING_ACCESS_KEY) || '';
      if (/^[A-Za-z0-9_-]{43}$/.test(savedDeliveryToken)) {
        deliveryToken = savedDeliveryToken;
      }
    }
  } catch (error) {
    showNotice(`Could not restore the private delivery link: ${error.message}`);
  }
  if (queryOutlet && Object.prototype.hasOwnProperty.call(OUTLET_LABEL, queryOutlet)) {
    elements.outlet.value = queryOutlet;
  }
  if (deliveryToken) {
    refreshStatus().catch((error) => showNotice(error.message));
  } else if (queryToken) {
    elements.token.value = queryToken;
    if (queryOutlet && Object.prototype.hasOwnProperty.call(OUTLET_LABEL, queryOutlet)) {
      trackOrder(queryToken, queryOutlet, false).catch((error) => showNotice(error.message));
    } else {
      showNotice('Choose the outlet where you placed the order to look up this token.');
    }
  }
})();
