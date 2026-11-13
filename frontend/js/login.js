(function () {
  'use strict';

  const F = window.Foodizo;
  const STATE = { pin: '', busy: false };

  const els = {
    phoneNumber: document.getElementById('staff-phone-number'),
    feedback: document.getElementById('pin-feedback'),
    unlock: document.getElementById('btn-unlock-pos'),
    clear: document.getElementById('pin-clear'),
    backspace: document.getElementById('pin-backspace'),
    dots: Array.from(document.querySelectorAll('.pin-dot'))
  };

  function setFeedback(message, tone) {
    els.feedback.textContent = message;
    const supportedTone = ['idle', 'ready', 'error', 'success'].includes(tone) ? tone : 'idle';
    els.feedback.className = `pin-feedback pin-feedback--${supportedTone}`;
  }

  function updateDots() {
    els.dots.forEach((dot, index) => {
      dot.classList.toggle('is-filled', index < STATE.pin.length);
    });

    setFeedback('', 'idle');
  }

  function shakeDots() {
    els.dots.forEach((dot) => dot.classList.add('is-shaking'));
    window.setTimeout(() => {
      els.dots.forEach((dot) => dot.classList.remove('is-shaking'));
    }, 600);
  }

  function safeNextPath() {
    const value = new URLSearchParams(window.location.search).get('next');
    if (!value) return null;
    if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) return null;
    return value;
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

    try {
      const user = await F.login(phoneNumber, STATE.pin);
      setFeedback(`Welcome ${user.fullName}. Opening ${user.roleLabel}…`, 'success');
      const next = safeNextPath();
      const target = next || user.homePath || F.homePath(user);
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      await F.navigateTo(target);
    } catch (error) {
      STATE.pin = '';
      updateDots();
      setFeedback(error.message || 'Unable to sign in with those details.', 'error');
      shakeDots();
    } finally {
      STATE.busy = false;
      els.unlock.disabled = false;
    }
  }

  function wireEvents() {
    document.querySelectorAll('.pin-btn[data-digit]').forEach((button) => {
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

  async function restoreSession() {
    if (!F.getToken()) return;

    STATE.busy = true;
    els.unlock.disabled = true;
    setFeedback('Restoring staff session…', 'ready');

    try {
      const user = await F.me();
      const next = safeNextPath();
      const target = next || user.homePath || F.homePath(user);
      await F.navigateTo(target);
    } catch (error) {
      if (error.status === 401) F.clearSession();
      setFeedback(error.message || 'Could not restore the staff session.', 'error');
    } finally {
      STATE.busy = false;
      els.unlock.disabled = false;
    }
  }

  function init() {
    wireEvents();
    updateDots();
    restoreSession();
  }

  init();
})();
