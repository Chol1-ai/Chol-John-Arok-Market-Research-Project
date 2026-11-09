/**
 * Shared live-surface client for the Foodizo & Obunuzi staff terminals.
 *
 * The browser authenticates with the HttpOnly `foodizo_session` cookie. The
 * token returned by /auth/pin is also kept in sessionStorage as a Bearer
 * fallback for terminals where cookies are blocked, and for the WebSocket
 * query fallback supported by the backend.
 */
(function (global) {
  'use strict';

  const TOKEN_KEY = 'foodizo_token';
  const USER_KEY = 'foodizo_user';
  const ROLE_HOME = {
    CUSTOMER: '/',
    WAITER_FOH: '/pos',
    KITCHEN_STAFF: '/kds',
    MANAGER_ADMIN: '/admin'
  };
  const ROLE_LABEL = {
    CUSTOMER: 'Customer',
    WAITER_FOH: 'Waiter / FOH',
    KITCHEN_STAFF: 'Kitchen Staff',
    MANAGER_ADMIN: 'Manager / Admin'
  };
  const OUTLET_LABEL = {
    FOODIZO_HAM_TOWERS: 'Foodizo · Ham Towers',
    OBUNUZI_YMCA: 'Obunuzi · Opp. YMCA'
  };
  const STATUS_LABEL = {
    AWAITING_PAYMENT: 'Awaiting payment',
    PENDING: 'Queued',
    PREPARING: 'Preparing',
    READY: 'Ready',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    VACANT: 'Vacant',
    OCCUPIED: 'Occupied',
    BILL_REQUESTED: 'Bill requested',
    NEEDS_CLEARING: 'Needs clearing',
    REFUND_PENDING: 'Refund pending',
    REFUNDED: 'Refunded',
    SUCCESSFUL: 'Successful',
    FAILED: 'Failed',
    TIMED_OUT: 'Timed out',
    INITIATED: 'Initiated'
  };

  function readSession(key) {
    try {
      return global.sessionStorage.getItem(key);
    } catch (_err) {
      return null;
    }
  }

  function writeSession(key, value) {
    try {
      if (value === null || value === undefined) {
        global.sessionStorage.removeItem(key);
      } else {
        global.sessionStorage.setItem(key, value);
      }
    } catch (_err) {
      /* Storage can be disabled on locked-down terminals. */
    }
  }

  function getToken() {
    return readSession(TOKEN_KEY);
  }

  function getUser() {
    const raw = readSession(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }

  function setSession(token, user) {
    if (token) writeSession(TOKEN_KEY, token);
    if (user) writeSession(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    writeSession(TOKEN_KEY, null);
    writeSession(USER_KEY, null);
  }

  function homePath(user) {
    return (user && (user.homePath || ROLE_HOME[user.role])) || '/login';
  }

  function loginUrl(nextPath) {
    const next = nextPath || `${global.location.pathname}${global.location.search}`;
    return `/login?next=${encodeURIComponent(next)}`;
  }

  function redirectToLogin() {
    if (global.location.pathname === '/login') return;
    global.location.replace(loginUrl());
  }

  async function request(path, options) {
    const opts = Object.assign({}, options || {});
    const headers = new Headers(opts.headers || {});
    const token = getToken();

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (opts.body !== undefined && opts.body !== null && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(path, {
      credentials: 'include',
      ...opts,
      headers
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (_err) {
        payload = { message: text };
      }
    }

    if (!response.ok) {
      const error = new Error(
        (payload && (payload.message || payload.error)) ||
          `Request failed with HTTP ${response.status}`
      );
      error.status = response.status;
      error.code = payload && payload.code;
      error.payload = payload;

      if (response.status === 401 && !opts.skipAuthRedirect) {
        clearSession();
        redirectToLogin();
      }
      throw error;
    }

    return payload;
  }

  async function login(staffId, pin) {
    const data = await request('/api/v1/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ staffId, pin }),
      skipAuthRedirect: true
    });
    setSession(data.token, data.user);
    return data.user;
  }

  async function logout() {
    try {
      await request('/api/v1/auth/logout', {
        method: 'POST',
        skipAuthRedirect: true
      });
    } catch (_err) {
      /* The local session is cleared even if revocation is unreachable. */
    }
    clearSession();
    global.location.replace('/login');
  }

  async function me() {
    const data = await request('/api/v1/auth/me', { skipAuthRedirect: true });
    setSession(null, data.user);
    return data.user;
  }

  /**
   * Resolve the current session and enforce a role allow-list. Returns null
   * when the page is already navigating away.
   */
  async function guard(allowedRoles) {
    let user;
    try {
      user = await me();
    } catch (error) {
      if (error.status === 401) {
        redirectToLogin();
        return null;
      }
      toast(error.message || 'Could not reach the API.', 'error');
      throw error;
    }

    if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
      if (!allowedRoles.includes(user.role)) {
        global.location.replace(homePath(user));
        return null;
      }
    }

    return user;
  }

  function formatUGX(value) {
    return `UGX ${Math.round(Number(value) || 0).toLocaleString('en-UG')}`;
  }

  function formatNumber(value) {
    return Math.round(Number(value) || 0).toLocaleString('en-UG');
  }

  function formatTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString('en-UG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Africa/Kampala'
    });
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-UG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Africa/Kampala'
    });
  }

  function elapsedMinutes(value) {
    if (!value) return 0;
    const start = new Date(value).getTime();
    if (Number.isNaN(start)) return 0;
    return Math.max(0, Math.floor((Date.now() - start) / 60000));
  }

  function relativeTime(value) {
    const minutes = elapsedMinutes(value);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function statusLabel(status) {
    return STATUS_LABEL[status] || String(status || 'Unknown').replace(/_/g, ' ');
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initials(name) {
    return String(name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }

  function toast(message, type) {
    let stack = document.querySelector('.ls-toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'ls-toast-stack';
      document.body.appendChild(stack);
    }
    const item = document.createElement('div');
    item.className = `ls-toast ls-toast-${type || 'info'}`;
    item.setAttribute('role', 'status');
    item.textContent = message;
    stack.appendChild(item);
    global.setTimeout(() => {
      item.classList.add('is-leaving');
      global.setTimeout(() => item.remove(), 220);
    }, 4500);
  }

  /**
   * Authenticated realtime subscription with capped exponential reconnect.
   */
  function connectEvents(options) {
    const opts = options || {};
    let stopped = false;
    let attempt = 0;
    let socket = null;
    let timer = null;

    function schedule() {
      if (stopped || timer) return;
      const delay = Math.min(15000, 1000 * Math.pow(2, Math.min(attempt, 4)));
      timer = global.setTimeout(() => {
        timer = null;
        open();
      }, delay);
    }

    function open() {
      if (stopped) return;
      const params = new URLSearchParams();
      if (opts.outlet) params.set('outlet', opts.outlet);
      if (opts.station) params.set('station', opts.station);
      const token = getToken();
      if (token) params.set('token', token);

      const protocol = global.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${global.location.host}/ws/events?${params.toString()}`;

      if (typeof opts.onStatus === 'function') opts.onStatus('connecting');
      socket = new WebSocket(url);

      socket.addEventListener('open', () => {
        attempt = 0;
        if (typeof opts.onStatus === 'function') opts.onStatus('online');
      });

      socket.addEventListener('message', (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (_err) {
          return;
        }
        if (typeof opts.onEvent === 'function') opts.onEvent(message);
      });

      socket.addEventListener('close', (event) => {
        if (typeof opts.onStatus === 'function') opts.onStatus('offline');
        if (event.code === 1008) {
          clearSession();
          redirectToLogin();
          return;
        }
        attempt += 1;
        schedule();
      });

      socket.addEventListener('error', () => {
        if (socket && socket.readyState < 2) socket.close();
      });
    }

    open();

    return {
      close() {
        stopped = true;
        if (timer) {
          global.clearTimeout(timer);
          timer = null;
        }
        if (socket && socket.readyState < 2) socket.close();
      }
    };
  }

  function fillSessionChrome(user) {
    const nameNodes = document.querySelectorAll('[data-session-name]');
    const roleNodes = document.querySelectorAll('[data-session-role]');
    const outletNodes = document.querySelectorAll('[data-session-outlet]');
    const initialNodes = document.querySelectorAll('[data-session-initials]');
    const homeLinks = document.querySelectorAll('[data-session-home]');
    const role = user.role;

    nameNodes.forEach((node) => {
      node.textContent = user.fullName || 'Staff';
    });
    roleNodes.forEach((node) => {
      node.textContent = user.roleLabel || ROLE_LABEL[role] || role;
    });
    outletNodes.forEach((node) => {
      node.textContent = user.outlet ? OUTLET_LABEL[user.outlet] || user.outlet : 'Both outlets';
    });
    initialNodes.forEach((node) => {
      node.textContent = initials(user.fullName);
    });
    homeLinks.forEach((node) => {
      node.setAttribute('href', homePath(user));
    });

    document.documentElement.dataset.role = role;
  }

  global.Foodizo = {
    TOKEN_KEY,
    USER_KEY,
    ROLE_HOME,
    ROLE_LABEL,
    OUTLET_LABEL,
    request,
    login,
    logout,
    me,
    guard,
    getToken,
    getUser,
    setSession,
    clearSession,
    homePath,
    loginUrl,
    formatUGX,
    formatNumber,
    formatTime,
    formatDate,
    elapsedMinutes,
    relativeTime,
    statusLabel,
    escapeHtml,
    initials,
    toast,
    connectEvents,
    fillSessionChrome
  };

  const logoutButtons = document.querySelectorAll('[data-action="logout"]');
  logoutButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      logout();
    });
  });

  document.querySelectorAll('[data-action="scroll-top"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const reduceMotion =
        typeof global.matchMedia === 'function' &&
        global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      global.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  document.querySelectorAll('[data-action="check-health"]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (button.dataset.busy === 'true') return;
      const label = button.querySelector('[data-health-label]');
      const previous = label ? label.textContent : '';
      button.dataset.busy = 'true';
      button.disabled = true;
      if (label) label.textContent = 'Checking…';

      try {
        const started = global.performance ? global.performance.now() : Date.now();
        const health = await request('/api/v1/health', { skipAuthRedirect: true });
        const finished = global.performance ? global.performance.now() : Date.now();
        const latency = Math.max(1, Math.round(finished - started));
        const state = (health.status || 'UP').toUpperCase();
        button.dataset.healthState = state === 'UP' ? 'UP' : 'DOWN';
        if (label) label.textContent = `${state} · ${latency}ms`;
        toast(`API ${state} · ${latency}ms · ${health.service || 'Foodizo'}`, state === 'UP' ? 'success' : 'error');
      } catch (error) {
        button.dataset.healthState = 'DOWN';
        if (label) label.textContent = 'API unreachable';
        toast(error.message || 'API health check failed.', 'error');
      } finally {
        button.dataset.busy = 'false';
        button.disabled = false;
        if (label && previous && label.textContent === 'Checking…') {
          label.textContent = previous;
        }
      }
    });
  });
})(window);
