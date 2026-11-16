(function () {
  'use strict';

  const TOKEN_STORAGE_KEY = 'foodizo-rider-tracking-token-v1';
  const LOCATION_OPTIONS = {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 15000
  };
  const elements = {
    notice: document.getElementById('rider-notice'),
    session: document.getElementById('rider-session'),
    orderNumber: document.getElementById('rider-order-number'),
    destination: document.getElementById('rider-destination'),
    deliveryNote: document.getElementById('rider-delivery-note'),
    customerName: document.getElementById('rider-customer-name'),
    customerPhone: document.getElementById('rider-customer-phone'),
    phoneUnavailable: document.getElementById('rider-phone-unavailable'),
    callCustomer: document.getElementById('rider-call-customer'),
    openMap: document.getElementById('rider-open-map'),
    mapUnavailable: document.getElementById('rider-map-unavailable'),
    status: document.getElementById('rider-sharing-status'),
    lastUpdate: document.getElementById('rider-last-update'),
    refresh: document.getElementById('rider-refresh'),
    start: document.getElementById('rider-start'),
    pause: document.getElementById('rider-pause'),
    stop: document.getElementById('rider-stop')
  };
  const state = {
    token: '',
    session: null,
    watchId: null,
    busy: false,
    lastSentAt: 0
  };

  function showNotice(message) {
    elements.notice.textContent = message;
    elements.notice.hidden = false;
  }

  function hideNotice() {
    elements.notice.textContent = '';
    elements.notice.hidden = true;
  }

  function getTrackingToken() {
    const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
    const inviteToken = fragment.get('token') || '';
    if (/^[A-Za-z0-9_-]{43}$/.test(inviteToken)) {
      try {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, inviteToken);
      } catch (error) {
        showNotice(`Could not keep this invite open in the current tab: ${error.message}`);
      }
      history.replaceState(null, '', location.pathname);
      return inviteToken;
    }

    try {
      const savedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
      return /^[A-Za-z0-9_-]{43}$/.test(savedToken) ? savedToken : '';
    } catch (error) {
      showNotice(`Could not restore this rider invite: ${error.message}`);
      return '';
    }
  }

  async function request(path, options) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        Authorization: `Bearer ${state.token}`,
        ...(options && options.body ? { 'Content-Type': 'application/json' } : {}),
        ...((options && options.headers) || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `Tracking request failed (${response.status}).`);
      error.code = data.code;
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function stopWatching() {
    if (state.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(state.watchId);
      state.watchId = null;
    }
  }

  function renderSession(session) {
    state.session = session;
    elements.session.hidden = false;
    elements.orderNumber.textContent = `${session.tokenNumber} · ${session.orderNumber}`;
    elements.destination.textContent = session.destination || 'Destination not set';
    elements.deliveryNote.textContent = session.deliveryNote || 'No additional drop-off instructions.';
    elements.customerName.textContent = session.customerName || 'Name not provided';

    const phone = typeof session.customerPhone === 'string'
      ? session.customerPhone.replace(/[^\d+]/g, '')
      : '';
    const validPhone = /^\+?\d{7,15}$/.test(phone);
    elements.customerPhone.hidden = !validPhone;
    elements.phoneUnavailable.hidden = validPhone;
    elements.callCustomer.hidden = !validPhone;
    if (validPhone) {
      elements.customerPhone.href = `tel:${phone}`;
      elements.customerPhone.textContent = phone.startsWith('+') ? phone : `+${phone}`;
      elements.callCustomer.href = `tel:${phone}`;
    }

    const mapLink = typeof session.mapLink === 'string' ? session.mapLink : '';
    let safeMapLink = '';
    try {
      const parsedMapLink = new URL(mapLink);
      if (
        parsedMapLink.protocol === 'https:' &&
        parsedMapLink.hostname === 'www.google.com' &&
        parsedMapLink.pathname === '/maps/search/'
      ) {
        safeMapLink = parsedMapLink.href;
      }
    } catch (error) {
      if (mapLink) console.error('The delivery map link is invalid.', error);
    }
    elements.openMap.hidden = !safeMapLink;
    elements.mapUnavailable.hidden = Boolean(safeMapLink);
    if (safeMapLink) elements.openMap.href = safeMapLink;

    const labels = {
      INVITED: 'Ready when you are — GPS is off',
      SHARING: 'Your latest GPS location is being shared',
      PAUSED: 'Location sharing is paused',
      STOPPED: 'Location sharing has ended'
    };
    elements.status.dataset.status = session.status;
    elements.status.textContent = labels[session.status] || 'Tracking status unavailable';
    elements.lastUpdate.textContent = session.locationUpdatedAt
      ? `Last location sent at ${new Date(session.locationUpdatedAt).toLocaleTimeString()}.`
      : 'No location has been shared yet.';

    elements.start.hidden = session.status === 'STOPPED' || session.status === 'SHARING';
    elements.start.textContent = session.status === 'PAUSED'
      ? 'Resume GPS sharing'
      : 'Start GPS sharing';
    elements.pause.hidden = session.status !== 'SHARING';
    elements.stop.hidden = session.status === 'STOPPED';
  }

  async function loadSession() {
    try {
      const data = await request('/api/v1/delivery-tracking/rider/session');
      renderSession(data);
    } catch (error) {
      if (error.code === 'TRACKING_SESSION_CLOSED') {
        stopWatching();
        state.token = '';
        try {
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        } catch (storageError) {
          console.error('Could not clear the expired rider invite from this tab.', storageError);
        }
        if (state.session) {
          renderSession({ ...state.session, status: 'STOPPED', locationUpdatedAt: null });
        }
      }
      throw error;
    }
  }

  async function refreshSession() {
    if (state.busy) return;
    state.busy = true;
    elements.refresh.disabled = true;
    hideNotice();
    try {
      await loadSession();
    } catch (error) {
      showNotice(error.message);
    } finally {
      state.busy = false;
      elements.refresh.disabled = false;
    }
  }

  function positionErrorMessage(error) {
    if (error.code === 1) return 'Location permission was denied. Allow location access in Android settings, then try again.';
    if (error.code === 2) return 'Your phone could not determine its location. Check GPS and try again.';
    if (error.code === 3) return 'Getting a GPS fix took too long. Move outdoors and try again.';
    return error.message || 'Could not read the phone location.';
  }

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, LOCATION_OPTIONS);
    });
  }

  async function sendPosition(position) {
    if (!state.session || state.session.status !== 'SHARING') return;
    const now = Date.now();
    if (now - state.lastSentAt < 8000) return;
    state.lastSentAt = now;
    const coords = position.coords;
    try {
      const result = await request('/api/v1/delivery-tracking/rider/location', {
        method: 'POST',
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracyM: Math.round(coords.accuracy * 10) / 10,
          speedMps: coords.speed === null ? null : Math.round(coords.speed * 100) / 100,
          headingDegrees: coords.heading === null
            ? null
            : Math.min(359.99, Math.round(coords.heading * 100) / 100)
        })
      });
      elements.lastUpdate.textContent =
        `Location sent at ${new Date(result.updatedAt).toLocaleTimeString()}.`;
      hideNotice();
    } catch (error) {
      if (error.code === 'TRACKING_NOT_ACTIVE') {
        stopWatching();
        try {
          await loadSession();
        } catch (refreshError) {
          showNotice(refreshError.message);
        }
      } else {
        showNotice(`Location update failed: ${error.message}`);
      }
    }
  }

  function startWatching(initialPosition) {
    if (!navigator.geolocation) {
      showNotice('This browser does not support GPS location sharing.');
      return;
    }
    stopWatching();
    state.lastSentAt = 0;
    state.watchId = navigator.geolocation.watchPosition(
      (position) => sendPosition(position),
      (error) => {
        showNotice(positionErrorMessage(error));
        if (error.code === 1) {
          stopWatching();
          setSharingStatus('PAUSED').catch((statusError) => {
            showNotice(`Location permission was revoked; sharing status could not be updated: ${statusError.message}`);
          });
        }
      },
      LOCATION_OPTIONS
    );
    if (initialPosition) sendPosition(initialPosition);
  }

  async function setSharingStatus(status) {
    const data = await request('/api/v1/delivery-tracking/rider/session', {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    state.session.status = data.status;
    renderSession(state.session);
  }

  async function startSharing() {
    if (
      state.busy ||
      !state.session ||
      state.session.status === 'STOPPED' ||
      state.session.status === 'SHARING'
    ) return;
    if (!navigator.geolocation) {
      showNotice('This browser does not support GPS location sharing.');
      return;
    }
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      showNotice('GPS sharing requires a secure HTTPS connection. Open this invite using the secure Foodizo link.');
      return;
    }

    state.busy = true;
    elements.start.disabled = true;
    hideNotice();
    try {
      const firstPosition = await getCurrentPosition();
      await setSharingStatus('SHARING');
      startWatching(firstPosition);
    } catch (error) {
      showNotice(positionErrorMessage(error));
    } finally {
      state.busy = false;
      elements.start.disabled = false;
    }
  }

  async function pauseSharing() {
    if (state.busy || !state.session || state.session.status !== 'SHARING') return;
    state.busy = true;
    elements.pause.disabled = true;
    stopWatching();
    try {
      await setSharingStatus('PAUSED');
      hideNotice();
    } catch (error) {
      showNotice(error.message);
      try {
        await loadSession();
        if (state.session.status === 'SHARING') startWatching();
      } catch (refreshError) {
        showNotice(`Could not confirm tracking status: ${refreshError.message}`);
      }
    } finally {
      state.busy = false;
      elements.pause.disabled = false;
    }
  }

  async function stopSharing() {
    if (
      state.busy ||
      !state.session ||
      state.session.status === 'STOPPED' ||
      !window.confirm('Stop sharing your location for this delivery? This cannot be undone.')
    ) return;
    state.busy = true;
    elements.stop.disabled = true;
    stopWatching();
    try {
      await setSharingStatus('STOPPED');
      state.token = '';
      try {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      } catch (storageError) {
        console.error('Could not clear the stopped rider invite from this tab.', storageError);
        showNotice(`Sharing ended, but this tab could not clear the saved invite: ${storageError.message}`);
        return;
      }
      hideNotice();
    } catch (error) {
      showNotice(error.message);
    } finally {
      state.busy = false;
      elements.stop.disabled = false;
    }
  }

  elements.start.addEventListener('click', startSharing);
  elements.pause.addEventListener('click', pauseSharing);
  elements.stop.addEventListener('click', stopSharing);
  elements.refresh.addEventListener('click', refreshSession);

  state.token = getTrackingToken();
  if (!state.token) {
    showNotice('This page needs the private rider invite link sent by dispatch. Ask the dispatcher to share it again.');
  } else {
    loadSession().catch((error) => showNotice(error.message));
  }
})();
