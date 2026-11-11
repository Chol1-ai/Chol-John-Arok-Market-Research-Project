(function () {
  'use strict';

  const F = window.Foodizo;
  const STATE = {
    user: null,
    active: [],
    review: [],
    events: null,
    refreshTimer: null,
    busy: false,
    cashOnDelivery: false
  };

  const els = {
    active: document.getElementById('dispatch-active'),
    review: document.getElementById('dispatch-review'),
    activeSub: document.getElementById('dispatch-active-sub'),
    reviewSub: document.getElementById('dispatch-review-sub'),
    refresh: document.getElementById('dispatch-refresh'),
    updated: document.getElementById('dispatch-updated'),
    live: document.getElementById('dispatch-live'),
    liveText: document.getElementById('dispatch-live-text'),
    awaiting: document.getElementById('dispatch-awaiting'),
    transit: document.getElementById('dispatch-transit'),
    reviewCount: document.getElementById('dispatch-review-count'),
    value: document.getElementById('dispatch-value'),
    assignModal: document.getElementById('dispatch-assign-modal'),
    assignForm: document.getElementById('dispatch-assign-form'),
    assignSub: document.getElementById('dispatch-assign-sub'),
    orderId: document.getElementById('dispatch-order-id'),
    riderName: document.getElementById('dispatch-rider-name'),
    riderPhone: document.getElementById('dispatch-rider-phone'),
    plate: document.getElementById('dispatch-plate'),
    stage: document.getElementById('dispatch-stage'),
    method: document.getElementById('dispatch-method'),
    advance: document.getElementById('dispatch-advance'),
    assignSubmit: document.getElementById('dispatch-assign-submit'),
    assignClose: document.getElementById('dispatch-assign-close'),
    assignCancel: document.getElementById('dispatch-assign-cancel'),
    completeModal: document.getElementById('dispatch-complete-modal'),
    completeForm: document.getElementById('dispatch-complete-form'),
    completeSub: document.getElementById('dispatch-complete-sub'),
    completeOrderId: document.getElementById('dispatch-complete-order-id'),
    outcome: document.getElementById('dispatch-outcome'),
    advanceReturned: document.getElementById('dispatch-advance-returned'),
    cashTenderedWrap: document.getElementById('dispatch-cash-tendered-wrap'),
    cashTendered: document.getElementById('dispatch-cash-tendered'),
    completeNote: document.getElementById('dispatch-complete-note'),
    completeSubmit: document.getElementById('dispatch-complete-submit'),
    completeClose: document.getElementById('dispatch-complete-close'),
    completeCancel: document.getElementById('dispatch-complete-cancel')
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

  function renderSummary() {
    const awaiting = STATE.active.filter((row) => row.handoffState === 'AWAITING_RIDER').length;
    const transit = STATE.active.filter((row) => row.handoffState === 'ON_THE_WAY').length;
    const value = STATE.active.reduce((sum, row) => sum + Number(row.totalUgx || 0), 0);
    els.awaiting.textContent = String(awaiting);
    els.transit.textContent = String(transit);
    els.reviewCount.textContent = String(STATE.review.length);
    els.value.textContent = F.formatUGX(value);
  }

  function renderActive() {
    els.activeSub.textContent = `${STATE.active.length} active delivery order(s)`;
    if (!STATE.active.length) {
      els.active.innerHTML =
        '<div class="ls-empty">No READY delivery orders waiting for a rider. The queue updates live.</div>';
      return;
    }

    els.active.innerHTML = STATE.active
      .map((order) => {
        const onTheWay = order.handoffState === 'ON_THE_WAY';
        const handoff = order.handoff || {};
        const items = (order.items || [])
          .map((item) => `${item.quantity}× ${F.escapeHtml(item.name)}`)
          .join(' · ');
        return `
          <article class="dispatch-card${onTheWay ? ' is-transit' : ''}">
            <div class="dispatch-card-head">
              <div>
                <div class="dispatch-token">${F.escapeHtml(order.tokenNumber || '—')}</div>
                <div class="dispatch-customer">${F.escapeHtml(order.orderNumber)} · ${F.escapeHtml(
          F.OUTLET_LABEL[order.outlet] || order.outlet
        )}</div>
              </div>
              <span class="ls-status" data-status="${onTheWay ? 'READY' : 'PENDING'}">${
          onTheWay ? 'On the way' : 'Awaiting rider'
        }</span>
            </div>
            <div class="dispatch-facts">
              <div><span>Customer</span><strong>${F.escapeHtml(order.customerName || 'Phone customer')}</strong></div>
              <div><span>Phone</span><strong>${F.escapeHtml(order.customerPhone || '—')}</strong></div>
              <div><span>Destination</span><strong>${F.escapeHtml(order.destinationZone || 'Not set')}</strong></div>
              <div><span>Order total</span><strong>${F.formatUGX(order.totalUgx)}</strong></div>
              <div><span>Payment</span><strong>${order.cashOnDelivery ? 'Cash due at delivery' : 'Paid'}</strong></div>
              <div><span>Elapsed</span><strong>${order.elapsedMinutes}m</strong></div>
              <div><span>Landmark</span><strong>${F.escapeHtml(order.landmarkHint || '—')}</strong></div>
              ${
                onTheWay
                  ? `<div><span>Rider</span><strong>${F.escapeHtml(handoff.riderName || '—')}</strong></div>
                     <div><span>Rider phone</span><strong>${F.escapeHtml(handoff.riderPhone || '—')}</strong></div>
                     <div><span>Advance cash</span><strong>${F.formatUGX(handoff.riderAdvanceUgx || 0)}</strong></div>
                     <div><span>Dispatched</span><strong>${F.relativeTime(handoff.dispatchedAt)}</strong></div>`
                  : ''
              }
            </div>
            ${order.roomNote ? `<div class="dispatch-items">Note: ${F.escapeHtml(order.roomNote)}</div>` : ''}
            <div class="dispatch-items">${items || 'No line items returned.'}</div>
            <div class="dispatch-actions">
              ${
                onTheWay
                  ? `<button class="ls-btn ls-btn--success ls-btn--small" type="button" data-action="complete" data-order-id="${F.escapeHtml(
                      order.id
                    )}" data-cash-on-delivery="${order.cashOnDelivery ? 'true' : 'false'}" data-total-ugx="${F.escapeHtml(order.totalUgx)}">Complete delivery</button>`
                  : `<button class="ls-btn ls-btn--small" type="button" data-action="assign" data-order-id="${F.escapeHtml(
                      order.id
                    )}" data-token="${F.escapeHtml(order.tokenNumber || '')}">Assign boda rider</button>`
              }
              ${order.callLink ? `<a class="ls-btn ls-btn--ghost ls-btn--small" href="${F.escapeHtml(order.callLink)}">Call customer</a>` : ''}
              ${order.mapLink ? `<a class="ls-btn ls-btn--ghost ls-btn--small" href="${F.escapeHtml(order.mapLink)}" target="_blank" rel="noopener">Open map</a>` : ''}
            </div>
          </article>`;
      })
      .join('');
  }

  function renderReview() {
    els.reviewSub.textContent = `${STATE.review.length} unreviewed failed handoff(s)`;
    if (!STATE.review.length) {
      els.review.innerHTML =
        '<div class="ls-empty">No failed handoffs waiting for review.</div>';
      return;
    }

    els.review.innerHTML = STATE.review
      .map(
        (row) => `
        <article class="dispatch-review-item">
          <div class="dispatch-card-head">
            <div>
              <div class="dispatch-token">${F.escapeHtml(row.tokenNumber || '—')}</div>
              <div class="dispatch-customer">${F.escapeHtml(row.orderNumber)} · ${F.escapeHtml(
          row.customerName || 'Customer'
        )}</div>
            </div>
            <span class="ls-status" data-status="REFUND_PENDING">${F.escapeHtml(
              String(row.outcome || '').replace(/_/g, ' ')
            )}</span>
          </div>
          <div class="dispatch-facts">
            <div><span>Rider</span><strong>${F.escapeHtml(row.riderName || '—')}</strong></div>
            <div><span>Rider phone</span><strong>${F.escapeHtml(row.riderPhone || '—')}</strong></div>
            <div><span>Destination</span><strong>${F.escapeHtml(row.destinationZone || '—')}</strong></div>
            <div><span>Dispatched by</span><strong>${F.escapeHtml(row.dispatchedBy || '—')}</strong></div>
          </div>
          <div class="dispatch-items">${F.escapeHtml(row.notes || 'No handoff notes recorded.')}</div>
          <p class="ls-help" style="margin-top:8px">This exception stays visible to the manager digest until reviewed outside this phase.</p>
        </article>`
      )
      .join('');
  }

  async function loadQueues() {
    const [active, review] = await Promise.all([
      F.request('/api/v1/dispatch/queue?state=active'),
      F.request('/api/v1/dispatch/queue?state=review')
    ]);
    STATE.active = active.queue || [];
    STATE.review = review.queue || [];
    renderSummary();
    renderActive();
    renderReview();
    if (els.updated) {
      els.updated.textContent = `Updated ${F.formatTime(new Date().toISOString())} · auto 60s`;
    }
  }

  function scheduleRefresh() {
    if (STATE.refreshTimer) window.clearTimeout(STATE.refreshTimer);
    STATE.refreshTimer = window.setTimeout(async () => {
      STATE.refreshTimer = null;
      try {
        await loadQueues();
      } catch (error) {
        F.toast(error.message || 'Dispatch refresh failed.', 'error');
      }
    }, 220);
  }

  function openAssign(orderId, token) {
    els.orderId.value = orderId;
    els.assignSub.textContent = `Order ${token || orderId} · rider handoff`;
    els.riderName.value = '';
    els.riderPhone.value = '';
    els.plate.value = '';
    els.stage.value = '';
    els.method.value = 'CALL';
    els.advance.value = '0';
    els.assignModal.hidden = false;
    els.riderName.focus();
  }

  function closeAssign() {
    els.assignModal.hidden = true;
  }

  async function submitAssign() {
    if (STATE.busy) return;
    const orderId = els.orderId.value;
    const payload = {
      riderName: els.riderName.value.trim(),
      riderPhone: els.riderPhone.value.trim(),
      bodaPlateNumber: els.plate.value.trim() || undefined,
      bodaStage: els.stage.value.trim() || undefined,
      advanceCashUgx: Math.max(0, Math.round(Number(els.advance.value) || 0)),
      dispatchMethod: els.method.value
    };

    if (payload.riderName.length < 2) {
      F.toast('Enter the rider name.', 'error');
      return;
    }
    if (payload.riderPhone.length < 9) {
      F.toast('Enter a valid rider phone number.', 'error');
      return;
    }

    STATE.busy = true;
    els.assignSubmit.disabled = true;
    els.assignSubmit.textContent = 'Assigning…';
    try {
      const data = await F.request(`/api/v1/orders/${orderId}/dispatch`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      F.toast(data.message || 'Rider assigned.', 'success');
      closeAssign();
      await loadQueues();
    } catch (error) {
      F.toast(error.message || 'Rider assignment failed.', 'error');
    } finally {
      STATE.busy = false;
      els.assignSubmit.disabled = false;
      els.assignSubmit.textContent = 'Assign rider';
    }
  }

  function openComplete(orderId, token, cashOnDelivery, totalUgx) {
    STATE.cashOnDelivery = Boolean(cashOnDelivery);
    els.completeOrderId.value = orderId;
    els.completeSub.textContent = `Order ${token || orderId} · record the real handoff outcome`;
    els.outcome.value = 'DELIVERED';
    els.advanceReturned.value = '';
    els.cashTendered.value = cashOnDelivery ? String(Math.round(Number(totalUgx))) : '';
    updateCashCollectionField();
    els.completeNote.textContent = cashOnDelivery
      ? 'Collect the full order total from the customer. Record the cash before completing the handoff; failed deliveries stay in the review queue.'
      : 'A non-delivered outcome stays in the review queue and is counted in the daily digest. It does not silently complete the order.';
    els.completeModal.hidden = false;
    els.outcome.focus();
  }

  function updateCashCollectionField() {
    const collectCash = STATE.cashOnDelivery && els.outcome.value === 'DELIVERED';
    els.cashTenderedWrap.hidden = !collectCash;
    els.cashTendered.required = collectCash;
  }

  function closeComplete() {
    els.completeModal.hidden = true;
    STATE.cashOnDelivery = false;
  }

  async function submitComplete() {
    if (STATE.busy) return;
    const orderId = els.completeOrderId.value;
    const returnedRaw = els.advanceReturned.value.trim();
    const payload = { outcome: els.outcome.value };
    if (!els.cashTenderedWrap.hidden && payload.outcome === 'DELIVERED') {
      payload.cashTenderedUgx = Math.round(Number(els.cashTendered.value));
      if (!payload.cashTenderedUgx) {
        F.toast('Enter the cash collected from the customer.', 'error');
        return;
      }
    }
    if (returnedRaw !== '') {
      payload.riderAdvanceReturnedUgx = Math.max(0, Math.round(Number(returnedRaw) || 0));
    }

    STATE.busy = true;
    els.completeSubmit.disabled = true;
    els.completeSubmit.textContent = 'Recording…';
    try {
      const data = await F.request(`/api/v1/orders/${orderId}/delivery-complete`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const cashSummary = data.cashCollectedUgx
        ? ` Cash payment recorded: ${F.formatUGX(data.cashCollectedUgx)}. Change due: ${F.formatUGX(data.changeUgx)}.`
        : '';
      F.toast(`${data.message || 'Delivery outcome recorded.'}${cashSummary}`, 'success');
      closeComplete();
      await loadQueues();
    } catch (error) {
      F.toast(error.message || 'Delivery outcome failed.', 'error');
    } finally {
      STATE.busy = false;
      els.completeSubmit.disabled = false;
      els.completeSubmit.textContent = 'Record outcome';
    }
  }

  function startEvents() {
    if (STATE.events) STATE.events.close();
    STATE.events = F.connectEvents({
      outlet: STATE.user.outlet || undefined,
      onStatus: setLiveState,
      onEvent(message) {
        if (
          ['DELIVERY_UPDATED', 'ORDER_SETTLED', 'TOKEN_READY', 'TICKET_UPDATED', 'ORDER_CANCELLED'].includes(
            message.event
          )
        ) {
          scheduleRefresh();
        }
      }
    });
  }

  function wireEvents() {
    els.refresh.addEventListener('click', async () => {
      try {
        await loadQueues();
        F.toast('Dispatch queues refreshed.', 'success');
      } catch (error) {
        F.toast(error.message || 'Refresh failed.', 'error');
      }
    });

    els.active.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action][data-order-id]');
      if (!button) return;
      if (button.dataset.action === 'assign') {
        openAssign(button.dataset.orderId, button.dataset.token);
      } else if (button.dataset.action === 'complete') {
        openComplete(
          button.dataset.orderId,
          button.dataset.token,
          button.dataset.cashOnDelivery === 'true',
          button.dataset.totalUgx
        );
      }
    });

    els.assignSubmit.addEventListener('click', submitAssign);
    els.outcome.addEventListener('change', updateCashCollectionField);
    els.assignForm.addEventListener('submit', (event) => {
      event.preventDefault();
      submitAssign();
    });
    els.assignClose.addEventListener('click', closeAssign);
    els.assignCancel.addEventListener('click', closeAssign);
    els.assignModal.addEventListener('click', (event) => {
      if (event.target === els.assignModal) closeAssign();
    });

    els.completeSubmit.addEventListener('click', submitComplete);
    els.completeForm.addEventListener('submit', (event) => {
      event.preventDefault();
      submitComplete();
    });
    els.completeClose.addEventListener('click', closeComplete);
    els.completeCancel.addEventListener('click', closeComplete);
    els.completeModal.addEventListener('click', (event) => {
      if (event.target === els.completeModal) closeComplete();
    });
  }

  async function init() {
    const user = await F.guard(['WAITER_FOH', 'MANAGER_ADMIN']);
    if (!user) return;
    STATE.user = user;
    F.fillSessionChrome(user);
    wireEvents();
    try {
      await loadQueues();
    } catch (error) {
      F.toast(error.message || 'Could not load the dispatch queue.', 'error');
    }
    startEvents();
    window.setInterval(() => {
      if (!STATE.refreshTimer && !STATE.busy) {
        loadQueues().catch(() => {});
      }
    }, 60000);
  }

  init().catch((error) => {
    F.toast(error.message || 'Dispatch failed to start.', 'error');
  });
})();
