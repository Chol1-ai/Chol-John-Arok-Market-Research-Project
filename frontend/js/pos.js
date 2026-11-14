(function () {
  'use strict';

  const F = window.Foodizo;
  const OUTLET_LABEL = F.OUTLET_LABEL;
  const STATE = {
    user: null,
    outlet: null,
    tables: [],
    menu: [],
    menuSearch: '',
    menuView: 'grid',
    pickupOrders: [],
    orderType: 'TAKEAWAY_PICKUP',
    category: 'ALL',
    selectedTableId: null,
    activeOrder: null,
    draft: [],
    settleMethod: 'CASH',
    settleOrder: null,
    counterOrderOnly: false,
    selectionSeq: 0,
    events: null,
    refreshTimer: null,
    busy: false
  };

  const els = {
    workspace: document.getElementById('pos-workspace'),
    outletWrap: document.getElementById('pos-outlet-wrap'),
    outlet: document.getElementById('pos-outlet'),
    live: document.getElementById('pos-live'),
    liveText: document.getElementById('pos-live-text'),
    refresh: document.getElementById('pos-refresh'),
    updated: document.getElementById('pos-updated'),
    floor: document.getElementById('pos-floor'),
    floorSub: document.getElementById('pos-floor-sub'),
    sidebarLive: document.getElementById('pos-sidebar-live'),
    currentDate: document.getElementById('pos-current-date'),
    notificationCount: document.getElementById('pos-notification-count'),
    notificationList: document.getElementById('pos-notification-list'),
    kpiOrders: document.getElementById('pos-kpi-orders'),
    kpiValue: document.getElementById('pos-kpi-value'),
    kpiTables: document.getElementById('pos-kpi-tables'),
    kpiTablesNote: document.getElementById('pos-kpi-tables-note'),
    kpiPickups: document.getElementById('pos-kpi-pickups'),
    menuSearch: document.getElementById('pos-menu-search'),
    menuViewButtons: document.querySelectorAll('[data-pos-menu-view]'),
    currentTable: document.getElementById('pos-current-table'),
    currentOrderSub: document.getElementById('pos-current-order-sub'),
    orderEmpty: document.getElementById('pos-order-empty'),
    quickKitchen: document.getElementById('pos-quick-kitchen'),
    browserPrint: document.getElementById('pos-browser-print'),
    navKitchen: document.getElementById('pos-nav-kitchen'),
    bottomMessage: document.getElementById('pos-bottom-message'),
    orderType: document.getElementById('pos-order-type'),
    orderTypeHelp: document.getElementById('pos-order-type-help'),
    tableWrap: document.getElementById('pos-table-wrap'),
    tableSelect: document.getElementById('pos-table-select'),
    menu: document.getElementById('pos-menu'),
    menuSub: document.getElementById('pos-menu-sub'),
    menuRefresh: document.getElementById('pos-menu-refresh'),
    pickupOrders: document.getElementById('pos-pickup-orders'),
    pickupSub: document.getElementById('pos-pickup-sub'),
    pickupRefresh: document.getElementById('pos-pickup-refresh'),
    categories: document.getElementById('pos-categories'),
    draftCard: document.getElementById('pos-draft-card'),
    draftSub: document.getElementById('pos-draft-sub'),
    draftLines: document.getElementById('pos-draft-lines'),
    draftTotalValue: document.getElementById('pos-draft-total'),
    ledgerTitle: document.getElementById('pos-ledger-title'),
    ledgerSub: document.getElementById('pos-ledger-sub'),
    ledgerStatus: document.getElementById('pos-ledger-status'),
    ledger: document.getElementById('pos-ledger'),
    newOrder: document.getElementById('pos-new-order-btn'),
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
      connecting: 'Connecting…',
      online: 'Live updates on',
      offline: 'Reconnecting…'
    };
    els.live.dataset.state = state;
    els.live.setAttribute('aria-label', labels[state] || state);
    els.live.title = labels[state] || state;
    els.liveText.textContent = labels[state] || state;
    els.sidebarLive.textContent = state === 'online' ? 'Live' : state === 'offline' ? 'Reconnecting' : 'Connecting';
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
            <span class="pos-table-total">${order ? F.escapeHtml(order.tokenNumber || '') : 'Choose for dine-in'}</span>
          </button>`;
      })
      .join('');
  }

  function renderOrderOptions() {
    const channel = STATE.activeOrder?.channel || STATE.orderType;
    els.orderType.value = channel;
    els.tableWrap.hidden = channel !== 'DINE_IN';
    els.orderTypeHelp.textContent =
      channel === 'DINE_IN' ? 'Choose a table for guests dining here.' : 'No table needed for takeaway.';
    els.tableSelect.innerHTML = [
      '<option value="">Choose a table</option>',
      ...STATE.tables
          .slice()
          .sort(sortTables)
          .map((table) => {
            const status = F.statusLabel(table.status);
            const activeOrder = table.activeOrders && table.activeOrders[0];
            const detail = activeOrder ? `${status} · ${activeOrder.tokenNumber || 'Open order'}` : status;
            return `<option value="${F.escapeHtml(table.id)}"${
              table.id === STATE.selectedTableId ? ' selected' : ''
            }>${F.escapeHtml(table.label)} · ${F.escapeHtml(detail)}</option>`;
          })
    ].join('');
    els.tableSelect.disabled =
      channel !== 'DINE_IN' || !STATE.tables.length || Boolean(STATE.activeOrder);
  }

  function renderDraft() {
    const hasDraft = STATE.draft.length > 0;
    els.draftCard.hidden = !hasDraft;
    if (!hasDraft) {
      renderDashboard();
      return;
    }

    const channel = STATE.activeOrder?.channel || STATE.orderType;
    const table = selectedTable();
    els.draftSub.textContent =
      channel === 'DINE_IN'
          ? `Dine-in${table ? ` · ${table.label}` : ' · choose a table'}`
          : 'Takeaway order';
    els.draftLines.innerHTML = `<div class="pos-lines">${STATE.draft
      .map((line) => orderLineMarkup(line, { draft: true, station: stationLabel(line.station) }))
      .join('')}</div>`;
    els.draftTotalValue.textContent = F.formatUGX(draftTotal());
    els.add.disabled = STATE.busy || (channel === 'DINE_IN' && !table);
    els.add.textContent = STATE.activeOrder
      ? `Add ${STATE.draft.length} item(s) to ${STATE.activeOrder.tokenNumber}`
      : channel === 'DINE_IN'
          ? 'Place dine-in order'
          : 'Place takeaway order';
    renderDashboard();
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
    const search = STATE.menuSearch.trim().toLocaleLowerCase();
    const items = STATE.menu.filter((item) => {
      const matchesCategory = STATE.category === 'ALL' || item.category === STATE.category;
      const searchable = `${item.name} ${item.category} ${stationLabel(item.station)}`.toLocaleLowerCase();
      return matchesCategory && (!search || searchable.includes(search));
    });
    els.menu.classList.toggle('is-list', STATE.menuView === 'list');
    els.menuSub.textContent = `${items.length} item(s) · ${STATE.category === 'ALL' ? 'all categories' : STATE.category}`;
    if (!items.length) {
      els.menu.innerHTML = `<div class="ls-empty">${
        search ? 'No menu items match your search.' : 'No menu items match this category.'
      }</div>`;
      return;
    }

    els.menu.innerHTML = items
      .map(
        (item) => `
        <button class="pos-menu-item" type="button" data-menu-id="${F.escapeHtml(item.id)}"
          ${item.isAvailable ? '' : 'disabled'}>
          ${
            item.imageUrl
              ? `<img class="pos-menu-image" src="${F.escapeHtml(item.imageUrl)}" alt="" loading="lazy" />`
              : '<span class="pos-menu-image-placeholder"><span class="material-symbols-outlined" aria-hidden="true">restaurant</span></span>'
          }
          <span class="pos-menu-name">${F.escapeHtml(item.name)}</span>
          <span class="pos-menu-station">${F.escapeHtml(stationLabel(item.station))} · ${F.escapeHtml(item.category)}</span>
          <span class="pos-menu-price">${F.formatUGX(item.priceUgx)}</span>
          ${item.isAvailable ? '<span class="waiter-menu-add material-symbols-outlined" aria-hidden="true">add</span>' : ''}
          ${item.isAvailable ? '' : `<span class="ls-status" data-status="CANCELLED">${
            item.is86 ? 'Unavailable by manager' : 'Temporarily unavailable'
          }</span>`}
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

    els.ledger.hidden = !order;
    els.workspace.classList.toggle('has-ledger', Boolean(order));
    els.summary.hidden = !order;
    els.ledgerStatus.hidden = true;
    els.clear.hidden = true;
    els.cancel.hidden = true;
    els.settle.hidden = true;
    els.print.disabled = !order;
    els.newOrder.hidden = !order;
    els.help.textContent = 'Full settlement only. Split tender is not enabled in this phase.';

    if (!order) return;

    els.ledgerTitle.textContent = table
      ? `${table.label} · order ledger`
      : `${order.tokenNumber} · order ledger`;
    els.ledgerSub.textContent = `${OUTLET_LABEL[order.outlet] || order.outlet} · ${F.statusLabel(
      order.status
    )}`;
    els.ledgerStatus.hidden = false;
    els.ledgerStatus.dataset.status = order.status;
    els.ledgerStatus.textContent = F.statusLabel(order.status);

    const paid = order ? successfulPaid(order) : 0;
    const fullyPaid = order ? paid >= Number(order.totalUgx) : false;
    const closed = order ? ['COMPLETED', 'CANCELLED'].includes(order.status) : false;

    let body = `
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

    els.ledgerBody.innerHTML = body;

    const subtotal = Number(order.subtotalUgx);
    const delivery = Number(order.deliveryFeeUgx);
    els.subtotal.textContent = F.formatUGX(subtotal);
    els.delivery.textContent = F.formatUGX(delivery);
    els.total.textContent = F.formatUGX(Number(order.totalUgx));

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

    if (table && (table.status === 'NEEDS_CLEARING' || table.status === 'BILL_REQUESTED')) {
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
    renderOrderOptions();
    renderCategories();
    renderMenu();
    renderDraft();
    renderLedger();
    renderPickupOrders();
    renderDashboard();
  }

  function renderDashboard() {
    const activeOrders = new Map();
    STATE.tables.forEach((table) => {
      (table.activeOrders || []).forEach((order) => {
        if (!['COMPLETED', 'CANCELLED'].includes(order.status)) activeOrders.set(order.id, order);
      });
    });
    STATE.pickupOrders.forEach((order) => activeOrders.set(order.id, order));

    const activeTables = STATE.tables.filter((table) => table.status !== 'VACANT').length;
    const orders = Array.from(activeOrders.values());
    const openValue = orders.reduce((sum, order) => sum + Number(order.totalUgx || 0), 0);
    els.kpiOrders.textContent = String(orders.length);
    els.kpiValue.textContent = F.formatUGX(openValue);
    els.kpiTables.textContent = String(activeTables);
    els.kpiTablesNote.textContent = `${activeTables} of ${STATE.tables.length} tables in service`;
    els.kpiPickups.textContent = String(STATE.pickupOrders.length);

    const tableLabel = selectedTable()
      ? selectedTable().label
      : STATE.activeOrder
        ? `Pickup · ${STATE.activeOrder.tokenNumber}`
        : 'Pickup';
    els.currentTable.textContent = tableLabel;
    if (STATE.activeOrder) {
      els.currentOrderSub.textContent = `${STATE.activeOrder.tokenNumber} · ${F.statusLabel(STATE.activeOrder.status)}`;
    } else if (STATE.draft.length) {
      els.currentOrderSub.textContent = `${STATE.draft.reduce((sum, line) => sum + line.quantity, 0)} item(s) in draft`;
    } else if (selectedTable()) {
      els.currentOrderSub.textContent = `${F.statusLabel(selectedTable().status)} · ${selectedTable().capacity} seats`;
    } else {
      els.currentOrderSub.textContent = 'Choose a table or add pickup items';
    }
    els.orderEmpty.hidden = STATE.draft.length > 0 || Boolean(STATE.activeOrder);

    const notices = [];
    STATE.tables.forEach((table) => {
      const order = (table.activeOrders || []).find((row) => !['COMPLETED', 'CANCELLED'].includes(row.status));
      if (table.status === 'BILL_REQUESTED') {
        notices.push({
          icon: 'request_quote',
          kind: '',
          title: `${table.label} requested the bill`,
          detail: 'Tap to open the table',
          tableId: table.id
        });
      } else if (table.status === 'NEEDS_CLEARING') {
        notices.push({
          icon: 'cleaning_services',
          kind: 'is-payment',
          title: `${table.label} needs clearing`,
          detail: 'Table is ready to be reset',
          tableId: table.id
        });
      } else if (order && order.status === 'READY') {
        notices.push({
          icon: 'soup_kitchen',
          kind: 'is-ready',
          title: `${order.tokenNumber} is ready`,
          detail: `${table.label} · collect from kitchen`,
          tableId: table.id
        });
      }
    });
    STATE.pickupOrders.forEach((order) => {
      notices.push({
        icon: 'payments',
        kind: 'is-payment',
        title: `${order.tokenNumber} awaiting payment`,
        detail: 'Cash collection before kitchen preparation',
        pickup: true
      });
    });

    const shownNotices = notices.slice(0, 8);
    els.notificationCount.textContent = notices.length > 99 ? '99+' : String(notices.length);
    els.notificationCount.hidden = notices.length === 0;
    els.notificationList.innerHTML = shownNotices.length
      ? shownNotices.map((notice) => `
        <button class="waiter-notification" type="button"
          ${notice.tableId ? `data-notification-table="${F.escapeHtml(notice.tableId)}"` : 'data-notification-pickup="true"'}>
          <span class="waiter-notification-icon ${notice.kind}"><span class="material-symbols-outlined" aria-hidden="true">${notice.icon}</span></span>
          <span><strong>${F.escapeHtml(notice.title)}</strong><small>${F.escapeHtml(notice.detail)}</small></span>
          <time>Now</time>
        </button>`).join('')
      : '<div class="waiter-notifications-empty">No service alerts right now.</div>';

    const pickupCount = STATE.pickupOrders.length;
    const attentionCount = STATE.tables.filter((table) => ['BILL_REQUESTED', 'NEEDS_CLEARING'].includes(table.status)).length;
    els.bottomMessage.textContent = attentionCount
      ? `${attentionCount} table${attentionCount === 1 ? '' : 's'} need attention${pickupCount ? ` · ${pickupCount} pickup payment${pickupCount === 1 ? '' : 's'} waiting` : ''}.`
      : pickupCount
        ? `${pickupCount} pickup payment${pickupCount === 1 ? '' : 's'} waiting for collection.`
        : `${orders.length} open order${orders.length === 1 ? '' : 's'} · service is ready.`;

    const now = new Date();
    els.currentDate.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(now);
    const canSend = STATE.draft.length > 0 &&
      (STATE.activeOrder?.channel || STATE.orderType) === 'DINE_IN' &&
      !STATE.busy &&
      Boolean(selectedTable());
    els.quickKitchen.disabled = !canSend;
    els.navKitchen.disabled = !canSend;
    els.browserPrint.disabled = !STATE.activeOrder;
  }

  function renderPickupOrders() {
    const orders = STATE.pickupOrders.filter(
      (order) => !STATE.activeOrder || order.id !== STATE.activeOrder.id
    );
    els.pickupSub.textContent = `${orders.length} awaiting cash collection · kitchen starts after settlement`;
    if (!orders.length) {
      els.pickupOrders.innerHTML = '<div class="ls-empty">No pickup orders awaiting payment.</div>';
      return;
    }

    els.pickupOrders.innerHTML = orders.map((order) => `
      <article class="pickup-order">
        <div class="pickup-order-main">
          <div>
            <strong>${F.escapeHtml(order.tokenNumber)} · ${F.escapeHtml(order.orderNumber)}</strong>
            <div class="ls-help">${F.escapeHtml(order.customerName || 'Customer')} · ${F.escapeHtml(order.customerPhone || 'No phone provided')}</div>
            <div class="ls-help">${(order.items || []).map((item) => `${F.escapeHtml(item.quantity)} × ${F.escapeHtml(item.name)}`).join(' · ')}</div>
          </div>
          <strong class="ls-money">${F.formatUGX(order.totalUgx)}</strong>
        </div>
        <button class="ls-btn ls-btn--success ls-btn--small" type="button" data-pickup-order-id="${F.escapeHtml(order.id)}">Record cash &amp; send to kitchen</button>
      </article>
    `).join('');
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

  async function loadPickupOrders() {
    const query = STATE.outlet ? `?outlet=${encodeURIComponent(STATE.outlet)}` : '';
    const data = await F.request(`/api/v1/orders/awaiting-payment${query}`);
    STATE.pickupOrders = data.orders || [];
  }

  async function loadSelectedOrder() {
    const table = selectedTable();
    const open = table && table.activeOrders && table.activeOrders[0];
    const orderId = table ? (open && open.id) : (STATE.activeOrder && STATE.activeOrder.id);
    if (!orderId) {
      if (table) STATE.activeOrder = null;
      return;
    }
    try {
      const data = await F.request(`/api/v1/orders/${orderId}`);
      STATE.activeOrder = data.order;
      STATE.orderType = data.order.channel;
    } catch (error) {
      if (error.status === 404 || error.status === 403) {
        STATE.activeOrder = null;
        return;
      }
      throw error;
    }
  }

  async function refreshAll() {
    await Promise.all([loadTables(), loadMenu(), loadPickupOrders()]);
    if (STATE.selectedTableId || STATE.activeOrder) {
      await loadSelectedOrder();
    }
    renderAll();
    if (els.updated) {
      els.updated.textContent = `Updated ${F.formatTime(new Date().toISOString())} · auto 60s`;
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
    if (STATE.draft.length && STATE.selectedTableId !== tableId) {
      F.toast('Clear the current draft before changing tables.', 'info');
      return;
    }
    if (STATE.draft.length && STATE.orderType !== 'DINE_IN') {
      F.toast('Start a new dine-in order before choosing a table.', 'info');
      return;
    }
    if (STATE.activeOrder && STATE.activeOrder.channel !== 'DINE_IN') {
      F.toast('Start a new order before switching to a table.', 'info');
      return;
    }

    const changed = STATE.selectedTableId !== tableId;
    STATE.orderType = 'DINE_IN';
    els.orderType.value = 'DINE_IN';
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
    if (!item.isAvailable || item.is86) {
      F.toast(`${item.name} is currently unavailable. Please check with a manager.`, 'error');
      return;
    }
    if (STATE.orderType === 'DINE_IN' && !STATE.selectedTableId) {
      F.toast('Choose a table for this dine-in order.', 'error');
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
    renderDraft();
  }

  function changeOrderType() {
    const channel = els.orderType.value;
    if (STATE.activeOrder || STATE.draft.length) {
      els.orderType.value = STATE.activeOrder?.channel || STATE.orderType;
      F.toast('Place or clear the current order before changing order type.', 'info');
      return;
    }

    STATE.orderType = channel;
    STATE.selectedTableId = null;
    renderAll();
  }

  function startNewOrder() {
    STATE.orderType = 'TAKEAWAY_PICKUP';
    STATE.selectedTableId = null;
    STATE.activeOrder = null;
    STATE.draft = [];
    renderAll();
  }

  async function fireDraft() {
    const table = selectedTable();
    const channel = STATE.activeOrder?.channel || STATE.orderType;
    if (!STATE.draft.length || STATE.busy) return;
    if (channel === 'DINE_IN' && !table) {
      F.toast('Choose a table for this dine-in order.', 'error');
      return;
    }
    STATE.busy = true;
    els.add.disabled = true;
    const originalLabel = els.add.textContent;
    els.add.textContent = 'Sending to kitchen…';
    renderDashboard();

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
            channel,
            ...(channel === 'DINE_IN' ? { tableId: table.id } : {}),
            items
          })
        });
        STATE.activeOrder = data.order;
        STATE.orderType = data.order.channel;
        STATE.selectedTableId = data.order.tableId || null;
        F.toast(
          data.order.status === 'AWAITING_PAYMENT'
            ? `${data.order.tokenNumber} created. Record payment to send it to the kitchen.`
            : `${data.order.tokenNumber} sent to the kitchen.`,
          data.order.status === 'AWAITING_PAYMENT' ? 'info' : 'success'
        );
      }
      STATE.draft = [];
      await refreshAll();
    } catch (error) {
      F.toast(error.message || 'Could not fire the order.', 'error');
      if (error.code === 'TABLE_ALREADY_OCCUPIED') {
        await refreshAll().catch((refreshError) => {
          F.toast(refreshError.message || 'Could not refresh the floor after that conflict.', 'error');
        });
      }
    } finally {
      STATE.busy = false;
      els.add.textContent = originalLabel;
      renderLedger();
      renderDraft();
    }
  }

  function openSettle(order, counterOrderOnly) {
    order = order || STATE.activeOrder;
    if (!order) return;
    if (!counterOrderOnly && STATE.draft.length) {
      F.toast('Add the draft lines to the tab before settling.', 'error');
      return;
    }
    STATE.settleOrder = order;
    STATE.counterOrderOnly = Boolean(counterOrderOnly);
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
    els.settleSub.textContent = `${order.tokenNumber} · ${F.formatUGX(order.totalUgx)} due${counterOrderOnly ? ' · cash at pickup' : ''}`;
    setSettleMethod('CASH');
    els.settleMethods.querySelectorAll('[data-method]').forEach((button) => {
      button.hidden = STATE.counterOrderOnly && button.dataset.method !== 'CASH';
    });
    els.settleModal.hidden = false;
    els.settleTendered.focus();
  }

  function closeSettle() {
    els.settleModal.hidden = true;
    STATE.settleOrder = null;
    STATE.counterOrderOnly = false;
    els.settleMethods.querySelectorAll('[data-method]').forEach((button) => {
      button.hidden = false;
    });
  }

  function setSettleMethod(method) {
    if (STATE.counterOrderOnly && method !== 'CASH') return;
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
    const order = STATE.settleOrder || STATE.activeOrder;
    if (!order || STATE.busy) return;
    STATE.busy = true;
    els.settleSubmit.disabled = true;
    els.settleSubmit.textContent = 'Recording…';
    renderDashboard();

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
        if (message.event === 'TOKEN_READY' && STATE.user?.role === 'WAITER_FOH') {
          const data = message.data || {};
          const token = data.tokenNumber || 'Order';
          const destination = data.destination ? ` · ${data.destination}` : '';
          F.toast(`Food ready — ${token}${destination}`, 'success');
        }

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
        F.toast('Floor, menu, ledger and pickup orders refreshed.', 'success');
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

    els.pickupRefresh.addEventListener('click', async () => {
      try {
        await loadPickupOrders();
        renderPickupOrders();
        renderDashboard();
        F.toast('Customer pickup orders refreshed.', 'success');
      } catch (error) {
        F.toast(error.message || 'Could not refresh customer pickup orders.', 'error');
      }
    });

    els.pickupOrders.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-pickup-order-id]');
      if (!button) return;
      const order = STATE.pickupOrders.find((row) => row.id === button.dataset.pickupOrderId);
      if (!order) return;
      openSettle(order, true);
    });

    els.floor.addEventListener('click', (event) => {
      const button = event.target.closest('[data-table-id]');
      if (button) selectTable(button.dataset.tableId);
    });

    els.orderType.addEventListener('change', changeOrderType);
    els.tableSelect.addEventListener('change', () => {
      if (STATE.activeOrder) {
        renderOrderOptions();
        return;
      }
      if (els.tableSelect.value) {
        selectTable(els.tableSelect.value);
      } else {
        STATE.selectedTableId = null;
        STATE.activeOrder = null;
        renderAll();
      }
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

    els.menuSearch.addEventListener('input', () => {
      STATE.menuSearch = els.menuSearch.value;
      renderMenu();
    });

    els.menuViewButtons.forEach((button) => {
      button.addEventListener('click', () => {
        STATE.menuView = button.dataset.posMenuView === 'list' ? 'list' : 'grid';
        els.menuViewButtons.forEach((viewButton) => {
          const selected = viewButton.dataset.posMenuView === STATE.menuView;
          viewButton.classList.toggle('is-active', selected);
          viewButton.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        renderMenu();
      });
    });

    els.notificationList.addEventListener('click', (event) => {
      const notice = event.target.closest('[data-notification-table], [data-notification-pickup]');
      if (!notice) return;
      if (notice.dataset.notificationTable) {
        selectTable(notice.dataset.notificationTable);
      } else {
        document.getElementById('pos-pickup-orders-card').scrollIntoView({ behavior: 'smooth' });
      }
    });

    els.quickKitchen.addEventListener('click', fireDraft);
    els.navKitchen.addEventListener('click', fireDraft);
    els.browserPrint.addEventListener('click', () => window.print());

    els.draftLines.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove-menu-id]');
      if (!remove) return;
      STATE.draft = STATE.draft.filter((line) => line.menuItemId !== remove.dataset.removeMenuId);
      renderDraft();
    });

    els.add.addEventListener('click', fireDraft);
    els.newOrder.addEventListener('click', startNewOrder);
    els.settle.addEventListener('click', () => openSettle());
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
      STATE.orderType = 'TAKEAWAY_PICKUP';
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
        refreshAll().catch((error) => {
          F.toast(error.message || 'Live refresh failed.', 'error');
        });
      }
    }, 60000);
  }

  init().catch((error) => {
    F.toast(error.message || 'POS failed to start.', 'error');
  });
})();
