(function () {
  'use strict';

  const F = window.Foodizo;
  const STATE = {
    user: null,
    scope: 'ALL',
    overview: null,
    events: null,
    refreshTimer: null,
    cashTouched: false,
    busy: false
  };

  const els = {
    outletWrap: document.getElementById('admin-outlet-wrap'),
    outletFilter: document.getElementById('admin-outlet-filter'),
    refresh: document.getElementById('admin-refresh'),
    live: document.getElementById('admin-live'),
    liveText: document.getElementById('admin-live-text'),
    gross: document.getElementById('admin-gross'),
    grossNote: document.getElementById('admin-gross-note'),
    orders: document.getElementById('admin-orders'),
    ordersNote: document.getElementById('admin-orders-note'),
    cash: document.getElementById('admin-cash'),
    cashNote: document.getElementById('admin-cash-note'),
    flags: document.getElementById('admin-flags'),
    flagsNote: document.getElementById('admin-flags-note'),
    digestSub: document.getElementById('admin-digest-sub'),
    outlets: document.getElementById('admin-outlets'),
    ordersBody: document.getElementById('admin-orders-body'),
    staffBody: document.getElementById('admin-staff-body'),
    tables: document.getElementById('admin-tables'),
    surplusLogs: document.getElementById('admin-surplus-logs'),
    flagsList: document.getElementById('admin-flags-list'),
    cashForm: document.getElementById('admin-cash-form'),
    cashOutletWrap: document.getElementById('admin-cash-outlet-wrap'),
    cashOutlet: document.getElementById('admin-cash-outlet'),
    cashExpected: document.getElementById('admin-cash-expected'),
    cashCount: document.getElementById('admin-cash-count'),
    cashNotes: document.getElementById('admin-cash-notes'),
    cashSubmit: document.getElementById('admin-cash-submit'),
    surplusForm: document.getElementById('admin-surplus-form'),
    surplusOutletWrap: document.getElementById('admin-surplus-outlet-wrap'),
    surplusOutlet: document.getElementById('admin-surplus-outlet'),
    surplusItem: document.getElementById('admin-surplus-item'),
    surplusQty: document.getElementById('admin-surplus-qty'),
    surplusAction: document.getElementById('admin-surplus-action'),
    surplusReason: document.getElementById('admin-surplus-reason'),
    surplusSubmit: document.getElementById('admin-surplus-submit'),
    digestBtn: document.getElementById('admin-digest-btn'),
    digestOutcome: document.getElementById('admin-digest-outcome'),
    digestLink: document.getElementById('admin-digest-link')
  };

  function setLiveState(state) {
    const labels = {
      connecting: 'Connecting live bus',
      online: 'Live bus connected',
      offline: 'Live bus reconnecting'
    };
    els.live.dataset.state = state;
    els.liveText.textContent = labels[state] || state;
  }

  function outletLabel(outlet) {
    return F.OUTLET_LABEL[outlet] || outlet || 'Both outlets';
  }

  function roleLabel(role) {
    return F.ROLE_LABEL[role] || String(role || '').replace(/_/g, ' ');
  }

  function surplusActionLabel(action) {
    return String(action || '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function findOutletSummary(outlet) {
    if (!STATE.overview) return null;
    return (STATE.overview.summary.outlets || []).find((row) => row.outlet === outlet) || null;
  }

  async function expectedForOutlet(outlet) {
    const existing = findOutletSummary(outlet);
    if (existing) return existing;
    try {
      const data = await F.request(`/api/v1/digest/preview?outlet=${encodeURIComponent(outlet)}`);
      return (data.summary.outlets || [])[0] || null;
    } catch (_error) {
      return null;
    }
  }

  function renderKpis() {
    const summary = STATE.overview.summary;
    const consolidated = summary.consolidated;
    const label = STATE.scope === 'ALL' ? 'Both outlets' : outletLabel(STATE.scope);

    els.gross.textContent = F.formatUGX(consolidated.grossUgx);
    els.grossNote.textContent = `${consolidated.paymentCount} successful payment(s) · ${label}`;
    els.orders.textContent = String(consolidated.totalOrders);
    els.ordersNote.textContent = `Business date ${summary.digestDate} · 05:00 EAT rollover`;
    els.cash.textContent = F.formatUGX(consolidated.expectedCashUgx);
    if (consolidated.cashCountStatus === 'SUBMITTED') {
      const variance = Number(consolidated.cashVarianceUgx || 0);
      els.cashNote.textContent = `Counted ${F.formatUGX(consolidated.countedCashUgx || 0)} · variance ${
        variance === 0 ? 'balanced' : F.formatUGX(variance)
      }`;
    } else {
      els.cashNote.textContent = 'Cash count missing for at least one outlet';
    }
    els.flags.textContent = String(summary.flagCount);
    els.flagsNote.textContent = summary.flagCount
      ? `${summary.flags.map((flag) => flag.code).join(' · ')}`
      : 'No open exceptions on the live data';
    els.digestSub.textContent = `${label} · business date ${summary.digestDate} · generated ${F.relativeTime(
      summary.generatedAt
    )}`;
  }

  function renderOutlets() {
    const outlets = STATE.overview.summary.outlets || [];
    if (!outlets.length) {
      els.outlets.innerHTML = '<div class="ls-empty">No outlet summary returned.</div>';
      return;
    }

    els.outlets.innerHTML = outlets
      .map((row) => {
        const variance = row.cashVarianceUgx;
        const cashLine =
          row.cashCountStatus === 'MISSING'
            ? '<strong style="color:var(--color-error)">Missing</strong>'
            : `${F.formatUGX(row.countedCashUgx || 0)}${
                variance === null || variance === undefined
                  ? ''
                  : ` (${Number(variance) === 0 ? 'balanced' : F.formatUGX(variance)})`
              }`;
        return `
          <article class="admin-outlet-card" style="border-color:var(--color-border-default)">
            <div class="admin-outlet-name">${F.escapeHtml(outletLabel(row.outlet))}</div>
            <div class="admin-outlet-grid">
              <div><span>Gross</span><strong>${F.formatUGX(row.grossUgx)}</strong></div>
              <div><span>Completed</span><strong>${row.totalOrders}</strong></div>
              <div><span>Cash</span><strong>${cashLine}</strong></div>
              <div><span>Expected cash</span><strong>${F.formatUGX(row.expectedCashUgx)}</strong></div>
              <div><span>MTN · Airtel</span><strong>${F.formatUGX(row.mtnUgx)} · ${F.formatUGX(row.airtelUgx)}</strong></div>
              <div><span>Manual MoMo</span><strong>${F.formatUGX(row.manualMomoUgx)}</strong></div>
              <div><span>Refund pending</span><strong>${F.formatUGX(row.refundPendingUgx)} (${row.refundPendingCount})</strong></div>
              <div><span>Failed payments</span><strong>${row.failedPaymentCount}</strong></div>
              <div><span>Failed deliveries</span><strong>${row.failedDeliveryCount}</strong></div>
              <div><span>Surplus</span><strong>${row.surplus.clearancePortions} clearance · ${row.surplus.staffMealPortions} staff · ${row.surplus.wastePortions} waste</strong></div>
              <div><span>Stale orders</span><strong>${row.staleOrderCount}</strong></div>
              <div><span>Low stock</span><strong>${row.lowStock.length} item(s)</strong></div>
            </div>
          </article>`;
      })
      .join('');
  }

  function renderFlags() {
    const flags = STATE.overview.summary.flags || [];
    if (!flags.length) {
      els.flagsList.innerHTML =
        '<div class="ls-empty" style="min-height:72px">No digest flags. Cash, refunds, deliveries, stock and stale orders are clear.</div>';
      return;
    }
    els.flagsList.innerHTML = flags
      .map(
        (flag) =>
          `<div class="admin-flag"><code>${F.escapeHtml(flag.code)}</code><span>${F.escapeHtml(
            flag.message
          )}</span></div>`
      )
      .join('');
  }

  function renderOrders() {
    const orders = STATE.overview.recentOrders || [];
    if (!orders.length) {
      els.ordersBody.innerHTML = '<tr><td colspan="9" class="ls-help">No orders recorded yet.</td></tr>';
      return;
    }
    els.ordersBody.innerHTML = orders
      .map(
        (order) => `
        <tr>
          <td>${F.escapeHtml(order.tokenNumber || '—')}</td>
          <td>${F.escapeHtml(order.orderNumber)}</td>
          <td>${F.escapeHtml(outletLabel(order.outlet))}</td>
          <td>${F.escapeHtml(String(order.channel).replace(/_/g, ' '))}</td>
          <td><span class="ls-status" data-status="${F.escapeHtml(order.status)}">${F.escapeHtml(
          F.statusLabel(order.status)
        )}</span></td>
          <td>${F.escapeHtml(order.table || '—')}</td>
          <td class="is-right ls-money">${F.formatUGX(order.totalUgx)}</td>
          <td>${order.paid ? 'Yes' : 'No'}</td>
          <td>${F.formatTime(order.createdAt)}</td>
        </tr>`
      )
      .join('');
  }

  function renderTables() {
    const rows = STATE.overview.tables || [];
    if (!rows.length) {
      els.tables.innerHTML = '<div class="ls-help">No table records in this scope.</div>';
      return;
    }
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    els.tables.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:7px">
        <span class="ls-chip" style="cursor:default">All tables (${total})</span>
        ${rows
          .map(
            (row) =>
              `<span class="ls-chip" style="cursor:default">${F.escapeHtml(
                F.statusLabel(row.status)
              )} (${row.count})</span>`
          )
          .join('')}
      </div>`;
  }

  function renderStaff() {
    const staff = STATE.overview.staff || [];
    if (!staff.length) {
      els.staffBody.innerHTML = '<tr><td colspan="4" class="ls-help">No staff rows in this scope.</td></tr>';
      return;
    }
    els.staffBody.innerHTML = staff
      .map(
        (row) => `
        <tr>
          <td>${F.escapeHtml(row.full_name)}</td>
          <td>${F.escapeHtml(roleLabel(row.role))}</td>
          <td>${F.escapeHtml(outletLabel(row.outlet))}</td>
          <td>${row.last_login_at ? F.relativeTime(row.last_login_at) : 'Never'}</td>
        </tr>`
      )
      .join('');
  }

  function renderSurplusLogs() {
    const logs = STATE.overview.surplusLogs || [];
    if (!logs.length) {
      els.surplusLogs.innerHTML =
        '<div class="ls-empty" style="min-height:72px">No surplus logged for this business date.</div>';
      return;
    }
    els.surplusLogs.innerHTML = logs
      .map(
        (log) => `
        <div class="admin-log-row">
          <div>
            <strong>${F.escapeHtml(log.itemName)}</strong> · ${log.quantity} portion(s)
            <div class="ls-help">${F.escapeHtml(surplusActionLabel(log.resolution))} · ${F.escapeHtml(
          log.loggedBy
        )}</div>
          </div>
          <span class="ls-help">${F.formatTime(log.createdAt)}</span>
        </div>`
      )
      .join('');
  }

  async function updateCashExpected(prefill) {
    const outlet = els.cashOutlet.value;
    const row = await expectedForOutlet(outlet);
    if (!row) {
      els.cashExpected.value = 'Unavailable';
      return;
    }
    els.cashExpected.value = F.formatUGX(row.expectedCashUgx);
    if (prefill || !STATE.cashTouched) {
      els.cashCount.value = String(
        Math.round(row.countedCashUgx === null ? row.expectedCashUgx : row.countedCashUgx)
      );
      STATE.cashTouched = false;
    }
  }

  function renderAll() {
    renderKpis();
    renderOutlets();
    renderFlags();
    renderOrders();
    renderTables();
    renderStaff();
    renderSurplusLogs();
    updateCashExpected(false).catch(() => {});
  }

  async function loadOverview(prefillCash) {
    const query =
      STATE.scope && STATE.scope !== 'ALL' ? `?outlet=${encodeURIComponent(STATE.scope)}` : '';
    const data = await F.request(`/api/v1/digest/overview${query}`);
    STATE.overview = data;
    renderAll();
    if (prefillCash) {
      STATE.cashTouched = false;
      await updateCashExpected(true);
    }
  }

  async function loadSurplusMenu(outlet) {
    els.surplusItem.innerHTML = '<option value="">Loading menu…</option>';
    try {
      const data = await F.request(`/api/v1/menu-items?outlet=${encodeURIComponent(outlet)}`);
      const items = (data.items || []).filter((item) => item.isActive);
      els.surplusItem.innerHTML = items.length
        ? `<option value="">Select a menu item</option>${items
            .map(
              (item) =>
                `<option value="${F.escapeHtml(item.id)}"${
                  item.isAvailable ? '' : ' disabled'
                }>${F.escapeHtml(item.name)}${item.isAvailable ? '' : ' (86)'}</option>`
            )
            .join('')}`
        : '<option value="">No menu items at this outlet</option>';
    } catch (error) {
      els.surplusItem.innerHTML = '<option value="">Could not load menu</option>';
      F.toast(error.message || 'Could not load surplus menu.', 'error');
    }
  }

  function scheduleRefresh() {
    if (STATE.refreshTimer) window.clearTimeout(STATE.refreshTimer);
    STATE.refreshTimer = window.setTimeout(async () => {
      STATE.refreshTimer = null;
      try {
        await loadOverview(false);
      } catch (error) {
        F.toast(error.message || 'Dashboard refresh failed.', 'error');
      }
    }, 240);
  }

  async function submitCashCount(event) {
    event.preventDefault();
    if (STATE.busy) return;
    const outlet = els.cashOutlet.value;
    const counted = Math.round(Number(els.cashCount.value));
    if (!Number.isFinite(counted) || counted < 0) {
      F.toast('Enter a valid physical cash count.', 'error');
      return;
    }

    STATE.busy = true;
    els.cashSubmit.disabled = true;
    els.cashSubmit.textContent = 'Recording…';
    try {
      const data = await F.request('/api/v1/digest/reconcile-cash', {
        method: 'POST',
        body: JSON.stringify({
          outlet,
          countedCashUgx: counted,
          notes: els.cashNotes.value.trim() || undefined
        })
      });
      F.toast(data.message || 'Cash count recorded.', 'success');
      els.cashNotes.value = '';
      STATE.cashTouched = false;
      await loadOverview(true);
    } catch (error) {
      F.toast(error.message || 'Cash reconciliation failed.', 'error');
    } finally {
      STATE.busy = false;
      els.cashSubmit.disabled = false;
      els.cashSubmit.textContent = 'Record cash count';
    }
  }

  async function submitSurplus(event) {
    event.preventDefault();
    if (STATE.busy) return;
    const outlet = els.surplusOutlet.value;
    const menuItemId = els.surplusItem.value;
    const quantity = Math.round(Number(els.surplusQty.value));
    if (!menuItemId) {
      F.toast('Select the surplus menu item.', 'error');
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      F.toast('Surplus portions must be at least one.', 'error');
      return;
    }

    STATE.busy = true;
    els.surplusSubmit.disabled = true;
    els.surplusSubmit.textContent = 'Recording…';
    try {
      const data = await F.request('/api/v1/surplus/log', {
        method: 'POST',
        body: JSON.stringify({
          outlet,
          menuItemId,
          quantity,
          action: els.surplusAction.value,
          reason: els.surplusReason.value.trim() || undefined
        })
      });
      F.toast(data.message || 'Surplus recorded.', 'success');
      els.surplusQty.value = '1';
      els.surplusReason.value = '';
      await loadOverview(false);
      await loadSurplusMenu(outlet);
    } catch (error) {
      F.toast(error.message || 'Surplus log failed.', 'error');
    } finally {
      STATE.busy = false;
      els.surplusSubmit.disabled = false;
      els.surplusSubmit.textContent = 'Record surplus';
    }
  }

  async function dispatchDigest() {
    if (STATE.busy) return;
    STATE.busy = true;
    els.digestBtn.disabled = true;
    els.digestBtn.textContent = 'Generating digest…';
    els.digestLink.innerHTML = '';
    try {
      const payload = STATE.scope !== 'ALL' ? { outlet: STATE.scope } : {};
      const data = await F.request('/api/v1/digest/dispatch-now', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const channels = (data.channelsSent || []).join(', ') || 'none';
      els.digestOutcome.innerHTML = `
        <strong>${F.escapeHtml(data.digestStatus || 'UNKNOWN')}</strong> · SMS ${F.escapeHtml(
        data.smsStatus || 'UNKNOWN'
      )} · Email ${F.escapeHtml(data.emailStatus || 'UNKNOWN')}<br />
        Channels: ${F.escapeHtml(channels)}<br />
        ${F.escapeHtml(data.message || '')}`;
      if (data.summary && data.summary.link) {
        els.digestLink.innerHTML = `<a class="ls-btn ls-btn--ghost ls-btn--small" href="${F.escapeHtml(
          data.summary.link
        )}" target="_blank" rel="noopener">Open 72-hour digest link</a>`;
      }
      F.toast(
        data.digestStatus === 'SENT'
          ? 'Digest sent.'
          : `Digest recorded as ${data.digestStatus || 'UNKNOWN'}.`,
        data.digestStatus === 'FAILED' ? 'error' : 'info'
      );
      await loadOverview(false);
    } catch (error) {
      els.digestOutcome.textContent = error.message || 'Digest dispatch failed.';
      F.toast(error.message || 'Digest dispatch failed.', 'error');
    } finally {
      STATE.busy = false;
      els.digestBtn.disabled = false;
      els.digestBtn.textContent = 'Generate & dispatch digest';
    }
  }

  function startEvents() {
    if (STATE.events) STATE.events.close();
    STATE.events = F.connectEvents({
      outlet: STATE.scope !== 'ALL' ? STATE.scope : undefined,
      onStatus: setLiveState,
      onEvent(message) {
        if (
          [
            'ORDER_SETTLED',
            'ORDER_CANCELLED',
            'DELIVERY_UPDATED',
            'TABLE_STATUS_CHANGED',
            'TICKET_UPDATED'
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
        await loadOverview(true);
        F.toast('Manager data refreshed.', 'success');
      } catch (error) {
        F.toast(error.message || 'Refresh failed.', 'error');
      }
    });

    els.cashCount.addEventListener('input', () => {
      STATE.cashTouched = true;
    });

    els.cashOutlet.addEventListener('change', () => {
      STATE.cashTouched = false;
      updateCashExpected(true).catch(() => {});
    });

    els.surplusOutlet.addEventListener('change', () => {
      loadSurplusMenu(els.surplusOutlet.value);
    });

    els.cashForm.addEventListener('submit', submitCashCount);
    els.surplusForm.addEventListener('submit', submitSurplus);
    els.digestBtn.addEventListener('click', dispatchDigest);

    els.outletFilter.addEventListener('change', async () => {
      STATE.scope = els.outletFilter.value;
      if (STATE.scope !== 'ALL') {
        els.cashOutlet.value = STATE.scope;
        els.surplusOutlet.value = STATE.scope;
        await loadSurplusMenu(STATE.scope);
      }
      try {
        await loadOverview(true);
        startEvents();
      } catch (error) {
        F.toast(error.message || 'Could not change dashboard scope.', 'error');
      }
    });
  }

  async function init() {
    const user = await F.guard(['MANAGER_ADMIN']);
    if (!user) return;
    STATE.user = user;
    F.fillSessionChrome(user);
    wireEvents();

    if (user.outlet) {
      STATE.scope = user.outlet;
      els.outletWrap.hidden = true;
      els.cashOutlet.value = user.outlet;
      els.surplusOutlet.value = user.outlet;
      els.cashOutletWrap.hidden = true;
      els.surplusOutletWrap.hidden = true;
    } else {
      STATE.scope = 'ALL';
      els.outletWrap.hidden = false;
      els.outletFilter.value = 'ALL';
      els.cashOutlet.value = 'FOODIZO_HAM_TOWERS';
      els.surplusOutlet.value = 'FOODIZO_HAM_TOWERS';
      els.cashOutletWrap.hidden = false;
      els.surplusOutletWrap.hidden = false;
    }

    try {
      await Promise.all([loadOverview(true), loadSurplusMenu(els.surplusOutlet.value)]);
    } catch (error) {
      F.toast(error.message || 'Could not load the manager dashboard.', 'error');
    }
    startEvents();
    window.setInterval(() => {
      if (!STATE.refreshTimer && !STATE.busy) {
        loadOverview(false).catch(() => {});
      }
    }, 60000);
  }

  init().catch((error) => {
    F.toast(error.message || 'Manager dashboard failed to start.', 'error');
  });
})();
