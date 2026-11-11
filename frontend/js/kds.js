(function () {
  'use strict';

  const F = window.Foodizo;
  const STATE = {
    user: null,
    station: 'ALL',
    tickets: [],
    events: null,
    refreshTimer: null,
    busy: new Set()
  };

  const els = {
    board: document.getElementById('kds-board'),
    refresh: document.getElementById('kds-refresh'),
    updated: document.getElementById('kds-updated'),
    filters: document.getElementById('kds-filters'),
    live: document.getElementById('kds-live'),
    liveText: document.getElementById('kds-live-text'),
    total: document.getElementById('kds-count-total'),
    queued: document.getElementById('kds-count-queued'),
    preparing: document.getElementById('kds-count-preparing'),
    overdue: document.getElementById('kds-count-overdue')
  };

  function setLiveState(state) {
    const labels = {
      connecting: 'Connecting…',
      online: 'Live updates on',
      offline: 'Reconnecting…'
    };
    els.live.dataset.state = state;
    els.liveText.textContent = labels[state] || state;
  }

  function stationLabel(station) {
    return String(station || '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function renderSummary() {
    const queued = STATE.tickets.filter((ticket) => ticket.status === 'PENDING').length;
    const preparing = STATE.tickets.filter((ticket) => ticket.status === 'PREPARING').length;
    const overdue = STATE.tickets.filter((ticket) => ticket.isOverdue).length;
    els.total.textContent = String(STATE.tickets.length);
    els.queued.textContent = String(queued);
    els.preparing.textContent = String(preparing);
    els.overdue.textContent = String(overdue);
  }

  function renderFilters() {
    els.filters.querySelectorAll('[data-station]').forEach((button) => {
      button.setAttribute(
        'aria-pressed',
        button.dataset.station === STATE.station ? 'true' : 'false'
      );
    });
  }

  function renderBoard() {
    if (!STATE.tickets.length) {
      els.board.innerHTML =
        '<div class="ls-empty" style="grid-column:1/-1">No active kitchen tickets for this station. The board refreshes automatically.</div>';
      return;
    }

    els.board.innerHTML = STATE.tickets
      .map((ticket) => {
        const busy = STATE.busy.has(ticket.id);
        const items = (ticket.items || [])
          .map(
            (item) => `
            <div class="kds-item">
              <span class="kds-item-qty">${item.quantity}</span>
              <div>
                <div class="kds-item-name">${F.escapeHtml(item.name)}</div>
                <div class="kds-item-meta">${F.escapeHtml(stationLabel(item.station))}${
                  item.notes ? ` · ${F.escapeHtml(item.notes)}` : ''
                }${item.isBumped ? ' · bumped' : ''}</div>
              </div>
            </div>`
          )
          .join('');

        const action =
          ticket.status === 'PENDING'
            ? `<button class="ls-btn kds-claim ls-btn--block" type="button" data-ticket-id="${F.escapeHtml(
                ticket.id
              )}" data-action="claim" ${busy ? 'disabled' : ''}>Start cooking · claim ticket</button>`
            : `<button class="ls-btn ls-btn--success kds-bump ls-btn--block" type="button" data-ticket-id="${F.escapeHtml(
                ticket.id
              )}" data-action="bump" ${busy ? 'disabled' : ''}>Bump READY${
                STATE.station === 'ALL' ? '' : ` · ${F.escapeHtml(stationLabel(STATE.station))}`
              }</button>`;

        return `
          <article class="kds-ticket${ticket.isOverdue ? ' is-overdue' : ''}" data-status="${F.escapeHtml(
          ticket.status
        )}">
            <div class="kds-ticket-head">
              <div>
                <div class="kds-token">${F.escapeHtml(ticket.tokenNumber || '—')}</div>
                <div class="kds-meta">${F.escapeHtml(ticket.destination)} · ${F.escapeHtml(
          ticket.orderNumber
        )} · ${F.escapeHtml(ticket.channel.replace(/_/g, ' '))} · ${F.escapeHtml(
          F.OUTLET_LABEL[ticket.outlet] || ticket.outlet
        )}</div>
              </div>
              <div style="text-align:right">
                <div class="kds-elapsed">${ticket.elapsedMinutes}m</div>
                <div class="kds-meta" style="margin-top:5px">${F.escapeHtml(
                  F.statusLabel(ticket.status)
                )}</div>
              </div>
            </div>
            <div class="kds-items">${items || '<div class="kds-meta">No station items on this ticket.</div>'}</div>
            <div class="kds-actions">${action}</div>
          </article>`;
      })
      .join('');
  }

  async function loadTickets() {
    const params = new URLSearchParams();
    if (STATE.station !== 'ALL') params.set('station', STATE.station);
    const query = params.toString() ? `?${params.toString()}` : '';
    const data = await F.request(`/api/v1/kds/tickets${query}`);
    STATE.tickets = data.tickets || [];
    renderSummary();
    renderBoard();
    if (els.updated) {
      els.updated.textContent = `Updated ${F.formatTime(new Date().toISOString())} · auto 60s`;
    }
  }

  function scheduleRefresh() {
    if (STATE.refreshTimer) window.clearTimeout(STATE.refreshTimer);
    STATE.refreshTimer = window.setTimeout(async () => {
      STATE.refreshTimer = null;
      try {
        await loadTickets();
      } catch (error) {
        F.toast(error.message || 'Kitchen refresh failed.', 'error');
      }
    }, 220);
  }

  async function act(ticketId, action) {
    if (STATE.busy.has(ticketId)) return;
    STATE.busy.add(ticketId);
    renderBoard();
    try {
      if (action === 'claim') {
        const data = await F.request(`/api/v1/kds/${ticketId}/claim`, { method: 'POST' });
        F.toast(data.message || 'Ticket claimed.', 'success');
      } else {
        const payload =
          STATE.station === 'ALL' ? {} : { station: STATE.station };
        const data = await F.request(`/api/v1/kds/${ticketId}/bump`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        F.toast(data.message || 'Ticket bumped to READY.', 'success');
      }
      await loadTickets();
    } catch (error) {
      F.toast(error.message || 'Kitchen action failed.', 'error');
    } finally {
      STATE.busy.delete(ticketId);
      renderBoard();
    }
  }

  function startEvents() {
    if (STATE.events) STATE.events.close();
    STATE.events = F.connectEvents({
      outlet: STATE.user.outlet || undefined,
      station: STATE.station === 'ALL' ? undefined : STATE.station,
      onStatus: setLiveState,
      onEvent(message) {
        if (
          [
            'TICKET_CREATED',
            'TICKET_UPDATED',
            'TICKET_BUMPED',
            'TOKEN_READY',
            'ORDER_CANCELLED',
            'ORDER_SETTLED'
          ].includes(message.event)
        ) {
          scheduleRefresh();
        }
      }
    });
  }

  function wireEvents() {
    els.refresh.addEventListener('click', async () => {
      try {
        await loadTickets();
        F.toast('Kitchen board refreshed.', 'success');
      } catch (error) {
        F.toast(error.message || 'Refresh failed.', 'error');
      }
    });

    els.filters.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-station]');
      if (!button) return;
      STATE.station = button.dataset.station;
      renderFilters();
      try {
        await loadTickets();
        startEvents();
      } catch (error) {
        F.toast(error.message || 'Could not filter the board.', 'error');
      }
    });

    els.board.addEventListener('click', (event) => {
      const button = event.target.closest('[data-ticket-id]');
      if (button) act(button.dataset.ticketId, button.dataset.action);
    });
  }

  async function init() {
    const user = await F.guard(['KITCHEN_STAFF', 'MANAGER_ADMIN']);
    if (!user) return;
    STATE.user = user;
    F.fillSessionChrome(user);
    wireEvents();
    try {
      await loadTickets();
    } catch (error) {
      F.toast(error.message || 'Could not load kitchen tickets.', 'error');
    }
    startEvents();
    window.setInterval(() => {
      if (!STATE.refreshTimer) {
        loadTickets().catch(() => {});
      }
    }, 60000);
  }

  init().catch((error) => {
    F.toast(error.message || 'Kitchen display failed to start.', 'error');
  });
})();
