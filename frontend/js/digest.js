/**
 * Read-only owner digest at /d/:token.
 *
 * Public page. It calls the unauthenticated 72-hour digest view endpoint and
 * renders only the persisted aggregate payload: no customer name, phone
 * number, delivery note, or GPS coordinate is present in the response.
 */
(function () {
  'use strict';

  const F = window.Foodizo;
  const els = {
    loading: document.getElementById('digest-loading'),
    error: document.getElementById('digest-error'),
    errorTitle: document.getElementById('digest-error-title'),
    errorMessage: document.getElementById('digest-error-message'),
    content: document.getElementById('digest-content'),
    subtitle: document.getElementById('digest-subtitle'),
    status: document.getElementById('digest-status'),
    gross: document.getElementById('digest-gross'),
    grossNote: document.getElementById('digest-gross-note'),
    orders: document.getElementById('digest-orders'),
    ordersNote: document.getElementById('digest-orders-note'),
    cash: document.getElementById('digest-cash'),
    cashNote: document.getElementById('digest-cash-note'),
    flagsCount: document.getElementById('digest-flags-count'),
    flagsNote: document.getElementById('digest-flags-note'),
    metrics: document.getElementById('digest-metrics'),
    outlets: document.getElementById('digest-outlets'),
    flags: document.getElementById('digest-flags'),
    lowStock: document.getElementById('digest-low-stock')
  };

  function outletLabel(outlet) {
    return F.OUTLET_LABEL[outlet] || String(outlet || 'Unknown outlet');
  }

  function showError(title, message) {
    els.loading.hidden = true;
    els.content.hidden = true;
    els.status.hidden = true;
    els.error.hidden = false;
    els.errorTitle.textContent = title;
    els.errorMessage.textContent = message;
    els.subtitle.textContent = 'This digest link could not be opened.';
  }

  function statusInfo(data) {
    const status = String(data.status || 'GENERATED').toUpperCase();
    const sms = String(data.smsStatus || '').toUpperCase();
    const email = String(data.emailStatus || '').toUpperCase();

    if (status === 'FAILED') {
      return {
        label: 'SMS failed',
        detail: data.error || 'The digest was persisted, but SMS dispatch failed.'
      };
    }

    if (status === 'PARTIAL') {
      const smsLine =
        sms === 'MOCK'
          ? 'SMS was simulated in development; no carrier message was sent.'
          : sms === 'LIVE'
            ? 'SMS was sent live.'
            : 'The SMS channel outcome was not recorded.';
      const emailLine =
        email === 'NOT_CONFIGURED'
          ? 'Email is not configured in Phase 1.'
          : 'Email was not delivered.';
      return { label: 'Partial delivery', detail: `${smsLine} ${emailLine}` };
    }

    if (status === 'SENT') {
      return { label: 'Sent', detail: 'All requested channels reported success.' };
    }

    return {
      label: 'Generated',
      detail: 'The digest was generated, but no channel outcome was recorded.'
    };
  }

  function metric(label, value) {
    return `
      <div class="digest-metric">
        <span>${F.escapeHtml(label)}</span>
        <strong>${value}</strong>
      </div>`;
  }

  function renderKpis(data) {
    const consolidated = data.payload.consolidated || {};
    const summary = data.payload;
    const status = statusInfo(data);

    els.status.hidden = false;
    els.status.dataset.status = String(data.status || 'GENERATED').toUpperCase();
    els.status.textContent = status.label;
    els.status.title = status.detail;

    els.subtitle.textContent = `Business date ${F.formatDate(
      summary.digestDate || data.digestDate
    )} · generated ${F.formatTime(data.generatedAt)} EAT · ${status.detail}`;

    els.gross.textContent = F.formatUGX(consolidated.grossUgx);
    els.grossNote.textContent = `${F.formatNumber(consolidated.paymentCount)} successful payment(s)`;
    els.orders.textContent = F.formatNumber(consolidated.totalOrders);
    els.cash.textContent = F.formatUGX(consolidated.expectedCashUgx);

    if (consolidated.cashCountStatus === 'SUBMITTED') {
      const variance = Number(consolidated.cashVarianceUgx || 0);
      els.cashNote.textContent = `Counted ${F.formatUGX(
        consolidated.countedCashUgx || 0
      )} · variance ${variance === 0 ? 'balanced' : F.formatUGX(variance)}`;
    } else {
      els.cashNote.textContent = 'Cash count missing for at least one outlet';
    }

    els.flagsCount.textContent = F.formatNumber(summary.flagCount);
    els.flagsNote.textContent = summary.flagCount
      ? summary.flags.map((flag) => flag.code).join(' · ')
      : 'No open exceptions in this digest';
  }

  function renderMetrics(data) {
    const consolidated = data.payload.consolidated || {};
    const surplus = consolidated.surplus || {};

    els.metrics.innerHTML = [
      metric('MTN MoMo', F.formatUGX(consolidated.mtnUgx)),
      metric('Airtel Money', F.formatUGX(consolidated.airtelUgx)),
      metric('Manual MoMo', F.formatUGX(consolidated.manualMomoUgx)),
      metric('Cash', F.formatUGX(consolidated.cashUgx)),
      metric('Refunded', `${F.formatUGX(consolidated.refundedUgx)} (${F.formatNumber(consolidated.refundedCount)})`),
      metric('Refund pending', `${F.formatUGX(consolidated.refundPendingUgx)} (${F.formatNumber(consolidated.refundPendingCount)})`),
      metric('Delivery fees', F.formatUGX(consolidated.deliveryFeesUgx)),
      metric('Rider advances (net)', F.formatUGX(consolidated.riderAdvancesNetUgx)),
      metric('Net delivery contribution', F.formatUGX(consolidated.netDeliveryContributionUgx)),
      metric('Failed payments', F.formatNumber(consolidated.failedPaymentCount)),
      metric('Failed deliveries', F.formatNumber(consolidated.failedDeliveryCount)),
      metric(
        'Surplus resolved',
        `${F.formatNumber(surplus.clearancePortions)} clearance · ${F.formatNumber(
          surplus.staffMealPortions
        )} staff · ${F.formatNumber(surplus.wastePortions)} waste`
      ),
      metric('Stale orders', F.formatNumber(consolidated.staleOrderCount)),
      metric('Low-stock items', F.formatNumber((consolidated.lowStock || []).length))
    ].join('');
  }

  function renderOutlets(data) {
    const outlets = data.payload.outlets || [];
    if (!outlets.length) {
      els.outlets.innerHTML = '<div class="ls-empty">No outlet summary returned.</div>';
      return;
    }

    els.outlets.innerHTML = outlets
      .map((row) => {
        const variance = row.cashVarianceUgx;
        const cashLine =
          row.cashCountStatus === 'MISSING'
            ? 'Missing'
            : `${F.formatUGX(row.countedCashUgx || 0)}${
                variance === null || variance === undefined
                  ? ''
                  : ` (${Number(variance) === 0 ? 'balanced' : F.formatUGX(variance)})`
              }`;
        const surplus = row.surplus || {};
        return `
          <article class="admin-outlet-card">
            <div class="admin-outlet-name">${F.escapeHtml(outletLabel(row.outlet))}</div>
            <div class="admin-outlet-grid">
              <div><span>Gross</span><strong>${F.formatUGX(row.grossUgx)}</strong></div>
              <div><span>Completed</span><strong>${F.formatNumber(row.totalOrders)}</strong></div>
              <div><span>Cash counted</span><strong>${cashLine}</strong></div>
              <div><span>Expected cash</span><strong>${F.formatUGX(row.expectedCashUgx)}</strong></div>
              <div><span>MTN · Airtel</span><strong>${F.formatUGX(row.mtnUgx)} · ${F.formatUGX(row.airtelUgx)}</strong></div>
              <div><span>Manual MoMo</span><strong>${F.formatUGX(row.manualMomoUgx)}</strong></div>
              <div><span>Refund pending</span><strong>${F.formatUGX(row.refundPendingUgx)} (${F.formatNumber(row.refundPendingCount)})</strong></div>
              <div><span>Refunded</span><strong>${F.formatUGX(row.refundedUgx)} (${F.formatNumber(row.refundedCount)})</strong></div>
              <div><span>Delivery fees</span><strong>${F.formatUGX(row.deliveryFeesUgx)}</strong></div>
              <div><span>Rider advances (net)</span><strong>${F.formatUGX(row.riderAdvancesNetUgx)}</strong></div>
              <div><span>Failed payments</span><strong>${F.formatNumber(row.failedPaymentCount)}</strong></div>
              <div><span>Failed deliveries</span><strong>${F.formatNumber(row.failedDeliveryCount)}</strong></div>
              <div><span>Surplus</span><strong>${F.formatNumber(surplus.clearancePortions)} clearance · ${F.formatNumber(
                surplus.staffMealPortions
              )} staff · ${F.formatNumber(surplus.wastePortions)} waste</strong></div>
              <div><span>Stale orders</span><strong>${F.formatNumber(row.staleOrderCount)}</strong></div>
              <div><span>Low stock</span><strong>${F.formatNumber((row.lowStock || []).length)} item(s)</strong></div>
            </div>
          </article>`;
      })
      .join('');
  }

  function renderFlags(data) {
    const flags = data.payload.flags || [];
    if (!flags.length) {
      els.flags.innerHTML =
        '<div class="ls-empty">No digest flags. Cash, refunds, deliveries, stock and stale orders are clear.</div>';
      return;
    }

    els.flags.innerHTML = flags
      .map(
        (flag) => `
          <div class="admin-flag">
            <code>${F.escapeHtml(flag.code)}</code>
            <span>${F.escapeHtml(flag.message)}</span>
          </div>`
      )
      .join('');
  }

  function renderLowStock(data) {
    const rows = (data.payload.outlets || []).flatMap((outlet) =>
      (outlet.lowStock || []).map((item) => ({ outlet: outlet.outlet, item }))
    );

    if (!rows.length) {
      els.lowStock.innerHTML = '<tr><td colspan="4" class="ls-help">No low-stock items.</td></tr>';
      return;
    }

    els.lowStock.innerHTML = rows
      .map(
        ({ outlet, item }) => `
          <tr>
            <td>${F.escapeHtml(item.itemName)}</td>
            <td>${F.escapeHtml(outletLabel(outlet))}</td>
            <td class="is-right">${F.formatNumber(item.currentStock)} ${F.escapeHtml(item.unit)}</td>
            <td class="is-right">${F.formatNumber(item.alertThreshold)} ${F.escapeHtml(item.unit)}</td>
          </tr>`
      )
      .join('');
  }

  function render(data) {
    els.loading.hidden = true;
    els.error.hidden = true;
    els.content.hidden = false;
    renderKpis(data);
    renderMetrics(data);
    renderOutlets(data);
    renderFlags(data);
    renderLowStock(data);
  }

  function tokenFromPath() {
    const match = window.location.pathname.match(/^\/d\/([A-Za-z0-9_-]+)\/?$/);
    return match ? match[1] : null;
  }

  async function load() {
    const token = tokenFromPath();
    if (!token) {
      showError('Invalid digest link', 'The URL does not contain a digest token.');
      return;
    }

    let response;
    try {
      response = await fetch(`/api/v1/digest/view/${encodeURIComponent(token)}`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin'
      });
    } catch (error) {
      showError(
        'Could not reach the digest service',
        error && error.message ? error.message : 'Check the network connection and try again.'
      );
      return;
    }

    let data = null;
    try {
      data = await response.json();
    } catch (_error) {
      data = null;
    }

    if (!response.ok) {
      const title =
        data && data.code === 'DIGEST_LINK_EXPIRED'
          ? 'Digest link expired'
          : 'Digest link unavailable';
      showError(
        title,
        (data && data.message) || `The digest could not be loaded (HTTP ${response.status}).`
      );
      return;
    }

    if (!data || !data.payload || !data.payload.consolidated) {
      showError('Digest payload unavailable', 'The digest record exists but its payload is incomplete.');
      return;
    }

    render(data);
  }

  load();
})();
