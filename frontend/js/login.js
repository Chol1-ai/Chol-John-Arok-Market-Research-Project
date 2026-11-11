(function () {
  'use strict';

  const F = window.Foodizo;
  const STATE = { pin: '', busy: false };

  const els = {
    phoneNumber: document.getElementById('staff-phone-number'),
    name: document.getElementById('active-user-name'),
    meta: document.getElementById('active-user-meta'),
    initials: document.getElementById('active-user-initials'),
    state: document.getElementById('active-user-state'),
    feedback: document.getElementById('pin-feedback'),
    unlock: document.getElementById('btn-unlock-pos'),
    clear: document.getElementById('pin-clear'),
    backspace: document.getElementById('pin-backspace'),
    apiState: document.getElementById('login-api-state'),
    dots: Array.from(document.querySelectorAll('.pin-dot'))
  };

  function setFeedback(message, tone) {
    els.feedback.textContent = message;
    const tones = {
      idle: 'font-label-sm text-label-sm text-on-surface-variant h-4',
      ready: 'font-label-sm text-label-sm text-tertiary font-bold h-4',
      error: 'font-label-sm text-label-sm text-primary font-bold h-4',
      success: 'font-label-sm text-label-sm text-tertiary font-bold h-4'
    };
    els.feedback.className = tones[tone] || tones.idle;
  }

  function updateDots() {
    els.dots.forEach((dot, index) => {
      if (index < STATE.pin.length) {
        dot.classList.remove('bg-surface-container');
        dot.classList.add('bg-primary', 'scale-125');
      } else {
        dot.classList.remove('bg-primary', 'scale-125');
        dot.classList.add('bg-surface-container');
      }
    });

    if (STATE.pin.length === 4) {
      setFeedback('PIN ready. Tap Sign in.', 'ready');
    } else {
      setFeedback('Enter your 4-digit PIN.', 'idle');
    }
  }

  function shakeDots() {
    els.dots.forEach((dot) => dot.classList.add('animate-bounce'));
    window.setTimeout(() => {
      els.dots.forEach((dot) => dot.classList.remove('animate-bounce'));
    }, 600);
  }

  function safeNextPath() {
    const value = new URLSearchParams(window.location.search).get('next');
    if (!value) return null;
    if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) return null;
    return value;
  }

  async function checkHealth() {
    const started = performance.now();
    try {
      const health = await F.request('/api/v1/health', { skipAuthRedirect: true });
      const latency = Math.max(1, Math.round(performance.now() - started));
      const state = health.status === 'UP' ? 'UP' : 'DOWN';
      els.apiState.textContent = state === 'UP' ? `API online · ${latency}ms` : 'API unavailable';
      els.apiState.closest('[data-action="check-health"]').dataset.healthState = state;
    } catch (_error) {
      els.apiState.textContent = 'API unavailable';
      els.apiState.closest('[data-action="check-health"]').dataset.healthState = 'DOWN';
    }
  }

  async function unlock() {
    if (STATE.busy) return;
    const phoneNumber = els.phoneNumber.value.trim();
    if (!phoneNumber) {
      setFeedback('Enter your staff mobile number.', 'error');
      els.phoneNumber.focus();
      return;
    }
    if (STATE.pin.length !== 4) {
      setFeedback('Enter the complete 4-digit PIN.', 'error');
      shakeDots();
      return;
    }

    STATE.busy = true;
    els.unlock.disabled = true;
    setFeedback('Verifying sign-in…', 'ready');
    els.state.textContent = 'Checking';
    els.state.className =
      'px-space-sm py-space-xs rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-bold flex-shrink-0';

    try {
      const user = await F.login(phoneNumber, STATE.pin);
      setFeedback(`Welcome ${user.fullName}. Opening ${user.roleLabel}…`, 'success');
      els.state.textContent = 'Signed in';
      els.state.className =
        'px-space-sm py-space-xs rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-bold flex-shrink-0';
      const next = safeNextPath();
      const target = next || user.homePath || F.homePath(user);
      window.setTimeout(() => window.location.replace(target), 350);
    } catch (error) {
      STATE.pin = '';
      updateDots();
      setFeedback(error.message || 'Unable to sign in with those details.', 'error');
      els.state.textContent = 'Retry';
      els.state.className =
        'px-space-sm py-space-xs rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-bold flex-shrink-0';
      shakeDots();
    } finally {
      STATE.busy = false;
      els.unlock.disabled = false;
    }
  }

  function wireEvents() {
    document.querySelectorAll('.pin-btn').forEach((button) => {
      button.addEventListener('click', () => {
        if (STATE.pin.length < 4) {
          STATE.pin += button.dataset.digit;
          updateDots();
        }
      });
    });

    els.backspace.addEventListener('click', () => {
      STATE.pin = STATE.pin.slice(0, -1);
      updateDots();
    });

    els.clear.addEventListener('click', () => {
      STATE.pin = '';
      updateDots();
    });

    els.unlock.addEventListener('click', unlock);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        unlock();
        return;
      }
      const tag = event.target && event.target.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (/^\d$/.test(event.key) && STATE.pin.length < 4) {
        STATE.pin += event.key;
        updateDots();
      } else if (event.key === 'Backspace') {
        STATE.pin = STATE.pin.slice(0, -1);
        updateDots();
      } else if (event.key === 'Escape') {
        STATE.pin = '';
        updateDots();
      }
    });
  }

  function init() {
    wireEvents();
    els.name.textContent = 'Staff sign-in';
    els.meta.textContent = 'Identity shown after sign-in';
    els.initials.textContent = 'ST';
    els.state.textContent = 'Ready';
    updateDots();
    checkHealth();
  }

  init();
})();
