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
    busy: false,
    staffBusy: false,
    menuBusy: false,
    inventoryBusy: false,
    inventory: null
  };

  const els = {
    outletWrap: document.getElementById('admin-outlet-wrap'),
    outletFilter: document.getElementById('admin-outlet-filter'),
    refresh: document.getElementById('admin-refresh'),
    updated: document.getElementById('admin-updated'),
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
    createStaffForm: document.getElementById('admin-create-staff-form'),
    createStaffSubmit: document.getElementById('admin-create-staff-submit'),
    staffOutlet: document.querySelector('#admin-create-staff-form [name="outlet"]'),
    staffStatus: document.getElementById('admin-create-staff-status'),
    menuOutletWrap: document.getElementById('admin-menu-outlet-wrap'),
    menuOutlet: document.getElementById('admin-menu-outlet'),
    menuCreateForm: document.getElementById('admin-menu-create-form'),
    menuCreateSubmit: document.getElementById('admin-menu-create-submit'),
    menuCreateStatus: document.getElementById('admin-menu-create-status'),
    menuCreatePreview: document.getElementById('admin-menu-create-preview'),
    menuItems: document.getElementById('admin-menu-items'),
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
    digestLink: document.getElementById('admin-digest-link'),
    inventoryRefresh: document.getElementById('admin-inventory-refresh'),
    inventoryBody: document.getElementById('admin-inventory-body'),
    stockActivity: document.getElementById('admin-stock-activity'),
    stockForm: document.getElementById('admin-stock-form'),
    stockOutlet: document.getElementById('admin-stock-outlet'),
    stockItem: document.getElementById('admin-stock-item'),
    stockAction: document.getElementById('admin-stock-action'),
    stockQuantity: document.getElementById('admin-stock-quantity'),
    stockQuantityLabel: document.getElementById('admin-stock-quantity-label'),
    stockNote: document.getElementById('admin-stock-note'),
    stockSubmit: document.getElementById('admin-stock-submit'),
    stockStatus: document.getElementById('admin-stock-status'),
    inventoryItemForm: document.getElementById('admin-inventory-item-form'),
    itemOutlet: document.getElementById('admin-item-outlet'),
    inventoryItemSubmit: document.getElementById('admin-inventory-item-submit'),
    supplierOrderForm: document.getElementById('admin-supplier-order-form'),
    orderOutlet: document.getElementById('admin-order-outlet'),
    supplierOrderLines: document.getElementById('admin-supplier-order-lines'),
    addOrderLine: document.getElementById('admin-add-order-line'),
    supplierOrderSubmit: document.getElementById('admin-supplier-order-submit'),
    supplierOrders: document.getElementById('admin-supplier-orders')
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

  function stationLabel(station) {
    return {
      STEAM_LINE: 'Steam line',
      GRILL_FRYER: 'Grill / fryer',
      ROLEX_GRIDDLE: 'Rolex griddle',
      BAR_BEVERAGE: 'Bar / beverage'
    }[station] || station;
  }

  function hasOriginalMenuArtwork(name) {
    return /chicken|rolex|luwombo|passion juice/i.test(name);
  }

  function fileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read the selected meal photo.'));
      reader.readAsDataURL(file);
    });
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
        <span class="ls-chip ls-chip--static">All tables (${total})</span>
        ${rows
          .map(
            (row) =>
              `<span class="ls-chip ls-chip--static">${F.escapeHtml(
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

  function markUpdated() {
    if (!els.updated) return;
    els.updated.textContent = `Updated ${F.formatTime(new Date().toISOString())} · auto 60s`;
  }

  function renderAll() {
    renderKpis();
    renderOutlets();
    renderFlags();
    renderOrders();
    renderTables();
    renderStaff();
    renderSurplusLogs();
    markUpdated();
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
              (item) => {
                const unavailableReason = item.availabilityReason || (item.is86 ? '86' : 'unavailable');
                return `<option value="${F.escapeHtml(item.id)}"${
                  item.isAvailable ? '' : ' disabled'
                }>${F.escapeHtml(item.name)}${item.isAvailable ? '' : ` (${F.escapeHtml(unavailableReason)})`}</option>`;
              }
            )
            .join('')}`
        : '<option value="">No menu items at this outlet</option>';
    } catch (error) {
      els.surplusItem.innerHTML = '<option value="">Could not load menu</option>';
      F.toast(error.message || 'Could not load surplus menu.', 'error');
    }
  }

  function renderMenuItems(items) {
    if (!items.length) {
      els.menuItems.innerHTML = '<div class="ls-empty">No meals at this outlet yet. Add the first meal above.</div>';
      return;
    }

    els.menuItems.innerHTML = items
      .map(
        (item) => `
          <article class="menu-item-editor" data-menu-item-id="${F.escapeHtml(item.id)}">
            ${
              item.imageUrl
                ? `<img src="${F.escapeHtml(item.imageUrl)}" alt="" loading="lazy" />`
                : '<div class="admin-kpi-label">No photo</div>'
            }
            <div class="menu-item-editor-copy">
              <strong>${F.escapeHtml(item.name)}</strong>
              <span>${F.escapeHtml(item.category)} · ${F.escapeHtml(stationLabel(item.station))}</span>
              <small>${F.escapeHtml(outletLabel(item.outlet))}</small>
              <small>${item.isAvailable ? 'Available' : F.escapeHtml(
                item.availabilityReason || (item.is86 ? '86 by manager' : 'Unavailable')
              )}</small>
            </div>
            <label class="ls-field">
              <span>Price (UGX)</span>
              <input class="ls-input" data-menu-price type="number" min="1" max="99999999" step="1" value="${F.escapeHtml(
                String(item.priceUgx)
              )}" required />
            </label>
            <label class="ls-field">
              <span>Replace meal photo (optional)</span>
              <input class="ls-input" data-menu-image type="file" accept="image/png,image/jpeg,image/webp" />
            </label>
            <button class="ls-btn ls-btn--ghost" type="button" data-menu-save>Save changes</button>
            ${
              item.imageUrl
                ? `<button class="ls-btn ls-btn--danger" type="button" data-menu-remove-image>${
                    hasOriginalMenuArtwork(item.name)
                      ? 'Remove uploaded photo (restore original)'
                      : 'Remove photo'
                  }</button>`
                : hasOriginalMenuArtwork(item.name)
                  ? `<button class="ls-btn ls-btn--danger" type="button" data-menu-original-visibility="${
                      item.hideOriginalImage ? 'show' : 'hide'
                    }">${item.hideOriginalImage ? 'Restore original photo' : 'Remove original photo'}</button>`
                  : '<small class="ls-help">No photo uploaded.</small>'
            }
          </article>`
      )
      .join('');
  }

  async function loadManagerMenu() {
    els.menuItems.innerHTML = '<div class="ls-loading">Loading menu items…</div>';
    try {
      const outlet = els.menuOutlet.value;
      const data = await F.request(`/api/v1/menu-items?outlet=${encodeURIComponent(outlet)}`);
      renderMenuItems(data.items || []);
    } catch (error) {
      els.menuItems.innerHTML = '<div class="ls-empty">Could not load menu items.</div>';
      F.toast(error.message || 'Could not load menu items.', 'error');
    }
  }

  async function submitMenuItem(event) {
    event.preventDefault();
    if (STATE.menuBusy) return;

    const form = els.menuCreateForm;
    const image = form.elements.image.files[0];
    if (!image || !['image/png', 'image/jpeg', 'image/webp'].includes(image.type)) {
      F.toast('Choose a PNG, JPEG, or WebP meal photo.', 'error');
      return;
    }
    if (image.size > 2 * 1024 * 1024) {
      F.toast('Meal photos must be no larger than 2 MB.', 'error');
      return;
    }

    STATE.menuBusy = true;
    els.menuCreateSubmit.disabled = true;
    els.menuCreateSubmit.textContent = 'Adding meal…';
    els.menuCreateStatus.textContent = 'Saving the new menu item…';
    try {
      const imageDataUrl = await fileAsDataUrl(image);
      const data = await F.request('/api/v1/menu-items', {
        method: 'POST',
        body: JSON.stringify({
          outlet: els.menuOutlet.value,
          name: form.elements.name.value.trim(),
          category: form.elements.category.value.trim(),
          priceUgx: Number(form.elements.priceUgx.value),
          station: form.elements.station.value,
          imageDataUrl
        })
      });
      form.reset();
      els.menuCreatePreview.hidden = true;
      els.menuCreatePreview.removeAttribute('src');
      els.menuCreateStatus.textContent = `${data.item.name} was added to ${outletLabel(data.item.outlet)}.`;
      F.toast(data.message || 'Meal added to the menu.', 'success');
      await Promise.all([loadManagerMenu(), loadSurplusMenu(els.menuOutlet.value)]);
    } catch (error) {
      els.menuCreateStatus.textContent = error.message || 'Meal could not be added.';
      F.toast(error.message || 'Meal could not be added.', 'error');
    } finally {
      STATE.menuBusy = false;
      els.menuCreateSubmit.disabled = false;
      els.menuCreateSubmit.textContent = 'Add meal to menu';
    }
  }

  async function saveMenuItem(button) {
    if (STATE.menuBusy) return;
    const row = button.closest('[data-menu-item-id]');
    const priceInput = row.querySelector('[data-menu-price]');
    const imageInput = row.querySelector('[data-menu-image]');
    const priceUgx = Number(priceInput.value);
    if (!Number.isFinite(priceUgx) || priceUgx <= 0 || priceUgx > 99999999) {
      F.toast('Enter a valid meal price in UGX.', 'error');
      priceInput.focus();
      return;
    }

    const payload = { priceUgx };
    if (imageInput.files.length) {
      const image = imageInput.files[0];
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(image.type)) {
        F.toast('Choose a PNG, JPEG, or WebP meal photo.', 'error');
        return;
      }
      if (image.size > 2 * 1024 * 1024) {
        F.toast('Meal photos must be no larger than 2 MB.', 'error');
        return;
      }
      try {
        payload.imageDataUrl = await fileAsDataUrl(image);
      } catch (error) {
        F.toast(error.message || 'Could not read the selected meal photo.', 'error');
        return;
      }
    }

    STATE.menuBusy = true;
    button.disabled = true;
    button.textContent = 'Saving…';
    try {
      const data = await F.request(`/api/v1/menu-items/${encodeURIComponent(row.dataset.menuItemId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      F.toast(`${data.item.name} updated.`, 'success');
      await loadManagerMenu();
    } catch (error) {
      F.toast(error.message || 'Menu item could not be updated.', 'error');
    } finally {
      STATE.menuBusy = false;
      button.disabled = false;
      button.textContent = 'Save changes';
    }
  }

  async function removeMenuItemImage(button) {
    if (STATE.menuBusy) return;
    const row = button.closest('[data-menu-item-id]');
    const originalText = button.textContent;
    STATE.menuBusy = true;
    button.disabled = true;
    button.textContent = 'Removing…';
    try {
      const data = await F.request(`/api/v1/menu-items/${encodeURIComponent(row.dataset.menuItemId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ removeImage: true })
      });
      F.toast(
        hasOriginalMenuArtwork(data.item.name)
          ? `Uploaded photo removed from ${data.item.name}. Original artwork restored.`
          : `Photo removed from ${data.item.name}.`,
        'success'
      );
      await loadManagerMenu();
    } catch (error) {
      F.toast(error.message || 'Meal photo could not be removed.', 'error');
    } finally {
      STATE.menuBusy = false;
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function setOriginalMenuArtworkVisibility(button) {
    if (STATE.menuBusy) return;
    const row = button.closest('[data-menu-item-id]');
    const hideOriginalImage = button.dataset.menuOriginalVisibility === 'hide';
    const originalText = button.textContent;
    STATE.menuBusy = true;
    button.disabled = true;
    button.textContent = hideOriginalImage ? 'Removing…' : 'Restoring…';
    try {
      const data = await F.request(`/api/v1/menu-items/${encodeURIComponent(row.dataset.menuItemId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ hideOriginalImage })
      });
      F.toast(
        hideOriginalImage
          ? `Original photo removed from ${data.item.name}.`
          : `Original photo restored for ${data.item.name}.`,
        'success'
      );
      await loadManagerMenu();
    } catch (error) {
      F.toast(error.message || 'Original menu photo could not be updated.', 'error');
    } finally {
      STATE.menuBusy = false;
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function inventoryUnitLabel(unit) {
    return {
      MILLILITERS: 'mL',
      LITERS: 'L',
      GRAMS: 'g',
      KILOGRAMS: 'kg',
      PIECES: 'pieces',
      PORTIONS: 'portions',
      UNITS: 'units'
    }[unit] || unit;
  }

  function inventoryOutletFor(select) {
    return select.value || (STATE.scope !== 'ALL' ? STATE.scope : 'FOODIZO_HAM_TOWERS');
  }

  function productsAt(outlet) {
    return (STATE.inventory?.items || []).filter((item) => item.outlet === outlet);
  }

  function updateInventorySelectors() {
    const stockOutlet = inventoryOutletFor(els.stockOutlet);
    const optionsFor = (outlet) => {
      const products = productsAt(outlet);
      return `<option value="">${products.length ? 'Select a product' : 'No products at this outlet'}</option>${products
        .map((item) => `<option value="${F.escapeHtml(item.id)}">${F.escapeHtml(item.itemName)} (${F.escapeHtml(
          inventoryUnitLabel(item.unitOfMeasure)
        )})</option>`)
        .join('')}`;
    };

    const previousStockItem = els.stockItem.value;
    els.stockItem.innerHTML = optionsFor(stockOutlet);
    if (productsAt(stockOutlet).some((item) => item.id === previousStockItem)) {
      els.stockItem.value = previousStockItem;
    }

    els.supplierOrderLines.querySelectorAll('[data-order-product]').forEach((select) => {
      const previous = select.value;
      select.innerHTML = optionsFor(inventoryOutletFor(els.orderOutlet));
      if (productsAt(inventoryOutletFor(els.orderOutlet)).some((item) => item.id === previous)) {
        select.value = previous;
      }
    });
  }

  function renderInventory() {
    const items = STATE.inventory?.items || [];
    els.inventoryBody.innerHTML = items.length
      ? items.map((item) => {
          const unit = inventoryUnitLabel(item.unitOfMeasure);
          const status = [
            item.openingCountRecorded
              ? ''
              : '<span class="admin-inventory-status is-pending">Opening count pending</span>',
            item.isLow
              ? '<span class="admin-inventory-status is-low">Reorder needed</span>'
              : '<span class="admin-inventory-status">In stock</span>'
          ].filter(Boolean).join(' ');
          return `<tr>
            <td><strong>${F.escapeHtml(item.itemName)}</strong></td>
            <td>${F.escapeHtml(outletLabel(item.outlet))}</td>
            <td>${Number(item.currentStock).toLocaleString()} ${F.escapeHtml(unit)}</td>
            <td>${Number(item.alertThreshold).toLocaleString()} ${F.escapeHtml(unit)}</td>
            <td>${status}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="5" class="ls-help">No kitchen products yet. Add a product below to start tracking stock.</td></tr>';

    const movements = STATE.inventory?.movements || [];
    els.stockActivity.innerHTML = movements.length
      ? movements.slice(0, 15).map((movement) => {
          const labels = {
            STOCK_COUNT: 'Opening / stock count',
            MANUAL_USAGE: 'Stock taken / used',
            SALES_USAGE: 'Recipe usage from sales',
            SUPPLIER_RECEIPT: 'Supplier delivery received'
          };
          const amount = Number(movement.quantityChange);
          const signed = amount > 0 ? '+' : '';
          const businessDate = String(movement.businessDate || '').slice(0, 10);
          return `<div class="admin-supplier-order-line">
            <span><strong>${F.escapeHtml(movement.itemName)}</strong> · ${F.escapeHtml(labels[movement.type] || movement.type)} · ${F.escapeHtml(outletLabel(movement.outlet))}</span>
            <span>${signed}${amount.toLocaleString()} ${F.escapeHtml(inventoryUnitLabel(movement.unitOfMeasure))} · on hand ${Number(movement.stockAfter).toLocaleString()} · business date ${F.escapeHtml(businessDate)} · ${F.escapeHtml(F.relativeTime(movement.createdAt))}</span>
          </div>`;
        }).join('')
      : '<div class="ls-empty">No stock changes recorded yet.</div>';

    renderSupplierOrders();
    updateInventorySelectors();
  }

  function renderSupplierOrders() {
    const orders = STATE.inventory?.supplierOrders || [];
    els.supplierOrders.innerHTML = orders.length
      ? orders.map((order) => {
          const lines = order.items.map((item) => {
            const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
            return `<label class="admin-receive-line">
              <span>${F.escapeHtml(item.itemName)} · ${Number(item.quantityReceived).toLocaleString()} / ${Number(item.quantityOrdered).toLocaleString()} ${F.escapeHtml(
                inventoryUnitLabel(item.unitOfMeasure)
              )} received</span>
              <input class="ls-input admin-receive-quantity" type="number" min="0" max="${remaining}" step="0.01" value="${remaining}" aria-label="Quantity of ${F.escapeHtml(item.itemName)} received" data-receive-item-id="${F.escapeHtml(item.id)}" />
            </label>`;
          }).join('');
          return `<article class="admin-supplier-order" data-supplier-order-id="${F.escapeHtml(order.id)}">
            <div class="admin-supplier-order-head">
              <strong>${F.escapeHtml(order.supplierName)} · ${F.escapeHtml(outletLabel(order.outlet))}</strong>
              <span class="admin-inventory-status">${F.escapeHtml(order.status === 'PARTIALLY_RECEIVED' ? 'Partially received' : 'Awaiting delivery')}</span>
            </div>
            <div class="admin-supplier-order-lines">${lines}</div>
            ${order.notes ? `<p class="ls-help">${F.escapeHtml(order.notes)}</p>` : ''}
            <button class="ls-btn ls-btn--small" type="button" data-order-receive>Record delivery</button>
          </article>`;
        }).join('')
      : '<div class="ls-empty">No supplier orders awaiting delivery.</div>';
  }

  async function loadInventory() {
    const query = STATE.scope !== 'ALL' ? `?outlet=${encodeURIComponent(STATE.scope)}` : '';
    const data = await F.request(`/api/v1/inventory${query}`);
    STATE.inventory = data;
    renderInventory();
  }

  function updateInventoryOutletScopes() {
    const outlet = STATE.user?.outlet || (STATE.scope !== 'ALL' ? STATE.scope : 'FOODIZO_HAM_TOWERS');
    const hideOutlet = Boolean(STATE.user?.outlet || STATE.scope !== 'ALL');
    document.querySelectorAll('.admin-inventory-outlet-wrap').forEach((wrap) => {
      wrap.hidden = hideOutlet;
    });
    [els.stockOutlet, els.itemOutlet, els.orderOutlet].forEach((select) => {
      select.value = outlet;
    });
    updateInventorySelectors();
  }

  function addSupplierOrderLine() {
    const line = document.createElement('div');
    line.className = 'admin-order-line';
    line.innerHTML = `<select class="ls-select" data-order-product required aria-label="Product">${productsAt(
      inventoryOutletFor(els.orderOutlet)
    ).map((item) => `<option value="${F.escapeHtml(item.id)}">${F.escapeHtml(item.itemName)} (${F.escapeHtml(
      inventoryUnitLabel(item.unitOfMeasure)
    )})</option>`).join('')}</select>
      <input class="ls-input" data-order-quantity type="number" min="0.01" step="0.01" placeholder="Quantity" aria-label="Order quantity" required />
      <input class="ls-input admin-order-cost" data-order-unit-cost type="number" min="0" step="1" placeholder="Unit cost in UGX (optional)" aria-label="Unit cost in UGX (optional)" />
      <button class="ls-btn ls-btn--ghost ls-btn--small" type="button" data-remove-order-line aria-label="Remove product">Remove</button>`;
    els.supplierOrderLines.appendChild(line);
    updateInventorySelectors();
  }

  async function submitStockUpdate(event) {
    event.preventDefault();
    if (STATE.inventoryBusy) return;
    const quantity = Number(els.stockQuantity.value);
    if (!els.stockItem.value || !Number.isFinite(quantity) || quantity < 0 ||
      (els.stockAction.value === 'MANUAL_USAGE' && quantity <= 0)) {
      F.toast('Select a product and enter a valid quantity for this stock update.', 'error');
      return;
    }
    STATE.inventoryBusy = true;
    els.stockSubmit.disabled = true;
    els.stockSubmit.textContent = 'Saving…';
    try {
      const data = await F.request('/api/v1/inventory/stock', {
        method: 'POST',
        body: JSON.stringify({
          outlet: inventoryOutletFor(els.stockOutlet),
          inventoryId: els.stockItem.value,
          action: els.stockAction.value,
          quantity,
          note: els.stockNote.value.trim() || undefined
        })
      });
      els.stockStatus.textContent = `Stock saved. ${Number(data.item.currentStock).toLocaleString()} units are now on hand.`;
      els.stockQuantity.value = '';
      els.stockNote.value = '';
      F.toast('Kitchen stock updated.', 'success');
      await Promise.all([loadInventory(), loadOverview(false)]);
    } catch (error) {
      els.stockStatus.textContent = error.message || 'Stock could not be updated.';
      F.toast(error.message || 'Stock could not be updated.', 'error');
    } finally {
      STATE.inventoryBusy = false;
      els.stockSubmit.disabled = false;
      els.stockSubmit.textContent = 'Save stock update';
    }
  }

  async function submitInventoryItem(event) {
    event.preventDefault();
    if (STATE.inventoryBusy) return;
    const form = event.currentTarget;
    STATE.inventoryBusy = true;
    els.inventoryItemSubmit.disabled = true;
    els.inventoryItemSubmit.textContent = 'Adding…';
    try {
      const data = await F.request('/api/v1/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          outlet: inventoryOutletFor(els.itemOutlet),
          itemName: form.elements.itemName.value.trim(),
          unitOfMeasure: form.elements.unitOfMeasure.value,
          alertThreshold: Number(form.elements.alertThreshold.value)
        })
      });
      form.reset();
      form.elements.alertThreshold.value = '5';
      F.toast(`${data.item.itemName} added to kitchen stock. Record its opening count to set the starting quantity.`, 'success');
      await loadInventory();
    } catch (error) {
      F.toast(error.message || 'Kitchen product could not be added.', 'error');
    } finally {
      STATE.inventoryBusy = false;
      els.inventoryItemSubmit.disabled = false;
      els.inventoryItemSubmit.textContent = 'Add product';
    }
  }

  async function submitSupplierOrder(event) {
    event.preventDefault();
    if (STATE.inventoryBusy) return;
    const lines = [...els.supplierOrderLines.querySelectorAll('.admin-order-line')].map((line) => ({
      inventoryId: line.querySelector('[data-order-product]').value,
      quantity: Number(line.querySelector('[data-order-quantity]').value),
      unitCostUgx: line.querySelector('[data-order-unit-cost]').value === ''
        ? undefined
        : Number(line.querySelector('[data-order-unit-cost]').value)
    }));
    if (lines.some((line) => !line.inventoryId || !Number.isFinite(line.quantity) || line.quantity <= 0 ||
      (line.unitCostUgx !== undefined && (!Number.isFinite(line.unitCostUgx) || line.unitCostUgx < 0)))) {
      F.toast('Choose a product and enter a valid order quantity and unit cost.', 'error');
      return;
    }
    if (new Set(lines.map((line) => line.inventoryId)).size !== lines.length) {
      F.toast('Each product can only appear once in a supplier order.', 'error');
      return;
    }

    const form = event.currentTarget;
    STATE.inventoryBusy = true;
    els.supplierOrderSubmit.disabled = true;
    els.supplierOrderSubmit.textContent = 'Placing order…';
    try {
      const data = await F.request('/api/v1/inventory/supplier-orders', {
        method: 'POST',
        body: JSON.stringify({
          outlet: inventoryOutletFor(els.orderOutlet),
          supplierName: form.elements.supplierName.value.trim(),
          notes: form.elements.notes.value.trim() || undefined,
          items: lines
        })
      });
      form.reset();
      els.supplierOrderLines.innerHTML = '';
      addSupplierOrderLine();
      F.toast(data.message || 'Supplier order placed.', 'success');
      await loadInventory();
    } catch (error) {
      F.toast(error.message || 'Supplier order could not be placed.', 'error');
    } finally {
      STATE.inventoryBusy = false;
      els.supplierOrderSubmit.disabled = false;
      els.supplierOrderSubmit.textContent = 'Place supplier order';
    }
  }

  async function recordSupplierDelivery(button) {
    if (STATE.inventoryBusy) return;
    const order = button.closest('[data-supplier-order-id]');
    const items = [...order.querySelectorAll('[data-receive-item-id]')]
      .map((input) => ({ itemId: input.dataset.receiveItemId, quantity: Number(input.value) }))
      .filter((item) => item.quantity > 0);
    if (!items.length || items.some((item) => !Number.isFinite(item.quantity))) {
      F.toast('Enter at least one delivered quantity greater than zero.', 'error');
      return;
    }
    STATE.inventoryBusy = true;
    button.disabled = true;
    button.textContent = 'Recording…';
    try {
      const data = await F.request(`/api/v1/inventory/supplier-orders/${encodeURIComponent(order.dataset.supplierOrderId)}/receive`, {
        method: 'POST',
        body: JSON.stringify({ items })
      });
      F.toast(data.message || 'Delivery recorded and stock updated.', 'success');
      await Promise.all([loadInventory(), loadOverview(false)]);
    } catch (error) {
      F.toast(error.message || 'Supplier delivery could not be recorded.', 'error');
    } finally {
      STATE.inventoryBusy = false;
      button.disabled = false;
      button.textContent = 'Record delivery';
    }
  }

  function scheduleRefresh() {
    if (STATE.refreshTimer) window.clearTimeout(STATE.refreshTimer);
    STATE.refreshTimer = window.setTimeout(async () => {
      STATE.refreshTimer = null;
      try {
        await Promise.all([loadOverview(false), loadInventory()]);
      } catch (error) {
        F.toast(error.message || 'Manager dashboard refresh failed.', 'error');
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

  async function submitStaffAccount(event) {
    event.preventDefault();
    if (STATE.staffBusy) return;

    const form = els.createStaffForm;
    const fullName = form.elements.fullName.value.trim();
    const phoneNumber = form.elements.phoneNumber.value.trim();
    const role = form.elements.role.value;
    const outlet = els.staffOutlet.value;
    const pin = form.elements.pin.value;
    const confirmPin = form.elements.confirmPin.value;

    if (pin !== confirmPin) {
      els.staffStatus.textContent = 'The PIN entries do not match.';
      F.toast('The PIN entries do not match.', 'error');
      form.elements.confirmPin.focus();
      return;
    }

    STATE.staffBusy = true;
    els.createStaffSubmit.disabled = true;
    els.createStaffSubmit.textContent = 'Creating account…';
    els.staffStatus.textContent = 'Creating staff access…';
    try {
      const data = await F.request('/api/v1/auth/staff', {
        method: 'POST',
        body: JSON.stringify({ fullName, phoneNumber, role, outlet, pin })
      });
      form.reset();
      els.staffOutlet.value = STATE.user.outlet || 'FOODIZO_HAM_TOWERS';
      els.staffStatus.textContent = `${data.staff.fullName} can now sign in with their staff PIN.`;
      F.toast(data.message || 'Staff account created.', 'success');
      try {
        await loadOverview(false);
      } catch (error) {
        els.staffStatus.textContent += ' The roster could not refresh; use Refresh data.';
        F.toast(error.message || 'Account created, but the staff roster did not refresh.', 'error');
      }
    } catch (error) {
      els.staffStatus.textContent = error.message || 'Staff account could not be created.';
      F.toast(error.message || 'Staff account could not be created.', 'error');
    } finally {
      STATE.staffBusy = false;
      els.createStaffSubmit.disabled = false;
      els.createStaffSubmit.textContent = 'Create staff account';
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
    els.inventoryRefresh.addEventListener('click', () => {
      loadInventory().then(() => F.toast('Kitchen stock refreshed.', 'success')).catch((error) => {
        F.toast(error.message || 'Kitchen stock could not be refreshed.', 'error');
      });
    });
    els.stockForm.addEventListener('submit', submitStockUpdate);
    els.stockAction.addEventListener('change', () => {
      const isCount = els.stockAction.value === 'STOCK_COUNT';
      els.stockQuantityLabel.textContent = isCount ? 'Counted quantity' : 'Quantity used';
      els.stockQuantity.min = isCount ? '0' : '0.01';
    });
    els.stockOutlet.addEventListener('change', updateInventorySelectors);
    els.orderOutlet.addEventListener('change', updateInventorySelectors);
    els.inventoryItemForm.addEventListener('submit', submitInventoryItem);
    els.supplierOrderForm.addEventListener('submit', submitSupplierOrder);
    els.addOrderLine.addEventListener('click', addSupplierOrderLine);
    els.supplierOrderLines.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-remove-order-line]');
      if (!removeButton) return;
      const lines = els.supplierOrderLines.querySelectorAll('.admin-order-line');
      if (lines.length <= 1) {
        F.toast('A supplier order needs at least one product line.', 'info');
        return;
      }
      removeButton.closest('.admin-order-line').remove();
    });
    els.supplierOrders.addEventListener('click', (event) => {
      const receiveButton = event.target.closest('[data-order-receive]');
      if (receiveButton) recordSupplierDelivery(receiveButton);
    });

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
    els.createStaffForm.addEventListener('submit', submitStaffAccount);
    els.menuCreateForm.addEventListener('submit', submitMenuItem);
    els.menuOutlet.addEventListener('change', () => {
      loadManagerMenu();
      loadSurplusMenu(els.menuOutlet.value);
    });
    els.menuCreateForm.elements.image.addEventListener('change', async (event) => {
      const image = event.target.files[0];
      if (!image) {
        els.menuCreatePreview.hidden = true;
        els.menuCreatePreview.removeAttribute('src');
        return;
      }
      if (image.size > 2 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(image.type)) {
        els.menuCreatePreview.hidden = true;
        F.toast('Choose a PNG, JPEG, or WebP image no larger than 2 MB.', 'error');
        event.target.value = '';
        return;
      }
      try {
        els.menuCreatePreview.src = await fileAsDataUrl(image);
        els.menuCreatePreview.hidden = false;
      } catch (error) {
        F.toast(error.message || 'Could not preview the selected meal photo.', 'error');
      }
    });
    els.menuItems.addEventListener('click', (event) => {
      const button = event.target.closest('[data-menu-save]');
      if (button) saveMenuItem(button);
      const removeButton = event.target.closest('[data-menu-remove-image]');
      if (removeButton) removeMenuItemImage(removeButton);
      const visibilityButton = event.target.closest('[data-menu-original-visibility]');
      if (visibilityButton) setOriginalMenuArtworkVisibility(visibilityButton);
    });
    els.digestBtn.addEventListener('click', dispatchDigest);

    els.outletFilter.addEventListener('change', async () => {
      STATE.scope = els.outletFilter.value;
      if (STATE.scope !== 'ALL') {
        els.cashOutlet.value = STATE.scope;
        els.surplusOutlet.value = STATE.scope;
        await loadSurplusMenu(STATE.scope);
      }
      updateInventoryOutletScopes();
      try {
        await loadOverview(true);
        await loadInventory();
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
      els.staffOutlet.value = user.outlet;
      els.staffOutlet.disabled = true;
      els.cashOutlet.value = user.outlet;
      els.surplusOutlet.value = user.outlet;
      els.menuOutlet.value = user.outlet;
      els.menuOutletWrap.hidden = true;
      els.cashOutletWrap.hidden = true;
      els.surplusOutletWrap.hidden = true;
    } else {
      STATE.scope = 'ALL';
      els.outletWrap.hidden = false;
      els.staffOutlet.disabled = false;
      els.staffOutlet.value = 'FOODIZO_HAM_TOWERS';
      els.outletFilter.value = 'ALL';
      els.cashOutlet.value = 'FOODIZO_HAM_TOWERS';
      els.surplusOutlet.value = 'FOODIZO_HAM_TOWERS';
      els.menuOutlet.value = 'FOODIZO_HAM_TOWERS';
      els.menuOutletWrap.hidden = false;
      els.cashOutletWrap.hidden = false;
      els.surplusOutletWrap.hidden = false;
    }
    updateInventoryOutletScopes();
    if (!els.supplierOrderLines.children.length) addSupplierOrderLine();

    try {
      await Promise.all([
        loadOverview(true),
        loadSurplusMenu(els.surplusOutlet.value),
        loadManagerMenu(),
        loadInventory()
      ]);
    } catch (error) {
      F.toast(error.message || 'Could not load the manager dashboard.', 'error');
    }
    startEvents();
    window.setInterval(() => {
      if (!STATE.refreshTimer && !STATE.busy) {
        Promise.all([loadOverview(false), loadInventory()]).catch((error) => {
          F.toast(error.message || 'Manager dashboard refresh failed.', 'error');
        });
      }
    }, 60000);
  }

  init().catch((error) => {
    F.toast(error.message || 'Manager dashboard failed to start.', 'error');
  });
})();
