(function () {
  'use strict';

  const F = window.Foodizo;
  const ROLE_ORDER = { MANAGER_ADMIN: 0, WAITER_FOH: 1, KITCHEN_STAFF: 2 };
  const ROLE_ICON = {
    MANAGER_ADMIN: 'shield_person',
    WAITER_FOH: 'room_service',
    KITCHEN_STAFF: 'skillet'
  };
  const ROLE_AVATAR = {
    MANAGER_ADMIN: 'bg-secondary-container text-on-secondary-container',
    WAITER_FOH: 'bg-primary-container text-on-primary-container',
    KITCHEN_STAFF: 'bg-tertiary-container text-on-tertiary-container'
  };
  const ROLE_BADGE = {
    MANAGER_ADMIN: 'bg-secondary-fixed text-on-secondary-fixed',
    WAITER_FOH: 'bg-primary-fixed text-on-primary-fixed',
    KITCHEN_STAFF: 'bg-tertiary-fixed text-on-tertiary-fixed'
  };
  const FILTER_ACTIVE =
    'staff-filter px-space-md py-space-xs rounded-full font-label-md text-label-md bg-inverse-surface text-inverse-on-surface shadow-sm';
  const FILTER_IDLE =
    'staff-filter px-space-md py-space-xs rounded-full font-label-md text-label-md bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors';

  const STATE = {
    staff: [],
    selected: null,
    pin: '',
    filterKind: 'all',
    filterValue: 'ALL',
    busy: false
  };

  const els = {
    grid: document.getElementById('staff-grid'),
    filters: document.getElementById('staff-filters'),
    count: document.getElementById('staff-count'),
    name: document.getElementById('active-user-name'),
    meta: document.getElementById('active-user-meta'),
    initials: document.getElementById('active-user-initials'),
    state: document.getElementById('active-user-state'),
    feedback: document.getElementById('pin-feedback'),
    unlock: document.getElementById('btn-unlock-pos'),
    clear: document.getElementById('pin-clear'),
    backspace: document.getElementById('pin-backspace'),
    staffMetric: document.getElementById('metric-staff'),
    outletMetric: document.getElementById('metric-outlets'),
    apiMetric: document.getElementById('metric-api'),
    apiLatency: document.getElementById('metric-api-latency'),
    apiState: document.getElementById('login-api-state'),
    businessDay: document.getElementById('login-business-day'),
    dots: Array.from(document.querySelectorAll('.pin-dot'))
  };

  function businessDateLabel() {
    const eat = new Date(Date.now() + 3 * 60 * 60 * 1000);
    if (eat.getUTCHours() < 5) {
      eat.setUTCDate(eat.getUTCDate() - 1);
    }
    return `Business date ${eat.toISOString().slice(0, 10)} · resets 05:00 EAT`;
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
      setFeedback('4-digit PIN ready. Tap Sign in.', 'ready');
    } else {
      setFeedback(
        STATE.selected ? 'Enter the 4-digit PIN for this profile.' : 'Select a staff profile first.',
        'idle'
      );
    }
  }

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

  function filteredStaff() {
    return STATE.staff.filter((member) => {
      if (STATE.filterKind === 'outlet') {
        return member.outlet === STATE.filterValue;
      }
      if (STATE.filterKind === 'role') {
        return member.role === STATE.filterValue;
      }
      return true;
    });
  }

  function renderStaff() {
    const visible = filteredStaff();
    const totalLabel = STATE.staff.length === 1 ? '1 active account' : `${STATE.staff.length} active accounts`;
    els.count.textContent = `(${totalLabel})`;

    if (!visible.length) {
      els.grid.innerHTML =
        '<div class="sm:col-span-2 p-space-md rounded-xl bg-surface-container-lowest text-on-surface-variant font-body-sm text-body-sm">No active staff match this filter.</div>';
      return;
    }

    els.grid.innerHTML = visible
      .slice()
      .sort((a, b) => {
        const roleDelta = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
        return roleDelta !== 0 ? roleDelta : a.fullName.localeCompare(b.fullName);
      })
      .map((member) => {
        const selected = STATE.selected && STATE.selected.id === member.id;
        const outlet = member.outlet ? F.OUTLET_LABEL[member.outlet] : 'Both outlets';
        const avatarClass = ROLE_AVATAR[member.role] || 'bg-surface-container text-on-surface';
        const badgeClass = ROLE_BADGE[member.role] || 'bg-surface-container text-on-surface-variant';
        return `
          <button class="staff-card text-left p-space-md rounded-xl ${
            selected ? 'bg-surface-container-high ring-2 ring-primary shadow-md' : 'bg-surface-container-lowest shadow-sm'
          } hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-between group"
            data-staff-id="${F.escapeHtml(member.id)}" type="button">
            <div class="flex items-center gap-space-md min-w-0">
              <div class="w-12 h-12 rounded-full ${avatarClass} flex items-center justify-center flex-shrink-0">
                <span class="font-headline-sm text-headline-sm font-extrabold">${F.escapeHtml(member.initials)}</span>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-space-xs flex-wrap">
                  <span class="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors truncate">${F.escapeHtml(
                    member.fullName
                  )}</span>
                  <span class="px-space-xs py-0.5 rounded ${badgeClass} font-label-sm text-label-sm font-bold">${F.escapeHtml(
                    member.roleLabel
                  )}</span>
                </div>
                <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${F.escapeHtml(
                  outlet
                )} · ${F.escapeHtml(member.role === 'MANAGER_ADMIN' ? 'admin console' : member.role === 'KITCHEN_STAFF' ? 'kitchen display' : 'floor POS')}</p>
                <p class="font-label-sm text-label-sm ${selected ? 'text-primary' : 'text-on-surface-variant'} font-semibold">${
                  selected ? 'Selected · enter PIN' : 'Tap to select'
                }</p>
              </div>
            </div>
            <div class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant group-hover:bg-primary-container group-hover:text-on-primary-container transition-colors flex-shrink-0">
              <span class="material-symbols-outlined text-[20px]">${ROLE_ICON[member.role] || 'chevron_right'}</span>
            </div>
          </button>`;
      })
      .join('');
  }

  function selectStaff(staffId) {
    const member = STATE.staff.find((row) => row.id === staffId);
    if (!member) return;
    STATE.selected = member;
    STATE.pin = '';
    els.name.textContent = member.fullName;
    els.meta.textContent = `${member.roleLabel} · ${member.outlet ? F.OUTLET_LABEL[member.outlet] : 'Both outlets'}`;
    els.initials.textContent = member.initials;
    els.state.textContent = 'Ready';
    els.state.className =
      'px-space-sm py-space-xs rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-bold flex-shrink-0';
    renderStaff();
    updateDots();
  }

  function resetSelection() {
    STATE.selected = null;
    STATE.pin = '';
    els.name.textContent = 'Select staff profile';
    els.meta.textContent = 'Choose a roster card to continue';
    els.initials.textContent = '--';
    els.state.textContent = 'Idle';
    els.state.className =
      'px-space-sm py-space-xs rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-bold flex-shrink-0';
    updateDots();
  }

  async function loadDirectory() {
    const data = await F.request('/api/v1/auth/terminal-staff', { skipAuthRedirect: true });
    STATE.staff = (data.staff || []).map((member) => ({
      ...member,
      initials: member.initials || F.initials(member.fullName)
    }));
    els.staffMetric.textContent = String(STATE.staff.length);
    const outlets = new Set(STATE.staff.map((member) => member.outlet).filter(Boolean));
    els.outletMetric.textContent = String(outlets.size);
    renderStaff();
    updateDots();
    return STATE.staff;
  }

  async function checkHealth() {
    const started = performance.now();
    try {
      const health = await F.request('/api/v1/health', { skipAuthRedirect: true });
      const latency = Math.max(1, Math.round(performance.now() - started));
      els.apiMetric.textContent = health.status === 'UP' ? 'UP' : health.status || '—';
      els.apiLatency.textContent = `API: ${latency}ms`;
      els.apiState.textContent = `Live API connected · ${latency}ms`;
    } catch (_error) {
      els.apiMetric.textContent = 'DOWN';
      els.apiLatency.textContent = 'API: unreachable';
      els.apiState.textContent = 'Live API unreachable';
    }
  }

  async function unlock() {
    if (STATE.busy) return;
    if (!STATE.selected) {
      setFeedback('Select your staff profile first.', 'error');
      shakeDots();
      return;
    }
    if (STATE.pin.length !== 4) {
      setFeedback('Enter the complete 4-digit PIN.', 'error');
      shakeDots();
      return;
    }

    STATE.busy = true;
    els.unlock.disabled = true;
    setFeedback('Verifying PIN against the live staff database…', 'ready');
    els.state.textContent = 'Checking';
    els.state.className =
      'px-space-sm py-space-xs rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-bold flex-shrink-0';

    try {
      const user = await F.login(STATE.selected.id, STATE.pin);
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
      const attempts =
        error.payload && error.payload.attemptsRemaining !== undefined
          ? ` ${error.payload.attemptsRemaining} attempt(s) remaining before lockout.`
          : '';
      setFeedback(`${error.message || 'PIN authentication failed.'}${attempts}`, 'error');
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
    els.grid.addEventListener('click', (event) => {
      const card = event.target.closest('[data-staff-id]');
      if (card) selectStaff(card.dataset.staffId);
    });

    els.filters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-filter-kind]');
      if (!button) return;
      STATE.filterKind = button.dataset.filterKind;
      STATE.filterValue = button.dataset.filterValue;
      els.filters.querySelectorAll('[data-filter-kind]').forEach((item) => {
        item.className = item === button ? FILTER_ACTIVE : FILTER_IDLE;
      });
      const visible = filteredStaff();
      if (STATE.selected && !visible.some((member) => member.id === STATE.selected.id)) {
        resetSelection();
      }
      renderStaff();
    });

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
      const tag = event.target && event.target.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (/^\d$/.test(event.key) && STATE.pin.length < 4) {
        STATE.pin += event.key;
        updateDots();
      } else if (event.key === 'Backspace') {
        STATE.pin = STATE.pin.slice(0, -1);
        updateDots();
      } else if (event.key === 'Enter') {
        unlock();
      } else if (event.key === 'Escape') {
        STATE.pin = '';
        updateDots();
      }
    });
  }

  async function init() {
    els.businessDay.textContent = businessDateLabel();
    wireEvents();
    resetSelection();
    updateDots();
    checkHealth();
    try {
      await loadDirectory();
    } catch (error) {
      els.grid.innerHTML = `<div class="sm:col-span-2 p-space-md rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm">${F.escapeHtml(
        error.message || 'Could not load the live staff directory.'
      )}</div>`;
      setFeedback('Live staff directory unavailable. Check the API server.', 'error');
    }
  }

  init();
})();
