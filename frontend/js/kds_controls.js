(function () {
  'use strict';

  const headerEnhancer = document.createElement('script');
  headerEnhancer.src = '../js/staff_prototype_header.js';
  document.head.appendChild(headerEnhancer);

  const state = {
    station: 'all',
    channel: 'all',
    urgentFirst: true,
    gatePaused: false
  };

  const stationTabs = [...document.querySelectorAll('.station-tab')];
  const channelTabs = [...document.querySelectorAll('.channel-pill')];
  const cards = [...document.querySelectorAll('.ticket-card')];
  const toast = document.getElementById('kds-toast');
  let toastTimer;
  const stationViewControls = [...document.querySelectorAll('main div')].find((element) =>
    element.textContent.trim().startsWith('Station View:') &&
    element.classList.contains('bg-surface-container-lowest/10')
  );
  stationViewControls?.classList.add('kds-station-view-controls');
  const duplicateTicketContainers = document.querySelectorAll('#tickets-container');
  if (duplicateTicketContainers.length > 1) {
    duplicateTicketContainers[0].id = 'ticket-summary-strip';
  }
  const surgeBanner = [...document.querySelectorAll('main section')].find((section) =>
    [...section.querySelectorAll('button')].some((button) => button.textContent.includes('Acknowledge Surge'))
  );

  if (toast) {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-[-120%]');
  }
  if (surgeBanner) surgeBanner.classList.add('kds-surge-banner');

  window.showToast = function (message, iconName = 'info') {
    if (!toast) return;
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined text-tertiary-fixed text-[24px]';
    icon.textContent = iconName;
    const text = document.createElement('span');
    text.className = 'text-label-lg font-label-lg font-bold text-tertiary-fixed';
    text.textContent = message;
    toast.replaceChildren(icon, text);
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.classList.remove('opacity-0', 'translate-y-[-120%]');
    toast.classList.add('opacity-100', 'translate-y-0');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-[-120%]');
      toast.classList.remove('opacity-100', 'translate-y-0');
    }, 2800);
  };

  function showMessage(message, icon = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, icon);
      return;
    }

    let status = document.getElementById('kds-action-status');
    if (!status) {
      status = document.createElement('div');
      status.id = 'kds-action-status';
      status.className = 'kds-action-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      document.body.appendChild(status);
    }
    status.textContent = message;
  }

  function buttonWithText(text, root = document) {
    return [...root.querySelectorAll('button')].find((button) =>
      button.textContent.replace(/\s+/g, ' ').trim().includes(text)
    );
  }

  function addTicketBadge(card, text) {
    if (!card) return;
    let badge = card.querySelector('.kds-local-state');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'kds-local-state';
      badge.setAttribute('role', 'status');
      const header = card.firstElementChild;
      header?.appendChild(badge);
    }
    badge.textContent = text;
  }

  function applyFilters() {
    cards.forEach((card) => {
      const stations = (card.dataset.stations || '').toUpperCase().split(/\s+/);
      const stationMatches = state.station === 'all' || stations.includes(state.station);
      const channelMatches = state.channel === 'all' || card.dataset.channel === state.channel;
      card.style.display = stationMatches && channelMatches ? 'flex' : 'none';
    });

    stationTabs.forEach((tab) => {
      const tabStation = tab.getAttribute('onclick')?.match(/filterStation\('([^']+)'\)/)?.[1];
      const active = tabStation === state.station;
      tab.classList.toggle('bg-primary', active);
      tab.classList.toggle('text-on-primary', active);
      tab.classList.toggle('font-bold', active);
      tab.classList.toggle('bg-surface-container-lowest/10', !active);
      tab.classList.toggle('text-surface-variant', !active);
      tab.setAttribute('aria-pressed', String(active));
    });

    channelTabs.forEach((tab) => {
      const tabChannel = tab.getAttribute('onclick')?.match(/toggleChannel\('([^']+)'\)/)?.[1];
      const active = tabChannel === state.channel;
      tab.classList.toggle('bg-surface-container-lowest/20', active);
      tab.classList.toggle('text-inverse-on-surface', active);
      tab.classList.toggle('font-bold', active);
      tab.classList.toggle('bg-surface-container-lowest/10', !active);
      tab.classList.toggle('text-surface-variant', !active);
      tab.setAttribute('aria-pressed', String(active));
    });
  }

  window.filterStation = function (station) {
    state.station = station;
    applyFilters();
    showMessage(`Station filter: ${station === 'all' ? 'All stations' : station}.`, 'filter_alt');
  };

  window.toggleChannel = function (channel) {
    state.channel = channel;
    applyFilters();
    showMessage(`Channel filter: ${channel === 'all' ? 'All channels' : channel}.`, 'filter_alt');
  };

  window.toggleSort = function () {
    const grid = document.querySelector('.ticket-card')?.parentElement;
    const sortButton = document.getElementById('sort-urgent-btn');
    if (!grid || !sortButton) return;

    const ticketCards = [...grid.querySelectorAll(':scope > .ticket-card')];
    const minutes = (card) => {
      const time = card.innerText.match(/\b(\d{1,2}):(\d{2})\b/);
      if (time) return Number(time[1]) * 60 + Number(time[2]);
      const elapsed = card.innerText.match(/\b(\d{1,2})m\b/);
      return elapsed ? Number(elapsed[1]) : 0;
    };

    ticketCards.sort((a, b) => state.urgentFirst ? minutes(b) - minutes(a) : minutes(a) - minutes(b));
    ticketCards.forEach((card) => grid.appendChild(card));
    state.urgentFirst = !state.urgentFirst;
    sortButton.innerHTML = state.urgentFirst
      ? '<span class="material-symbols-outlined text-[16px]">emergency_heat</span><span>Oldest First (Urgent)</span>'
      : '<span class="material-symbols-outlined text-[16px]">schedule</span><span>Newest First</span>';
    showMessage(`Tickets sorted by ${state.urgentFirst ? 'oldest first' : 'newest first'}.`, 'swap_vert');
  };

  const chimeButton = document.querySelector('header button[title="Audio Chime Bell Active"]');
  if (chimeButton) {
    chimeButton.setAttribute('aria-label', 'Open kitchen notifications');
    chimeButton.addEventListener('click', () => {
      let panel = document.getElementById('kds-notification-panel');
      if (panel) {
        panel.remove();
        chimeButton.setAttribute('aria-expanded', 'false');
        return;
      }

      panel = document.createElement('section');
      panel.id = 'kds-notification-panel';
      panel.className = 'kds-notification-panel';
      panel.setAttribute('role', 'status');
      panel.innerHTML =
        '<strong>Kitchen alerts</strong><p>Review late tickets, open orders, and rider handoffs in the queue.</p><button type="button">Dismiss</button>';
      chimeButton.insertAdjacentElement('afterend', panel);
      chimeButton.setAttribute('aria-expanded', 'true');
      panel.querySelector('button').addEventListener('click', () => {
        panel.remove();
        chimeButton.setAttribute('aria-expanded', 'false');
      });
    });
  }

  const fullscreenButton = document.querySelector('header button[title="Toggle Fullscreen"]');
  if (fullscreenButton) {
    fullscreenButton.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        showMessage('Fullscreen is not available in this browser window.', 'fullscreen');
      }
    });
  }

  const outletButton = [...document.querySelectorAll('header button')].find((button) =>
    button.textContent.includes('Foodizo') && button.textContent.includes('Ham Towers')
  );
  outletButton?.addEventListener('click', () => {
    showMessage('Outlet switching is not connected on this kitchen snapshot. Displayed tickets remain for Ham Towers.', 'store');
  });

  const acknowledgeButton = buttonWithText('Acknowledge Surge');
  acknowledgeButton?.addEventListener('click', () => {
    if (!surgeBanner) return;
    surgeBanner.dataset.acknowledged = 'true';
    acknowledgeButton.setAttribute('aria-pressed', 'true');
    acknowledgeButton.querySelector('span:last-child').textContent = 'Surge acknowledged';
    showMessage('Surge alert acknowledged on this screen.', 'task_alt');
  });

  const fireButton = buttonWithText('Batch Fire All Grills');
  fireButton?.addEventListener('click', () => {
    const grillCards = cards.filter((card) =>
      (card.dataset.stations || '').toUpperCase().split(/\s+/).includes('GRILL')
    );
    grillCards.forEach((card) => {
      card.dataset.localStage = 'cooking';
      addTicketBadge(card, 'COOKING · LOCAL');
    });
    showMessage(
      `${grillCards.length} grill ticket${grillCards.length === 1 ? '' : 's'} marked on this screen. Live tickets were not changed.`,
      'outdoor_grill'
    );
  });

  const gateButton = buttonWithText('Pause New Takeaway Gate');
  gateButton?.addEventListener('click', () => {
    state.gatePaused = !state.gatePaused;
    if (surgeBanner) surgeBanner.dataset.paused = String(state.gatePaused);
    gateButton.querySelector('.material-symbols-outlined').textContent =
      state.gatePaused ? 'play_circle' : 'pause_circle';
    gateButton.querySelector('span:last-child').textContent =
      state.gatePaused ? 'Resume New Takeaway Gate' : 'Pause New Takeaway Gate';
    gateButton.setAttribute('aria-pressed', String(state.gatePaused));
    showMessage(
      state.gatePaused
        ? 'Takeaway gate paused on this screen. No live orders were affected.'
        : 'Takeaway gate resumed on this screen. No live orders were affected.',
      state.gatePaused ? 'pause_circle' : 'play_circle'
    );
  });

  function bindTicketAction(label, handler) {
    cards.forEach((card) => {
      const button = buttonWithText(label, card);
      if (button) button.addEventListener('click', () => handler(card, button));
    });
  }

  bindTicketAction('Split Grill/Fry', (card, button) => {
    const active = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(active));
    addTicketBadge(card, active ? 'GRILL / FRY SPLIT · LOCAL' : 'STATION SPLIT CLEARED');
    showMessage('Station split updated on this screen. No live ticket was changed.', 'call_split');
  });

  bindTicketAction('Split Station', (card, button) => {
    const active = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(active));
    addTicketBadge(card, active ? 'STATION SPLIT · LOCAL' : 'STATION SPLIT CLEARED');
    showMessage('Station split updated on this screen. No live ticket was changed.', 'call_split');
  });

  bindTicketAction('Hold Ticket', (card, button) => {
    const held = card.dataset.localHeld !== 'true';
    card.dataset.localHeld = String(held);
    button.querySelector('.material-symbols-outlined').textContent = held ? 'play_arrow' : 'history';
    button.querySelector('span:last-child').textContent = held ? 'Resume Ticket' : 'Hold Ticket';
    addTicketBadge(card, held ? 'ON HOLD · LOCAL' : 'HOLD CLEARED');
    showMessage(`Ticket ${held ? 'held' : 'released'} on this screen only.`, held ? 'pause_circle' : 'play_arrow');
  });

  bindTicketAction('Delay +5m', (card) => {
    const delay = Number(card.dataset.localDelay || 0) + 5;
    card.dataset.localDelay = String(delay);
    addTicketBadge(card, `DELAY +${delay}m · LOCAL`);
    showMessage(`Delay shown as +${delay} minutes on this screen. The ticket timer was not changed on the server.`, 'schedule');
  });

  bindTicketAction('Add Items', (card) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'kds-action-backdrop';
    backdrop.innerHTML =
      '<form class="kds-action-dialog"><h2>Add item to this ticket</h2><p>This updates only the current screen; it does not change a live order.</p><label for="kds-item-name">Item name</label><input id="kds-item-name" name="item" required maxlength="80" autocomplete="off"><div class="kds-dialog-actions"><button type="button" data-cancel>Cancel</button><button type="submit">Add item</button></div></form>';
    document.body.appendChild(backdrop);
    const input = backdrop.querySelector('input');
    input.focus();
    backdrop.querySelector('[data-cancel]').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) backdrop.remove();
    });
    backdrop.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      const list = card.querySelector('.divide-y');
      const item = document.createElement('div');
      item.className = 'kds-local-added-item';
      item.textContent = `${value} · added on this screen`;
      list?.appendChild(item);
      backdrop.remove();
      showMessage('Item added to this screen only. The live order was not changed.', 'edit_note');
    });
  });

  bindTicketAction('Alert Rider', (card) => {
    const rider = card.innerText.match(/Rider:\s*([^(\n]+)/i)?.[1]?.trim();
    showMessage(
      rider
        ? `Rider alert for ${rider} is not connected here. No message was sent.`
        : 'Rider contact is not available on this ticket. No message was sent.',
      'support_agent'
    );
  });

  bindTicketAction('Call Rider', (card) => {
    const riderContact = card.innerText.match(/rider(?:\s+contact|\s+phone)?\s*:\s*[^+\d\n]*(\+?256[\s()0-9-]{8,})/i)?.[1];
    if (!riderContact) {
      showMessage('No rider phone number is available on this ticket, so no call was started.', 'call');
      return;
    }
    window.location.href = `tel:${riderContact.replace(/[^\d+]/g, '')}`;
  });

  window.printEscPos = function (chitId) {
    const normalized = String(chitId).replace(/^#/, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const card = cards.find((ticket) => ticket.innerText.toLowerCase().includes(normalized));
    if (!card) {
      showMessage(`Could not find ${chitId} to print.`, 'print');
      return;
    }

    document.querySelectorAll('[data-kds-print-target]').forEach((ticket) =>
      ticket.removeAttribute('data-kds-print-target')
    );
    card.setAttribute('data-kds-print-target', 'true');
    const clearTarget = () => {
      card.removeAttribute('data-kds-print-target');
      document.body.classList.remove('kds-printing');
    };
    window.addEventListener('afterprint', clearTarget, { once: true });
    showMessage('Print dialog opened. Select your configured 80mm printer if available.', 'print');
    document.body.classList.add('kds-printing');
    window.print();
    window.setTimeout(clearTarget, 1000);
  };

  window.sendPickupChimeSMS = function (ticketName) {
    showMessage(`SMS service is not connected. No pickup reminder was sent for ${ticketName}.`, 'sms');
  };

  window.markTicketReady = function (ticketId, ticketName) {
    const card = document.getElementById(ticketId);
    if (card)     addTicketBadge(card, 'READY · LOCAL');
    showMessage(`${ticketName} marked ready on this screen. No SMS or live order update was sent.`, 'task_alt');
  };

  window.acceptAndFire = function (ticketId) {
    const card = document.getElementById(ticketId);
    if (card) {
      card.dataset.localStage = 'cooking';
      addTicketBadge(card, 'COOKING · LOCAL');
    }
    showMessage('Ticket marked as cooking on this screen. No live kitchen ticket was changed.', 'outdoor_grill');
  };

  window.recallTicket = function (ticketId) {
    const card = document.getElementById(ticketId);
    if (card)     addTicketBadge(card, 'RECALLED · LOCAL');
    showMessage('Recall noted on this screen. No live ticket state was changed.', 'history');
  };

  document.querySelectorAll('header nav a[href="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const label = link.textContent.trim().toLowerCase();
      const station = label.includes('rolex') ? 'GRILL' :
        label.includes('fryer') ? 'FRYER' :
          label.includes('luwombo') ? 'STEW' :
            label.includes('dispatch') ? 'DISPATCH' : 'all';
      window.filterStation(station);
      document.querySelectorAll('header nav a').forEach((item) => {
        item.classList.toggle('bg-primary', item === link);
        item.classList.toggle('text-on-primary', item === link);
        item.classList.toggle('font-bold', item === link);
        item.setAttribute('aria-current', item === link ? 'page' : 'false');
      });
    });
  });

  document.querySelectorAll('.ticket-card').forEach((card) => {
    card.querySelectorAll('[onclick="toggleItemCheck(this)"]').forEach((item) => {
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        window.toggleItemCheck(item);
      });
    });
  });
})();
