(function () {
  'use strict';

  const F = window.Foodizo;
  const STATIONS = new Set(['ALL', 'STEAM_LINE', 'GRILL_FRYER', 'ROLEX_GRIDDLE', 'BAR_BEVERAGE']);
  const CHANNELS = new Set(['ALL', 'DINE_IN', 'TAKEAWAY_PICKUP', 'PHONE_DELIVERY']);
  const VIEWS = new Set(['home', 'status', 'completed', 'settings']);
  const DEFAULT_PREFERENCES = {
    station: 'ALL',
    soundEnabled: false,
    autoRefresh: true,
    compactMode: false
  };
  const STATE = {
    user: null,
    view: 'home',
    station: 'ALL',
    channel: 'ALL',
    statusFilter: 'ALL',
    historyFilter: 'ALL',
    preferences: Object.assign({}, DEFAULT_PREFERENCES),
    activeTickets: [],
    readyTickets: [],
    completedTickets: [],
    events: null,
    refreshTimer: null,
    pollTimer: null,
    clockTimer: null,
    loadGeneration: 0,
    lastLoadError: '',
    lastUpdated: null,
    connectionStatus: 'connecting',
    audioContext: null,
    busy: new Set()
  };

  const els = {
    homeView: document.getElementById('kds-view-home'),
    statusView: document.getElementById('kds-view-status'),
    completedView: document.getElementById('kds-view-completed'),
    settingsView: document.getElementById('kds-view-settings'),
    homeBoard: document.getElementById('kds-board'),
    statusBoard: document.getElementById('kds-status-board'),
    completedBoard: document.getElementById('kds-completed-board'),
    stationFilters: document.getElementById('kds-station-filters'),
    channelFilters: document.getElementById('kds-channel-filters'),
    statusFilters: document.getElementById('kds-status-filters'),
    historyFilters: document.getElementById('kds-history-filters'),
    statusSearch: document.getElementById('kds-status-search'),
    completedSearch: document.getElementById('kds-completed-search'),
    soundButton: document.getElementById('kds-sound-button'),
    settingsForm: document.getElementById('kds-settings-form'),
    defaultStation: document.getElementById('kds-default-station'),
    soundSetting: document.getElementById('kds-sound-enabled'),
    autoRefreshSetting: document.getElementById('kds-auto-refresh'),
    compactSetting: document.getElementById('kds-compact-mode'),
    settingsFeedback: document.getElementById('kds-settings-feedback'),
    lastUpdated: document.getElementById('kds-last-updated')
  };

  function stationLabel(station) {
    const labels = {
      STEAM_LINE: 'Steam',
      GRILL_FRYER: 'Grill & Fryer',
      ROLEX_GRIDDLE: 'Rolex',
      BAR_BEVERAGE: 'Bar & Beverage'
    };
    return labels[station] || 'All stations';
  }

  function channelLabel(channel) {
    const labels = {
      DINE_IN: 'Dine in',
      TAKEAWAY_PICKUP: 'Takeaway',
      PHONE_DELIVERY: 'Delivery'
    };
    return labels[channel] || 'Order';
  }

  function statusLabel(status) {
    const labels = {
      PENDING: 'New order',
      PREPARING: 'Preparing',
      READY: 'Ready for handoff',
      COMPLETED: 'Handed off'
    };
    return labels[status] || F.statusLabel(status);
  }

  function preferenceKey() {
    return `foodizo.kds.preferences.v1:${STATE.user.id}`;
  }

  function normalizePreferences(value) {
    const preferences = Object.assign({}, DEFAULT_PREFERENCES);
    if (!value || typeof value !== 'object') return preferences;
    if (STATIONS.has(value.station)) preferences.station = value.station;
    preferences.soundEnabled = value.soundEnabled === true;
    preferences.autoRefresh = value.autoRefresh !== false;
    preferences.compactMode = value.compactMode === true;
    return preferences;
  }

  function loadPreferences() {
    try {
      const saved = window.localStorage.getItem(preferenceKey());
      STATE.preferences = saved ? normalizePreferences(JSON.parse(saved)) : Object.assign({}, DEFAULT_PREFERENCES);
    } catch (error) {
      STATE.preferences = Object.assign({}, DEFAULT_PREFERENCES);
      F.toast(`Saved kitchen preferences could not be read: ${error.message}`, 'error');
    }
    STATE.station = STATE.preferences.station;
    applyPreferencesToControls();
  }

  function savePreferences(preferences) {
    const normalized = normalizePreferences(preferences);
    try {
      window.localStorage.setItem(preferenceKey(), JSON.stringify(normalized));
    } catch (error) {
      throw new Error(`Kitchen preferences could not be saved: ${error.message}`);
    }
    STATE.preferences = normalized;
    applyPreferencesToControls();
  }

  function applyPreferencesToControls() {
    document.body.classList.toggle('is-compact', STATE.preferences.compactMode);
    els.defaultStation.value = STATE.preferences.station;
    els.soundSetting.checked = STATE.preferences.soundEnabled;
    els.autoRefreshSetting.checked = STATE.preferences.autoRefresh;
    els.compactSetting.checked = STATE.preferences.compactMode;
    els.soundButton.setAttribute('aria-pressed', String(STATE.preferences.soundEnabled));
    els.soundButton.setAttribute(
      'aria-label',
      STATE.preferences.soundEnabled ? 'Turn sound alerts off' : 'Turn sound alerts on'
    );
    els.soundButton.querySelector('.material-symbols-outlined').textContent =
      STATE.preferences.soundEnabled ? 'volume_up' : 'volume_off';
  }

  function renderClock() {
    const now = new Date();
    document.getElementById('kds-clock-time').textContent = now.toLocaleTimeString('en-UG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Kampala'
    });
    document.getElementById('kds-clock-date').textContent = now.toLocaleDateString('en-UG', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Africa/Kampala'
    });
  }

  function setConnectionStatus(status) {
    STATE.connectionStatus = status;
    const label = status === 'online' ? 'Kitchen online' : status === 'offline' ? 'Reconnecting' : 'Connecting';
    document.getElementById('kds-connection-label').textContent = label;
    const state = status === 'online' ? 'online' : status === 'offline' ? 'offline' : 'connecting';
    document.querySelectorAll('.kds-connection-dot').forEach((dot) => {
      dot.dataset.state = state;
    });
  }

  function updateLastUpdated() {
    STATE.lastUpdated = new Date();
    els.lastUpdated.textContent = `Updated ${STATE.lastUpdated.toLocaleTimeString('en-UG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Kampala'
    })}`;
  }

  function renderSummary(summary) {
    const counts = summary || {};
    document.getElementById('kds-count-new').textContent = String(counts.newOrders ?? 0);
    document.getElementById('kds-count-preparing').textContent = String(counts.preparing ?? 0);
    document.getElementById('kds-count-ready').textContent = String(counts.ready ?? 0);
    document.getElementById('kds-count-overdue').textContent = String(counts.overdue ?? 0);
    document.getElementById('kds-nav-active-count').textContent = String(
      (counts.newOrders || 0) + (counts.preparing || 0) + (counts.ready || 0)
    );
    document.getElementById('kds-orders-today').textContent = F.formatNumber(counts.ordersToday || 0);
    document.getElementById('kds-average-prep').textContent =
      counts.averagePrepMinutes === null || counts.averagePrepMinutes === undefined
        ? '—'
        : `${counts.averagePrepMinutes} min`;
    document.getElementById('kds-service-rate').textContent =
      counts.serviceRate === null || counts.serviceRate === undefined ? '—' : `${counts.serviceRate}%`;
  }

  function updatePressed(container, attribute, value) {
    container.querySelectorAll(`[${attribute}]`).forEach((button) => {
      button.setAttribute('aria-pressed', String(button.getAttribute(attribute) === value));
    });
  }

  function setView(view, options) {
    if (!VIEWS.has(view)) view = 'home';
    const viewChanged = STATE.view !== view;
    STATE.view = view;
    const panels = {
      home: els.homeView,
      status: els.statusView,
      completed: els.completedView,
      settings: els.settingsView
    };
    Object.keys(panels).forEach((key) => {
      panels[key].hidden = key !== view;
    });
    document.querySelectorAll('[data-view-button]').forEach((button) => {
      const active = button.dataset.viewButton === view;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if ((!options || options.navigate !== false) && viewChanged) {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}#${view}`);
    }
    refreshDashboard({ quiet: true });
  }

  function ticketsUrl(status, limit) {
    const params = new URLSearchParams();
    if (STATE.station !== 'ALL') params.set('station', STATE.station);
    if (status) params.set('status', status);
    if (limit) params.set('limit', String(limit));
    return `/api/v1/kds/tickets${params.toString() ? `?${params.toString()}` : ''}`;
  }

  async function fetchTickets(status, limit) {
    const data = await F.request(ticketsUrl(status, limit));
    if (!Array.isArray(data.tickets)) {
      throw new Error('The kitchen ticket response was incomplete.');
    }
    return data.tickets;
  }

  function loadingMarkup() {
    return '<div class="kds-empty"><span class="material-symbols-outlined" aria-hidden="true">hourglass_top</span><strong>Loading kitchen tickets</strong><p>Connecting to the live order queue…</p></div>';
  }

  function errorMarkup(error) {
    return `<div class="kds-error"><span class="material-symbols-outlined" aria-hidden="true">cloud_off</span><strong>Kitchen board unavailable</strong><p>${F.escapeHtml(
      error.message || 'Could not load live kitchen data.'
    )}</p><button class="kds-secondary-button" type="button" data-kds-retry><span class="material-symbols-outlined" aria-hidden="true">refresh</span> Try again</button></div>`;
  }

  function showBoardsLoading() {
    const activeBoards = [els.homeBoard, els.statusBoard, els.completedBoard];
    activeBoards.forEach((board) => {
      board.setAttribute('aria-busy', 'true');
      board.innerHTML = loadingMarkup();
    });
  }

  function showBoardsError(error) {
    const boards = {
      home: [els.homeBoard],
      status: [els.statusBoard],
      completed: [els.completedBoard]
    };
    (boards[STATE.view] || []).forEach((board) => {
      board.setAttribute('aria-busy', 'false');
      board.innerHTML = errorMarkup(error);
    });
  }

  async function loadCurrentView() {
    const generation = ++STATE.loadGeneration;
    const summaryPromise = F.request('/api/v1/kds/summary');
    const dataPromises = [];

    if (STATE.view === 'home') {
      dataPromises.push(fetchTickets());
    } else if (STATE.view === 'status') {
      dataPromises.push(fetchTickets(), fetchTickets('READY', 100));
    } else if (STATE.view === 'completed') {
      dataPromises.push(fetchTickets('READY', 100), fetchTickets('COMPLETED', 100));
    }

    showBoardsLoading();
    let responses;
    try {
      responses = await Promise.all([summaryPromise, ...dataPromises]);
    } catch (error) {
      if (generation !== STATE.loadGeneration) return;
      throw error;
    }
    const [summary, ...ticketSets] = responses;
    if (generation !== STATE.loadGeneration) return;

    renderSummary(summary.summary);
    if (STATE.view === 'home') {
      STATE.activeTickets = ticketSets[0];
    } else if (STATE.view === 'status') {
      STATE.activeTickets = ticketSets[0];
      STATE.readyTickets = ticketSets[1];
    } else if (STATE.view === 'completed') {
      STATE.completedTickets = [...ticketSets[0], ...ticketSets[1]]
        .sort((a, b) => new Date(b.readyAt || b.completedAt || b.createdAt) - new Date(a.readyAt || a.completedAt || a.createdAt));
    }
    renderCurrentView();
    updateLastUpdated();
    STATE.lastLoadError = '';
  }

  function currentElapsed(ticket) {
    return ticket.createdAt ? F.elapsedMinutes(ticket.createdAt) : Number(ticket.elapsedMinutes) || 0;
  }

  function ticketMatchesSearch(ticket, value) {
    if (!value) return true;
    const query = value.toLowerCase();
    return [ticket.tokenNumber, ticket.orderNumber, ...(ticket.items || []).map((item) => item.name)]
      .join(' ')
      .toLowerCase()
      .includes(query);
  }

  function isOverdue(ticket) {
    return ['PENDING', 'PREPARING'].includes(ticket.status) &&
      (ticket.isOverdue || currentElapsed(ticket) >= 10);
  }

  function ticketAction(ticket, mode) {
    if (mode !== 'active') return '';
    const busy = STATE.busy.has(ticket.id);
    if (ticket.status === 'PENDING') {
      return `<button class="kds-ticket-action" type="button" data-ticket-id="${F.escapeHtml(ticket.id)}" data-ticket-action="claim" ${
        busy ? 'disabled' : ''
      }><span class="material-symbols-outlined" aria-hidden="true">restaurant</span><span>${busy ? 'Starting…' : 'Start preparing'}</span></button>`;
    }
    if (ticket.status === 'PREPARING') {
      return `<button class="kds-ticket-action" type="button" data-ticket-id="${F.escapeHtml(ticket.id)}" data-ticket-action="bump" ${
        busy ? 'disabled' : ''
      }><span class="material-symbols-outlined" aria-hidden="true">task_alt</span><span>${busy ? 'Updating…' : 'Mark ready'}</span></button>`;
    }
    return '';
  }

  function renderTicket(ticket, mode) {
    const overdue = isOverdue(ticket);
    const items = (ticket.items || []).map((item) => `
      <div class="kds-item">
        <span class="kds-item-qty">${F.escapeHtml(item.quantity)}</span>
        <div>
          <div class="kds-item-name">${F.escapeHtml(item.name)}</div>
          <div class="kds-item-meta">${F.escapeHtml(stationLabel(item.station))}${item.notes ? ` · ${F.escapeHtml(item.notes)}` : ''}</div>
        </div>
      </div>`).join('');
    const statusIcon = ticket.status === 'PENDING' ? 'notifications_active' :
      ticket.status === 'PREPARING' ? 'soup_kitchen' : 'check_circle';
    const destinationIcon = ticket.channel === 'DINE_IN' ? 'chair' :
      ticket.channel === 'PHONE_DELIVERY' ? 'delivery_dining' : 'takeout_dining';
    const terminalTime = ticket.status === 'COMPLETED' ? ticket.completedAt : ticket.readyAt;
    const timeLabel = terminalTime
      ? `${ticket.status === 'COMPLETED' ? 'Handed off' : 'Ready'} ${F.formatTime(terminalTime)}`
      : `${currentElapsed(ticket)} min`;
    const itemMarkup = items || '<p class="kds-item-meta">No items on this ticket.</p>';

    return `<article class="kds-ticket${overdue ? ' is-overdue' : ''}" data-status="${F.escapeHtml(ticket.status)}">
      <header class="kds-ticket-head">
        <div>
          <div class="kds-ticket-id">#${F.escapeHtml(ticket.tokenNumber || ticket.orderNumber || '—')}</div>
          <div class="kds-ticket-destination"><span class="material-symbols-outlined" aria-hidden="true">${destinationIcon}</span>${F.escapeHtml(ticket.destination || 'Takeaway Counter')} · ${F.escapeHtml(ticket.orderNumber || '')}</div>
        </div>
        <div class="kds-ticket-timing${overdue ? ' is-overdue' : ''}"><span class="material-symbols-outlined" aria-hidden="true">${overdue ? 'warning' : 'schedule'}</span>${F.escapeHtml(timeLabel)}</div>
        <span class="kds-ticket-channel">${F.escapeHtml(channelLabel(ticket.channel))}</span>
      </header>
      <div class="kds-ticket-body">
        <div>
          <div class="kds-ticket-status"><span class="material-symbols-outlined" aria-hidden="true">${statusIcon}</span>${F.escapeHtml(statusLabel(ticket.status))} · ${(ticket.items || []).length} ${(ticket.items || []).length === 1 ? 'item' : 'items'}</div>
          <div class="kds-items">${itemMarkup}</div>
        </div>
        ${ticketAction(ticket, mode)}
      </div>
      <footer class="kds-ticket-footer"><span>${F.escapeHtml(F.OUTLET_LABEL[ticket.outlet] || ticket.outlet || 'Kitchen')}</span><strong>${overdue ? 'OVERDUE' : F.escapeHtml(statusLabel(ticket.status))}</strong></footer>
    </article>`;
  }

  function renderBoard(board, tickets, mode, filter, search) {
    board.setAttribute('aria-busy', 'false');
    const visible = tickets.filter((ticket) => {
      if (STATE.channel !== 'ALL' && ticket.channel !== STATE.channel) return false;
      if (mode === 'status') {
        if (filter === 'OVERDUE' && !isOverdue(ticket)) return false;
        if (filter !== 'ALL' && filter !== 'OVERDUE' && ticket.status !== filter) return false;
      }
      if (mode === 'history' && filter !== 'ALL' && ticket.status !== filter) return false;
      return ticketMatchesSearch(ticket, search);
    });

    if (!visible.length) {
      const content = mode === 'history'
        ? '<span class="material-symbols-outlined" aria-hidden="true">inventory_2</span><strong>No completed tickets found</strong><p>Ready and handed-off tickets from today will appear here.</p>'
        : '<span class="material-symbols-outlined" aria-hidden="true">check_circle</span><strong>No tickets match this view</strong><p>Try another station, order type, or status filter.</p>';
      board.innerHTML = `<div class="kds-empty">${content}</div>`;
      return;
    }
    board.innerHTML = visible.map((ticket) => renderTicket(ticket, mode === 'active' ? 'active' : 'readonly')).join('');
  }

  function renderCurrentView() {
    if (STATE.view === 'home') {
      renderBoard(els.homeBoard, STATE.activeTickets.filter((ticket) => ['PENDING', 'PREPARING'].includes(ticket.status)), 'active', 'ALL', '');
    } else if (STATE.view === 'status') {
      const tickets = [...STATE.activeTickets, ...STATE.readyTickets];
      renderBoard(els.statusBoard, tickets, 'status', STATE.statusFilter, els.statusSearch.value.trim());
      updatePressed(els.statusFilters, 'data-status-filter', STATE.statusFilter);
    } else if (STATE.view === 'completed') {
      renderBoard(els.completedBoard, STATE.completedTickets, 'history', STATE.historyFilter, els.completedSearch.value.trim());
      updatePressed(els.historyFilters, 'data-history-filter', STATE.historyFilter);
    }
    updatePressed(els.stationFilters, 'data-station', STATE.station);
    updatePressed(els.channelFilters, 'data-channel', STATE.channel);
  }

  async function refreshDashboard(options) {
    try {
      await loadCurrentView();
    } catch (error) {
      showBoardsError(error);
      setConnectionStatus('offline');
      const message = error.message || 'Could not refresh the kitchen board.';
      if (!(options && options.quiet) || STATE.lastLoadError !== message) {
        F.toast(message, 'error');
      }
      STATE.lastLoadError = message;
    }
  }

  function scheduleRefresh() {
    if (STATE.refreshTimer) window.clearTimeout(STATE.refreshTimer);
    STATE.refreshTimer = window.setTimeout(() => {
      STATE.refreshTimer = null;
      refreshDashboard({ quiet: true });
    }, 250);
  }

  async function act(ticketId, action) {
    if (STATE.busy.has(ticketId)) return;
    STATE.busy.add(ticketId);
    renderCurrentView();
    try {
      if (action === 'claim') {
        const data = await F.request(`/api/v1/kds/${encodeURIComponent(ticketId)}/claim`, { method: 'POST' });
        F.toast(data.message || 'Ticket started.', 'success');
      } else {
        const payload = STATE.station === 'ALL' ? {} : { station: STATE.station };
        const data = await F.request(`/api/v1/kds/${encodeURIComponent(ticketId)}/bump`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        F.toast(data.message || 'Ticket marked ready.', 'success');
      }
      await loadCurrentView();
    } catch (error) {
      F.toast(error.message || 'Kitchen action failed.', 'error');
      await refreshDashboard({ quiet: true });
    } finally {
      STATE.busy.delete(ticketId);
      renderCurrentView();
    }
  }

  function startEvents() {
    if (STATE.events) STATE.events.close();
    STATE.events = F.connectEvents({
      outlet: STATE.user.outlet || undefined,
      station: STATE.station === 'ALL' ? undefined : STATE.station,
      onStatus: setConnectionStatus,
      onEvent(message) {
        if (message.event === 'TICKET_CREATED' && STATE.preferences.soundEnabled) {
          playChime().catch((error) => F.toast(error.message || 'New-order sound could not play.', 'error'));
        }
        if ([
          'TICKET_CREATED',
          'TICKET_UPDATED',
          'TICKET_BUMPED',
          'TOKEN_READY',
          'ORDER_CANCELLED',
          'ORDER_SETTLED'
        ].includes(message.event)) {
          scheduleRefresh();
        }
      }
    });
  }

  async function playChime() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) throw new Error('Audio alerts are not supported in this browser.');
    if (!STATE.audioContext) STATE.audioContext = new AudioContextConstructor();
    if (STATE.audioContext.state === 'suspended') await STATE.audioContext.resume();

    const context = STATE.audioContext;
    const start = context.currentTime;
    [[740, 0], [988, 0.13]].forEach(([frequency, offset]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.24);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.25);
    });
  }

  function setStation(station, reload) {
    if (!STATIONS.has(station)) return;
    STATE.station = station;
    updatePressed(els.stationFilters, 'data-station', station);
    if (STATE.events) startEvents();
    if (reload) refreshDashboard({ quiet: true });
  }

  function setChannel(channel) {
    if (!CHANNELS.has(channel)) return;
    STATE.channel = channel;
    updatePressed(els.channelFilters, 'data-channel', channel);
    renderCurrentView();
  }

  function handleNavigation(view) {
    setView(view);
  }

  async function toggleSound() {
    const next = Object.assign({}, STATE.preferences, { soundEnabled: !STATE.preferences.soundEnabled });
    try {
      savePreferences(next);
      if (next.soundEnabled) await playChime();
      els.settingsFeedback.textContent = next.soundEnabled ? 'Sound alerts are on.' : 'Sound alerts are off.';
    } catch (error) {
      F.toast(error.message || 'Sound preference could not be updated.', 'error');
    }
  }

  function wireSettings() {
    els.settingsForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const next = {
        station: els.defaultStation.value,
        soundEnabled: els.soundSetting.checked,
        autoRefresh: els.autoRefreshSetting.checked,
        compactMode: els.compactSetting.checked
      };
      try {
        savePreferences(next);
        setStation(next.station, false);
        els.settingsFeedback.textContent = 'Settings saved on this device.';
        refreshDashboard({ quiet: true });
      } catch (error) {
        F.toast(error.message || 'Settings could not be saved.', 'error');
      }
    });

    document.getElementById('kds-test-sound').addEventListener('click', () => {
      playChime().then(() => {
        els.settingsFeedback.textContent = 'Sound test played.';
      }).catch((error) => {
        F.toast(error.message || 'Sound test could not play.', 'error');
      });
    });

    els.soundButton.addEventListener('click', toggleSound);
  }

  function wireEvents() {
    document.querySelectorAll('[data-view-button]').forEach((button) => {
      button.addEventListener('click', () => handleNavigation(button.dataset.viewButton));
    });

    document.querySelectorAll('[data-summary-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        STATE.statusFilter = button.dataset.summaryFilter;
        setView('status');
        updatePressed(els.statusFilters, 'data-status-filter', STATE.statusFilter);
      });
    });

    els.stationFilters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-station]');
      if (!button) return;
      setStation(button.dataset.station, true);
    });
    els.channelFilters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-channel]');
      if (button) setChannel(button.dataset.channel);
    });
    els.statusFilters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-status-filter]');
      if (!button) return;
      STATE.statusFilter = button.dataset.statusFilter;
      renderCurrentView();
    });
    els.historyFilters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-history-filter]');
      if (!button) return;
      STATE.historyFilter = button.dataset.historyFilter;
      renderCurrentView();
    });
    els.statusSearch.addEventListener('input', renderCurrentView);
    els.completedSearch.addEventListener('input', renderCurrentView);
    document.getElementById('kds-refresh-button').addEventListener('click', () => refreshDashboard({ quiet: false }));

    document.addEventListener('click', (event) => {
      const retry = event.target.closest('[data-kds-retry]');
      if (retry) {
        refreshDashboard({ quiet: false });
        return;
      }
      const action = event.target.closest('[data-ticket-id][data-ticket-action]');
      if (action) act(action.dataset.ticketId, action.dataset.ticketAction);
    });

    window.addEventListener('popstate', () => {
      const view = window.location.hash.slice(1);
      setView(VIEWS.has(view) ? view : 'home', { navigate: false });
    });
  }

  async function init() {
    const user = await F.guard(['KITCHEN_STAFF', 'MANAGER_ADMIN']);
    if (!user) return;
    STATE.user = user;
    F.fillSessionChrome(user);
    loadPreferences();
    renderClock();
    STATE.clockTimer = window.setInterval(renderClock, 30000);
    wireEvents();
    wireSettings();
    startEvents();
    const initialView = window.location.hash.slice(1);
    setView(VIEWS.has(initialView) ? initialView : 'home', { navigate: false });
    STATE.pollTimer = window.setInterval(() => {
      if (STATE.preferences.autoRefresh && STATE.connectionStatus !== 'online') {
        refreshDashboard({ quiet: true });
      }
    }, 60000);
  }

  init().catch((error) => {
    F.toast(error.message || 'Kitchen display failed to start.', 'error');
  });
})();
