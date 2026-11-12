(function () {
  'use strict';

  const OUTLET_LABELS = {
    FOODIZO_HAM_TOWERS: 'Foodizo · Ham Towers',
    OBUNUZI_YMCA: 'Obunuzi · Opposite YMCA'
  };
  const ACTIVE_ORDER_KEY = 'foodizo-ready-active-order-v1';
  const OPT_IN_KEY = 'foodizo-ready-notifications-enabled-v1';
  const READY_NOTIFICATION_PREFIX = 'foodizo-ready-notified-v1:';
  const toggle = document.getElementById('ready-notification-toggle');
  const status = document.getElementById('ready-notification-status');
  const isLandingPage = location.pathname === '/' || location.pathname === '/index.html';
  let activeOrder = null;
  let pollTimer = null;
  let requestInProgress = false;

  function showStatus(message) {
    if (status) status.textContent = message;
  }

  function notificationsEnabled() {
    try {
      return localStorage.getItem(OPT_IN_KEY) === 'true' &&
        typeof Notification !== 'undefined' && Notification.permission === 'granted';
    } catch (error) {
      console.error('Could not read ready notification settings.', error);
      return false;
    }
  }

  function storeEnabled(enabled) {
    try {
      localStorage.setItem(OPT_IN_KEY, String(enabled));
      return true;
    } catch (error) {
      console.error('Could not save ready notification settings.', error);
      showStatus('Could not save your notification setting in this browser.');
      return false;
    }
  }

  function updateToggle() {
    if (!toggle) return;
    const enabled = notificationsEnabled();
    toggle.classList.toggle('is-enabled', enabled);
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute(
      'aria-label',
      enabled ? 'Disable ready notifications' : 'Enable ready notifications'
    );
  }

  function parseActiveOrder(serialized) {
    if (!serialized) return null;
    const order = JSON.parse(serialized);
    if (!order || typeof order.token !== 'string' ||
        !/^[A-Za-z0-9-]{1,24}$/.test(order.token) ||
        !Object.prototype.hasOwnProperty.call(OUTLET_LABELS, order.outlet)) {
      throw new Error('Saved order notification data is invalid.');
    }
    return { token: order.token, outlet: order.outlet, channel: order.channel };
  }

  function loadActiveOrder() {
    try {
      activeOrder = parseActiveOrder(localStorage.getItem(ACTIVE_ORDER_KEY));
    } catch (error) {
      activeOrder = null;
      console.error('Could not restore the active order for notifications.', error);
    }
    startPolling();
  }

  function setActiveOrder(order) {
    if (!order || typeof order.token !== 'string' ||
        !/^[A-Za-z0-9-]{1,24}$/.test(order.token) ||
        !Object.prototype.hasOwnProperty.call(OUTLET_LABELS, order.outlet)) {
      throw new Error('Cannot save an invalid order for notifications.');
    }
    activeOrder = { token: order.token, outlet: order.outlet, channel: order.channel };
    try {
      localStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify(activeOrder));
    } catch (error) {
      console.error('Could not save the active order for notifications.', error);
      showStatus('Could not save this order for ready notifications.');
    }
    startPolling();
  }

  function clearActiveOrder(token, outlet) {
    if (activeOrder && activeOrder.token === token && activeOrder.outlet === outlet) {
      activeOrder = null;
    }
    try {
      const saved = parseActiveOrder(localStorage.getItem(ACTIVE_ORDER_KEY));
      if (saved && saved.token === token && saved.outlet === outlet) {
        localStorage.removeItem(ACTIVE_ORDER_KEY);
      }
    } catch (error) {
      console.error('Could not clear the completed order notification.', error);
    }
    startPolling();
  }

  function notifyReady(order) {
    if (!notificationsEnabled() || typeof Notification === 'undefined' ||
        Notification.permission !== 'granted') return;

    const key = `${READY_NOTIFICATION_PREFIX}${order.outlet}:${order.token}:${order.createdAt || ''}`;
    try {
      if (localStorage.getItem(key) === 'true') return;
    } catch (error) {
      console.error('Could not check ready notification history.', error);
    }

    let notification;
    try {
      notification = new Notification('Your order is ready', {
        body: `${OUTLET_LABELS[order.outlet]} · ${order.channel === 'PHONE_DELIVERY' ? 'Ready for dispatch' : 'Ready for pickup'}`,
        icon: '/images/foodizo-brand-mark.svg',
        tag: key
      });
    } catch (error) {
      console.error('Could not send the ready notification.', error);
      showStatus('Could not display a ready notification in this browser.');
      return;
    }

    notification.addEventListener('click', () => {
      window.focus();
      window.location.assign(
        `/tracker?token=${encodeURIComponent(order.token)}&outlet=${encodeURIComponent(order.outlet)}`
      );
    });
    try {
      localStorage.setItem(key, 'true');
    } catch (error) {
      console.error('Could not save ready notification history.', error);
    }
  }

  async function pollActiveOrder() {
    if (!isLandingPage || !activeOrder || requestInProgress ||
        !notificationsEnabled() || typeof Notification === 'undefined' ||
        Notification.permission !== 'granted') return;
    requestInProgress = true;
    const polledOrder = { ...activeOrder };
    try {
      const params = new URLSearchParams({ outlet: polledOrder.outlet });
      const response = await fetch(
        `/api/v1/orders/token/${encodeURIComponent(polledOrder.token)}?${params.toString()}`,
        { credentials: 'same-origin' }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || data.error || `Could not check order status (${response.status}).`);
      }
      const order = {
        token: data.token || polledOrder.token,
        outlet: data.outlet || polledOrder.outlet,
        channel: data.channel || polledOrder.channel,
        createdAt: data.createdAt
      };
      const currentStatus = data.channel === 'PHONE_DELIVERY'
        ? (data.deliveryStatus || data.status)
        : data.status;
      if (currentStatus === 'READY') notifyReady(order);
      if (currentStatus === 'COMPLETED' || currentStatus === 'CANCELLED') {
        clearActiveOrder(polledOrder.token, polledOrder.outlet);
      }
    } catch (error) {
      console.error('Could not check the active order for a ready notification.', error);
      showStatus('Could not check your order status for notifications. The page will keep trying.');
    } finally {
      requestInProgress = false;
    }
  }

  function startPolling() {
    if (!isLandingPage || !activeOrder || !notificationsEnabled() ||
        typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = null;
      return;
    }
    if (pollTimer) return;
    pollActiveOrder();
    pollTimer = window.setInterval(pollActiveOrder, 12000);
  }

  async function toggleNotifications() {
    if (notificationsEnabled()) {
      if (!storeEnabled(false)) return;
      showStatus('Ready notifications disabled.');
      updateToggle();
      startPolling();
      return;
    }
    if (typeof Notification === 'undefined') {
      showStatus('Browser notifications are unavailable on this device.');
      return;
    }
    if (Notification.permission === 'denied') {
      showStatus('Notifications are blocked in this browser. Change the browser permission to enable them.');
      return;
    }
    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') {
        showStatus('Ready notifications were not enabled.');
        return;
      }
      if (!storeEnabled(true)) return;
      showStatus('Ready notifications are enabled while this page is open.');
      updateToggle();
      startPolling();
    } catch (error) {
      console.error('Could not request notification permission.', error);
      showStatus('Could not enable ready notifications.');
    }
  }

  if (toggle) toggle.addEventListener('click', toggleNotifications);
  window.addEventListener('storage', (event) => {
    if (event.key === ACTIVE_ORDER_KEY) loadActiveOrder();
    if (event.key === OPT_IN_KEY) {
      updateToggle();
      startPolling();
    }
  });

  window.FoodizoReadyNotifications = {
    setActiveOrder,
    notifyReady,
    clearActiveOrder
  };
  loadActiveOrder();
  updateToggle();
})();
