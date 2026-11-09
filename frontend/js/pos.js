(function () {
  'use strict';

  const F = window.Foodizo;
  const OUTLET_LABEL = F.OUTLET_LABEL;
  const STATE = {
    user: null,
    outlet: null,
    tables: [],
    menu: [],
    category: 'ALL',
    selectedTableId: null,
    activeOrder: null,
    draft: [],
    settleMethod: 'CASH',
    selectionSeq: 0,
    events: null,
    refreshTimer: null,
    busy: false
  };

  const els = {
    outletWrap: document.getElementById('pos-outlet-wrap'),
    outlet: document.getElementById('pos-outlet'),
    live: document.getElementById('pos-live'),
    liveText: document.getElementById('pos-live-text'),
    refresh: document.getElementById('pos-refresh'),
    updated: document.getElementById('pos-updated'),
    floor: document.getElementById('pos-floor'),
    floorSub: document.getElementById('pos-floor-sub'),
    menu: document.getElementById('pos-menu'),
    menuSub: document.getElementById('pos-menu-sub'),
    menuRefresh: document.getElementById('pos-menu-refresh'),
    categories: document.getElementById('pos-categories'),
    ledgerTitle: document.getElementById('pos-ledger-title'),
    ledgerSub: document.getElementById('pos-ledger-sub'),
    ledgerStatus: document.getElementById('pos-ledger-status'),
    ledgerBody: document.getElementById('pos-ledger-body'),
    summary: document.getElementById('pos-summary'),
    subtotal: document.getElementById('pos-subtotal'),
    delivery: document.getElementById('pos-delivery'),
    total: document.getElementById('pos-total'),
    add: document.getElementById('pos-add-btn'),
    settle: document.getElementById('pos-settle-btn'),
    print: document.getElementById('pos-print-btn'),
    drawer: document.getElementById('pos-drawer-btn'),
    clear: document.getElementById('pos-clear-btn'),
    cancel: document.getElementById('pos-cancel-btn'),
    help: document.getElementById('pos-help'),
    settleModal: document.getElementById('pos-settle-modal'),
    settleForm: document.getElementById('pos-settle-form'),
    settleSub: document.getElementById('pos-settle-sub'),
    settleAmount: document.getElementById('pos-settle-amount'),
    settleTendered: document.getElementById('pos-settle-tendered'),
    settleMsisdn: document.getElementById('pos-settle-msisdn'),
    settleReference: document.getElementById('pos-settle-reference'),
    settleNote: document.getElementById('pos-settle-note'),
    settleMethods: document.getElementById('pos-settle-methods'),
    tenderedWrap: document.getElementById('pos-tendered-wrap'),
    msisdnWrap: document.getElementById('pos-msisdn-wrap'),
    referenceWrap: document.getElementById('pos-reference-wrap'),
    settleSubmit: document.getElementById('pos-settle-submit'),
    settleClose: document.getElementById('pos-settle-close'),
    settleCancel: document.getElementById('pos-settle-cancel')
  };

  function selectedTable() {
    return STATE.tables.find((table) => table.id === STATE.selectedTableId) || null;
  }

  function draftTotal() {
    return STATE.draft.reduce((sum, line) => sum + line.unitPriceUgx * line.quantity, 0);
  }

  function successfulPaid(order) {
    return (order.payments || [])
      .filter((payment) => payment.status === 'SUCCESSFUL')
      .reduce((sum, payment) => sum + Number(payment.amount_ugx || payment.amountUgx || 0), 0);
  }

  function setLiveState(state) {
    const labels = {
      connecting: 'Connecting live bus',
      online: 'Live bus connected',
      offline: 'Live bus reconnecting'
    };
    els.live.dataset.state = state;
    els.liveText.textContent = labels[state] || state;
  }

  function sortTables(a, b) {
    return String(a.label).localeCompare(String(b.label), undefined, { numeric: true });
  }

  function renderFloor() {
    if (!STATE.tables.length) {
      els.floor.innerHTML = '<div class="ls-empty">No tables returned for this outlet.</div>';
      els.floorSub.textContent = 'No table records found';
      return;
    }

    const occupied = STATE.tables.filter((table) => table.status !== 'VACANT').length;
    els.floorSub.textContent = `${STATE.tables.length} tables · ${occupied} currently seated`;

    els.floor.innerHTML = STATE.tables
      .slice()
      .sort(sortTables)
      .map((table) => {
        const order = table.activeOrders && table.activeOrders[0];
        const waiter = table.currentWaiter || (order ? 'Assigned floor staff' : 'No waiter assigned');
        const meta = order
          ? `${F.escapeHtml(waiter)} · ${order.status.toLowerCase()} · ${F.formatUGX(order.totalUgx)}`
          : `${F.escapeHtml(waiter)} · ${table.capacity} seats`;
        return `
          <button class="pos-table${table.id === STATE.selectedTableId ? ' is-selected' : ''}" type="button"
            data-table-id="${F.escapeHtml(table.id)}" data-status="${F.escapeHtml(table.status)}">
            <span class="pos-table-label">
              <span>${F.escapeHtml(table.label)}</span>
              <span class="pos-table-dot"></span>
            </span>
            <span class="pos-table-meta">${meta}</span>
            <span class="pos-table-total">${order ? F.escapeHtml(order.tokenNumber || '') : 'Tap to open tab'}</span>
          </button>`;
      })
      .join('');
  }

  function renderCategories() {
    const counts = new Map();
    STATE.menu.forEach((item) => {
      counts.set(item.category, (counts.get(item.category) || 0) + 1);
    });
    const categories = ['ALL', ...Array.from(counts.keys()).sort()];
    els.categories.innerHTML = categories
      .map((category) => {
        const count = category === 'ALL' ? STATE.menu.length : counts.get(category);
        return `<button class="ls-chip" type="button" data-category="${F.escapeHtml(category)}"
          aria-pressed="${STATE.category === category ? 'true' : 'false'}">${F.escapeHtml(
          category === 'ALL' ? 'All items' : category
        )} (${count})</button>`;
      })
      .join('');
  }

  function stationLabel(station) {
    return String(station || '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function renderMenu() {
    const items = STATE.menu.filter(
      (item) => STATE.category === 'ALL' || item.category === STATE.category
    );
    els.menuSub.textContent = `${items.length} item(s) · ${STATE.category === 'ALL' ? 'all categories' : STATE.category}`;
    if (!items.length) {
      els.menu.innerHTML = '<div class="ls-empty">No menu items match this category.</div>';
      return;
    }

    els.menu.innerHTML = items
      .map(
        (item) => `
        <button class="pos-menu-item" type="button" data-menu-id="${F.escapeHtml(item.id)}"
          ${item.isAvailable ? '' : 'disabled'}>
          <span class="pos-menu-name">${F.escapeHtml(item.name)}</span>
          <span class="pos-menu-station">${F.escapeHtml(stationLabel(item.station))} · ${F.escapeHtml(item.category)}</span>
          <span class="pos-menu-price">${F.formatUGX(item.priceUgx)}</span>
          ${item.isAvailable ? '' : '<span class="ls-status" data-status="CANCELLED">86 / unavailable</span>'}
        </button>`
      )
      .join('');
  }

  function orderLineMarkup(line, options) {
    const opts = options || {};
    const total = line.unitPriceUgx * line.quantity;
    return `
      <div class="pos-line">
        <span class="pos-line-qty">${line.quantity}</span>
        <span>
          <span class="pos-line-name">${F.escapeHtml(line.name)}</span>
          <span class="pos-line-meta">${F.escapeHtml(options.station || line.station || '')} · ${F.formatUGX(
      line.unitPriceUgx
    )} each</span>
          ${opts.draft ? `<button class="pos-line-remove" type="button" data-remove-menu-id="${F.escapeHtml(
            line.menuItemId
          )}">Remove</button>` : ''}
        </span>
        <span class="pos-line-total">${F.formatUGX(total)}</span>
      </div>`;
  }

  function renderLedger() {
    const table = selectedTable();
    const order = STATE.activeOrder;

    els.summary.hidden = !table;
    els.ledgerStatus.hidden = true;
    els.clear.hidden = true;
    els.cancel.hidden = true;
    els.settle.hidden = true;
    els.add.disabled = true;
    els.print.disabled = !order;
    els.add.textContent = 'Select a table and add items';
    els.help.textContent = 'Full settlement only. Split tender is not enabled in this phase.';

    if (!table) {
      els.ledgerTitle.textContent = 'Order ledger';
      els.ledgerSub.textContent = 'Select a table to begin';
      els.ledgerBody.innerHTML =
        '<div class="pos-ledger-empty">Choose a table on the floor map.<br />Existing tabs load their full item ledger.</div>';
      return;
    }

    els.ledgerTitle.textContent = `${table.label} · order ledger`;
    els.ledgerSub.textContent = `${OUTLET_LABEL[table.outlet] || table.outlet} · ${F.statusLabel(
      order ? order.status : table.status
    )}`;
    els.ledgerStatus.hidden = false;
    els.ledgerStatus.dataset.status = order ? order.status : table.status;
    els.ledgerStatus.textContent = F.statusLabel(order ? order.status : table.status);

    const paid = order ? successfulPaid(order) : 0;
    const fullyPaid = order ? paid >= Number(order.totalUgx) : false;
    const closed = order ? ['COMPLETED', 'CANCELLED'].includes(order.status) : false;

    let body = '';
    if (order) {
      body += `
        <div class="pos-tab-head">
          <div>
            <div class="pos-tab-token">${F.escapeHtml(order.tokenNumber || '—')}</div>
            <div class="ls-help">${F.escapeHtml(order.orderNumber)} · opened ${F.relativeTime(order.createdAt)}</div>
          </div>
          <div style="text-align:right">
            <div class="ls-money">${F.formatUGX(order.totalUgx)}</div>
            <div class="ls-help">${fullyPaid ? 'Fully paid' : 'Balance due on settle'}</div>
          </div>
        </div>
        <div class="pos-lines">${(order.items || [])
          .map((line) => orderLineMarkup({ ...line, menuItemId: line.menuItemId }, {}))
          .join('')}</div>`;
    } else {
      body += `<div class="ls-empty" style="margin-bottom:10px">New dine-in tab for ${F.escapeHtml(
        table.label
      )}. Add items, then fire the kitchen ticket.</div>`;
    }

    if (STATE.draft.length) {
      body += `<div class="pos-lines">${STATE.draft
        .map((line) => orderLineMarkup(line, { draft: true, station: stationLabel(line.station) }))
        .join('')}</div>`;
    }

    if (!order && !STATE.draft.length) {
      body += `<div class="ls-help" style="margin-top:10px">No live tab is open on this table. The first fired order creates the postpay tab.</div>`;
    }

    els.ledgerBody.innerHTML = body;

    const subtotal = order ? Number(order.subtotalUgx) : 0;
    const delivery = order ? Number(order.deliveryFeeUgx) : 0;
    els.subtotal.textContent = F.formatUGX(subtotal + draftTotal());
    els.delivery.textContent = F.formatUGX(delivery);
    els.total.textContent = F.formatUGX((order ? Number(order.totalUgx) : 0) + draftTotal());

    if (STATE.draft.length) {
      els.add.disabled = false;
      els.add.textContent = order
        ? `Add ${STATE.draft.length} line(s) to ${order.tokenNumber}`
        : `Fire new tab for ${table.label}`;
    }

    if (order && !closed) {
      if (!STATE.draft.length) {
        els.settle.hidden = false;
        els.settle.disabled = fullyPaid;
        els.settle.textContent = fullyPaid ? 'Bill already paid' : 'Settle full bill';
      }
    }

    if (order && fullyPaid) {
      els.help.textContent = `Paid ${F.formatUGX(paid)}. Kitchen remains at ${order.status}; settlement never rewinds the KDS.`;
    } else if (order && order.status === 'READY') {
      els.help.textContent = 'Food is ready. Settle the full bill to close the drawer and release the table.';
    } else if (order && order.status === 'COMPLETED' && !fullyPaid) {
      els.help.textContent = 'Food is completed but unpaid. Settle the outstanding bill before clearing the table.';
    } else if (order) {
      els.help.textContent = 'The kitchen keeps its current state when payment is recorded.';
    }

    if (table.status === 'NEEDS_CLEARING' || table.status === 'BILL_REQUESTED') {
      els.clear.hidden = false;
      els.clear.textContent =
        order && order.status === 'READY' ? 'Complete & clear table' : 'Clear table';
    }
    if (STATE.user && STATE.user.role === 'MANAGER_ADMIN' && order && !closed) {
      els.cancel.hidden = false;
    }
  }

  function renderAll() {
    renderFloor();
    renderCategories();
    renderMenu();
    renderLedger();
  }

  async function loadTables() {
    const query = STATE.outlet ? `?outlet=${encodeURIComponent(STATE.outlet)}` : '';
    const data = await F.request(`/api/v1/tables${query}`);
    STATE.tables = data.tables || [];
    if (STATE.selectedTableId && !STATE.tables.some((table) => table.id === STATE.selectedTableId)) {
      STATE.selectedTableId = null;
      STATE.activeOrder = null;
      STATE.draft = [];
    }
  }

  async function loadMenu() {
    const query = STATE.outlet ? `?outlet=${encodeURIComponent(STATE.outlet)}` : '';
    const data = await F.request(`/api/v1/menu-items${query}`);
    STATE.menu = (data.items || []).filter((item) => item.isActive);
  }

  async function loadSelectedOrder() {
    const table = selectedTable();
    if (!table) {
      STATE.activeOrder = null;
      return;
    }
    const open = table.activeOrders && table.activeOrders[0];
    if (!open) {
      STATE.activeOrder = null;
      return;
    }
    try {
      const data = await F.request(`/api/v1/orders/${open.id}`);
      STATE.activeOrder = data.order;
    } catch (error) {
      if (error.status === 404 || error.status === 403) {
        STATE.activeOrder = null;
        return;
      }
      throw error;
    }
  }

  async function refreshAll(options) {
    const opts = options || {};
    await Promise.all([loadTables(), loadMenu()]);
    if (STATE.selectedTableId) {
      await loadSelectedOrder();
    }
    renderAll();
    if (els.updated) {
      els.updated.textContent = `Updated ${F.formatTime(new Date().toISOString())} · auto 60s`;
    }
    if (opts.toastOnError !== false) {
      // Errors are surfaced by the caller; this branch only keeps the linter
      // from treating the option as unused.
    }
  }

  function scheduleRefresh() {
    if (STATE.refreshTimer) window.clearTimeout(STATE.refreshTimer);
    STATE.refreshTimer = window.setTimeout(async () => {
      STATE.refreshTimer = null;
      try {
        await refreshAll();
      } catch (error) {
        F.toast(error.message || 'Live refresh failed.', 'error');
      }
    }, 220);
  }

  async function selectTable(tableId) {
    const table = STATE.tables.find((row) => row.id === tableId);
    if (!table) return;

    const changed = STATE.selectedTableId !== tableId;
    STATE.selectedTableId = tableId;
    if (changed) STATE.draft = [];
    STATE.activeOrder = null;
    renderFloor();
    renderLedger();
    els.ledgerBody.innerHTML = '<div class="ls-loading">Loading table tab…</div>';

    const seq = ++STATE.selectionSeq;
    try {
      await loadSelectedOrder();
      if (seq !== STATE.selectionSeq) return;
      renderAll();
    } catch (error) {
      if (seq !== STATE.selectionSeq) return;
      F.toast(error.message || 'Could not load the table tab.', 'error');
      renderAll();
    }
  }

  function addMenuItem(menuItemId) {
    const item = STATE.menu.find((row) => row.id === menuItemId);
    if (!item) return;
    if (!item.isAvailable) {
      F.toast(`${item.name} is marked 86/unavailable.`, 'error');
      return;
    }
    if (!STATE.selectedTableId) {
      F.toast('Select a table before adding menu items.', 'error');
      return;
    }
    const existing = STATE.draft.find((line) => line.menuItemId === item.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      STATE.draft.push({
        menuItemId: item.id,
        name: item.name,
        unitPriceUgx: Number(item.priceUgx),
        quantity: 1,
        station: item.station
      });
    }
    renderLedger();
  }

  async function fireDraft() {
    const table = selectedTable();
    if (!table || !STATE.draft.length || STATE.busy) return;
    STATE.busy = true;
    els.add.disabled = true;
    const originalLabel = els.add.textContent;
    els.add.textContent = 'Sending to kitchen…';

    const items = STATE.draft.map((line) => ({
      menuItemId: line.menuItemId,
      quantity: line.quantity
    }));

    try {
      if (STATE.activeOrder) {
        const data = await F.request(`/api/v1/orders/${STATE.activeOrder.id}/items`, {
          method: 'POST',
          body: JSON.stringify({ items })
        });
        F.toast(data.message || 'Items added to the open tab.', 'success');
      } else {
        const data = await F.request('/api/v1/orders', {
          method: 'POST',
          body: JSON.stringify({
            outlet: STATE.outlet,
            channel: 'DINE_IN',
            tableId: table.id,
            items
          })
        });
        F.toast(`Table tab ${data.order.tokenNumber} fired to the kitchen.`, 'success');
      }
      STATE.draft = [];
      await refreshAll();
    } catch (error) {
      F.toast(error.message || 'Could not fire the order.', 'error');
      if (error.code === 'TABLE_ALREADY_OCCUPIED') {
        await refreshAll().catch(() => {});
      }
    } finally {
      STATE.busy = false;
      els.add.textContent = originalLabel;
      renderLedger();
    }
  }

  function openSettle() {
    const order = STATE.activeOrder;
    if (!order) return;
    if (STATE.draft.length) {
      F.toast('Add the draft lines to the tab before settling.', 'error');
      return;
    }
    const paid = successfulPaid(order);
    if (paid >= Number(order.totalUgx)) {
      F.toast('This bill is already fully paid.', 'info');
      return;
    }

    STATE.settleMethod = 'CASH';
    els.settleAmount.value = String(Math.round(Number(order.totalUgx)));
    els.settleTendered.value = String(Math.round(Number(order.totalUgx)));
    els.settleMsisdn.value = order.customerPhone || '';
    els.settleReference.value = '';
    els.settleSub.textContent = `${order.tokenNumber} · ${F.formatUGX(order.totalUgx)} due`;
    setSettleMethod('CASH');
    els.settleModal.hidden = false;
    els.settleTendered.focus();
  }

  function closeSettle() {
    els.settleModal.hidden = true;
  }

  function setSettleMethod(method) {
    STATE.settleMethod = method;
    els.settleMethods.querySelectorAll('[data-method]').forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.method === method ? 'true' : 'false');
    });
    const isCash = method === 'CASH';
    const isMobile = method === 'MTN' || method === 'AIRTEL';
    els.tenderedWrap.hidden = !isCash;
    els.msisdnWrap.hidden = !isMobile;
    els.referenceWrap.hidden = method !== 'MANUAL_MOMO';

    if (method === 'MTN' || method === 'AIRTEL') {
      els.settleNote.textContent =
        'The API sends a real STK prompt to the customer phone. The bill stays open until a signed provider callback confirms success.';
    } else if (method === 'MANUAL_MOMO') {
      els.settleNote.textContent =
        'Manual MoMo is a verified counter entry. A provider transaction reference is required.';
    } else {
      els.settleNote.textContent =
        'Cash settlement records the drawer payment immediately and returns the change due.';
    }
  }

  async function submitSettlement() {
    const order = STATE.activeOrder;
    if (!order || STATE.busy) return;
    STATE.busy = true;
    els.settleSubmit.disabled = true;
    els.settleSubmit.textContent = 'Recording…';

    try {
      const payload = {
        paymentMethod: STATE.settleMethod,
        amountUgx: Math.round(Number(order.totalUgx))
      };
      if (STATE.settleMethod === 'CASH') {
        payload.tenderedCashUgx = Math.round(Number(els.settleTendered.value));
        if (!payload.tenderedCashUgx || payload.tenderedCashUgx < payload.amountUgx) {
          throw new Error('Tendered cash must cover the full bill total.');
        }
      }
      if (STATE.settleMethod === 'MTN' || STATE.settleMethod === 'AIRTEL') {
        const msisdn = els.settleMsisdn.value.trim();
        if (!msisdn) throw new Error('Enter the customer mobile number for the STK prompt.');
        payload.customerMsisdn = msisdn;
      }
      if (STATE.settleMethod === 'MANUAL_MOMO') {
        const reference = els.settleReference.value.trim();
        if (reference.length < 3) throw new Error('Enter the verified MoMo transaction reference.');
        payload.externalTransactionId = reference;
      }

      const data = await F.request(`/api/v1/orders/${order.id}/settle`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      closeSettle();
      if (data.pending) {
        F.toast(data.message || 'STK prompt sent. Awaiting provider callback.', 'info');
      } else if (Number(data.changeUgx) > 0) {
        F.toast(`Settlement recorded. Change due: ${F.formatUGX(data.changeUgx)}.`, 'success');
      } else {
        F.toast(data.message || 'Settlement recorded.', 'success');
      }
      await refreshAll();
    } catch (error) {
      F.toast(error.message || 'Settlement failed.', 'error');
    } finally {
      STATE.busy = false;
      els.settleSubmit.disabled = false;
      els.settleSubmit.textContent = 'Record settlement';
    }
  }

  async function reprintChit() {
    if (!STATE.activeOrder) return;
    try {
      const data = await F.request(`/api/v1/orders/${STATE.activeOrder.id}/reprint-chit`, {
        method: 'POST'
      });
      F.toast(data.message || 'Reprint requested.', data.printed ? 'success' : 'info');
    } catch (error) {
      F.toast(error.message || 'Printer request failed.', 'error');
    }
  }

  async function kickDrawer() {
    try {
      const data = await F.request('/api/v1/tables/drawer/kick', {
        method: 'POST',
        body: JSON.stringify({ reason: 'POS cash drawer request' })
      });
      F.toast(data.message || 'Drawer pulse delivered.', data.released ? 'success' : 'info');
    } catch (error) {
      F.toast(error.message || 'Drawer did not confirm release.', 'error');
    }
  }

  async function clearTable() {
    const table = selectedTable();
    if (!table) return;
    try {
      const order = STATE.activeOrder;

      // A fully paid READY order must be completed before the floor can be
      // released; otherwise the table endpoint correctly refuses to vacate a
      // table that still has an active kitchen ticket.
      if (order && order.status === 'READY') {
        const paid = successfulPaid(order);
        if (paid < Number(order.totalUgx)) {
          F.toast('Settle the outstanding bill before clearing this table.', 'error');
          return;
        }
        await F.request(`/api/v1/orders/${order.id}/status`, {
          method: 'POST',
          body: JSON.stringify({ status: 'COMPLETED' })
        });
      } else if (order && ['PENDING', 'PREPARING'].includes(order.status)) {
        F.toast(
          `${order.tokenNumber} is still ${F.statusLabel(order.status).toLowerCase()} in the kitchen.`,
          'error'
        );
        return;
      }

      await F.request(`/api/v1/tables/${table.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'VACANT' })
      });
      F.toast(`${table.label} cleared.`, 'success');
      STATE.selectedTableId = null;
      STATE.activeOrder = null;
      STATE.draft = [];
      await refreshAll();
    } catch (error) {
      F.toast(error.message || 'Could not clear the table.', 'error');
    }
  }

  async function cancelOrder() {
    if (!STATE.activeOrder) return;
    const reason = window.prompt(
      `Reason for cancelling ${STATE.activeOrder.tokenNumber}? This is written to the audit log.`,
      ''
    );
    if (!reason || reason.trim().length < 3) {
      F.toast('Cancellation needs a reason of at least 3 characters.', 'error');
      return;
    }
    try {
      const data = await F.request(`/api/v1/orders/${STATE.activeOrder.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() })
      });
      F.toast(data.message || 'Order cancelled.', 'success');
      await refreshAll();
    } catch (error) {
      F.toast(error.message || 'Cancellation failed.', 'error');
    }
  }

  function startEvents() {
    if (STATE.events) STATE.events.close();
    STATE.events = F.connectEvents({
      outlet: STATE.outlet,
      onStatus: setLiveState,
      onEvent(message) {
        if (
          [
            'TICKET_CREATED',
            'TICKET_UPDATED',
            'TICKET_BUMPED',
            'TOKEN_READY',
            'ORDER_SETTLED',
            'ORDER_CANCELLED',
            'TABLE_STATUS_CHANGED'
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
        await refreshAll();
        F.toast('Floor, menu and ledger refreshed.', 'success');
      } catch (error) {
        F.toast(error.message || 'Refresh failed.', 'error');
      }
    });

    els.menuRefresh.addEventListener('click', async () => {
      try {
        await loadMenu();
        renderCategories();
        renderMenu();
        F.toast('Menu availability refreshed.', 'success');
      } catch (error) {
        F.toast(error.message || 'Menu refresh failed.', 'error');
      }
    });

    els.floor.addEventListener('click', (event) => {
      const button = event.target.closest('[data-table-id]');
      if (button) selectTable(button.dataset.tableId);
    });

    els.menu.addEventListener('click', (event) => {
      const button = event.target.closest('[data-menu-id]');
      if (button && !button.disabled) addMenuItem(button.dataset.menuId);
    });

    els.categories.addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      STATE.category = button.dataset.category;
      renderCategories();
      renderMenu();
    });

    els.ledgerBody.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove-menu-id]');
      if (!remove) return;
      STATE.draft = STATE.draft.filter((line) => line.menuItemId !== remove.dataset.removeMenuId);
      renderLedger();
    });

    els.add.addEventListener('click', fireDraft);
    els.settle.addEventListener('click', openSettle);
    els.print.addEventListener('click', reprintChit);
    els.drawer.addEventListener('click', kickDrawer);
    els.clear.addEventListener('click', clearTable);
    els.cancel.addEventListener('click', cancelOrder);

    els.settleMethods.addEventListener('click', (event) => {
      const button = event.target.closest('[data-method]');
      if (button) setSettleMethod(button.dataset.method);
    });
    els.settleClose.addEventListener('click', closeSettle);
    els.settleCancel.addEventListener('click', closeSettle);
    els.settleSubmit.addEventListener('click', submitSettlement);
    els.settleForm.addEventListener('submit', (event) => {
      event.preventDefault();
      submitSettlement();
    });
    els.settleModal.addEventListener('click', (event) => {
      if (event.target === els.settleModal) closeSettle();
    });

    els.outlet.addEventListener('change', async () => {
      STATE.outlet = els.outlet.value;
      STATE.selectedTableId = null;
      STATE.activeOrder = null;
      STATE.draft = [];
      try {
        await refreshAll();
        startEvents();
      } catch (error) {
        F.toast(error.message || 'Could not switch outlet.', 'error');
      }
    });
  }

  async function init() {
    const user = await F.guard(['WAITER_FOH', 'MANAGER_ADMIN']);
    if (!user) return;
    STATE.user = user;
    F.fillSessionChrome(user);

    if (user.outlet) {
      STATE.outlet = user.outlet;
      els.outletWrap.hidden = true;
    } else {
      STATE.outlet = 'FOODIZO_HAM_TOWERS';
      els.outletWrap.hidden = false;
      els.outlet.value = STATE.outlet;
    }

    wireEvents();
    try {
      await refreshAll();
    } catch (error) {
      F.toast(error.message || 'Could not load the POS data.', 'error');
    }
    startEvents();
    window.setInterval(() => {
      if (!STATE.refreshTimer && !STATE.busy) {
        refreshAll().catch(() => {});
      }
    }, 60000);
  }

  init().catch((error) => {
    F.toast(error.message || 'POS failed to start.', 'error');
  });
})();
