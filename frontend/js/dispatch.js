(function () {
  'use strict';

  const F = window.Foodizo;
  const STATE = {
    user: null,
    outlet: null,
    zones: [],
    active: [],
    review: [],
    events: null,
    refreshTimer: null,
    pollTimer: null,
    map: null,
    mapLayer: null,
    mapViewKey: null,
    mapUnavailableNotified: false,
    mapTileLoaded: false,
    mapTileErrorTimer: null,
    search: '',
    selectedZone: 'all',
    queueView: 'active',
    refreshSeconds: 60,
    busy: false,
    cashOnDelivery: false
  };

  const els = {
    active: document.getElementById('dispatch-active'),
    review: document.getElementById('dispatch-review'),
    activeSub: document.getElementById('dispatch-active-sub'),
    reviewSub: document.getElementById('dispatch-review-sub'),
    total: document.getElementById('dispatch-total'),
    awaiting: document.getElementById('dispatch-awaiting'),
    transit: document.getElementById('dispatch-transit'),
    reviewCount: document.getElementById('dispatch-review-count'),
    value: document.getElementById('dispatch-value'),
    activeTab: document.getElementById('dispatch-active-tab'),
    reviewTab: document.getElementById('dispatch-review-tab'),
    activeCount: document.getElementById('dispatch-active-count'),
    reviewTabCount: document.getElementById('dispatch-review-tab-count'),
    search: document.getElementById('dispatch-search'),
    zoneFilter: document.getElementById('dispatch-zone-filter'),
    mapCanvas: document.getElementById('dispatch-map-canvas'),
    mapEmpty: document.getElementById('dispatch-map-empty'),
    mapSummary: document.getElementById('dispatch-map-summary'),
    mapCount: document.getElementById('dispatch-map-count'),
    notificationButton: document.getElementById('dispatch-notifications'),
    notificationCount: document.getElementById('dispatch-notification-count'),
    navOrders: document.getElementById('dispatch-nav-orders'),
    outletWrap: document.getElementById('dispatch-outlet-wrap'),
    outlet: document.getElementById('dispatch-outlet'),
    refresh: document.getElementById('dispatch-refresh'),
    live: document.getElementById('dispatch-live'),
    liveText: document.getElementById('dispatch-live-text'),
    sidebarLive: document.getElementById('dispatch-sidebar-live'),
    currentTime: document.getElementById('dispatch-current-time'),
    riders: document.getElementById('dispatch-riders'),
    ridersSub: document.getElementById('dispatch-riders-sub'),
    riderCount: document.getElementById('dispatch-rider-count'),
    activity: document.getElementById('dispatch-activity'),
    snapshotGps: document.getElementById('dispatch-snapshot-gps'),
    snapshotOldest: document.getElementById('dispatch-snapshot-oldest'),
    snapshotZones: document.getElementById('dispatch-snapshot-zones'),
    zones: document.getElementById('dispatch-zones'),
    zonesSub: document.getElementById('dispatch-zones-sub'),
    refreshRate: document.getElementById('dispatch-refresh-rate'),
    exportButtons: document.querySelectorAll('#dispatch-export, #dispatch-export-report, #dispatch-export-nav'),
    updated: document.getElementById('dispatch-updated'),
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
    trackingInviteModal: document.getElementById('dispatch-tracking-invite-modal'),
    trackingInviteSub: document.getElementById('dispatch-tracking-invite-sub'),
    riderTrackingLink: document.getElementById('dispatch-rider-tracking-link'),
    shareRiderLink: document.getElementById('dispatch-share-rider-link'),
    copyRiderLink: document.getElementById('dispatch-copy-rider-link'),
    customerTrackingInvite: document.getElementById('dispatch-customer-tracking-invite'),
    customerTrackingLink: document.getElementById('dispatch-customer-tracking-link'),
    copyCustomerLink: document.getElementById('dispatch-copy-customer-link'),
    trackingInviteClose: document.getElementById('dispatch-tracking-invite-close'),
    trackingInviteDone: document.getElementById('dispatch-tracking-invite-done'),
    cashTenderedWrap: document.getElementById('dispatch-cash-tendered-wrap'),
    cashTendered: document.getElementById('dispatch-cash-tendered'),
    completeNote: document.getElementById('dispatch-complete-note'),
    completeSubmit: document.getElementById('dispatch-complete-submit'),
    completeClose: document.getElementById('dispatch-complete-close'),
    completeCancel: document.getElementById('dispatch-complete-cancel')
  };

  function filteredRows(rows) {
    const term = STATE.search.trim().toLocaleLowerCase();
    const zone = STATE.zones.find((item) => item.id === STATE.selectedZone);
    return rows.filter((row) => {
      if (zone && String(row.destinationZone || '').toLocaleLowerCase() !== zone.name.toLocaleLowerCase()) {
        return false;
      }
      if (!term) return true;
      const searchable = [
        row.tokenNumber,
        row.orderNumber,
        row.customerName,
        row.customerPhone,
        row.destinationZone,
        row.landmarkHint,
        row.roomNote,
        row.riderName,
        row.handoff && row.handoff.riderName,
        row.handoff && row.handoff.riderPhone,
        row.notes,
        ...(row.items || []).map((item) => item.name)
      ].join(' ').toLocaleLowerCase();
      return searchable.includes(term);
    });
  }

  function hasGps(row) {
    if (
      row.gpsLatitude === null ||
      row.gpsLatitude === undefined ||
      String(row.gpsLatitude).trim() === '' ||
      row.gpsLongitude === null ||
      row.gpsLongitude === undefined ||
      String(row.gpsLongitude).trim() === ''
    ) return false;
    const latitude = Number(row.gpsLatitude);
    const longitude = Number(row.gpsLongitude);
    return Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180;
  }

  function hasRiderGps(row) {
    const tracking = row.handoff && row.handoff.tracking;
    if (!tracking || !['SHARING', 'PAUSED'].includes(tracking.status)) return false;
    const latitude = Number(tracking.latitude);
    const longitude = Number(tracking.longitude);
    return Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180;
  }

  function trackingStatusLabel(tracking) {
    if (!tracking) return 'GPS not started';
    return {
      INVITED: 'GPS invite sent',
      SHARING: 'GPS sharing',
      PAUSED: 'GPS paused',
      STOPPED: 'GPS stopped'
    }[tracking.status] || 'GPS unavailable';
  }

  function renderSummary() {
    const awaiting = STATE.active.filter((row) => row.handoffState === 'AWAITING_RIDER').length;
    const transit = STATE.active.filter((row) => row.handoffState === 'ON_THE_WAY').length;
    const value = STATE.active.reduce((sum, row) => sum + Number(row.totalUgx || 0), 0);
    const gpsCount = STATE.active.filter(hasGps).length;
    const oldest = STATE.active
      .filter((row) => row.handoffState === 'AWAITING_RIDER')
      .reduce((max, row) => Math.max(max, Number(row.elapsedMinutes) || 0), 0);

    els.total.textContent = String(STATE.active.length);
    els.awaiting.textContent = String(awaiting);
    els.transit.textContent = String(transit);
    els.reviewCount.textContent = String(STATE.review.length);
    els.value.textContent = F.formatUGX(value);
    els.activeCount.textContent = String(STATE.active.length);
    els.reviewTabCount.textContent = String(STATE.review.length);
    els.navOrders.textContent = String(STATE.active.length);
    els.notificationCount.textContent = STATE.review.length > 99 ? '99+' : String(STATE.review.length);
    els.notificationCount.hidden = STATE.review.length === 0;
    els.notificationButton.setAttribute(
      'aria-label',
      STATE.review.length
        ? `Show ${STATE.review.length} delivery review${STATE.review.length === 1 ? '' : 's'}`
        : 'No delivery reviews'
    );
    els.snapshotGps.textContent = String(gpsCount);
    els.snapshotOldest.textContent = awaiting ? `${oldest}m` : 'None';
    els.snapshotZones.textContent = String(STATE.zones.length);
  }

  function setQueueView(view) {
    STATE.queueView = view === 'review' ? 'review' : 'active';
    const showReview = STATE.queueView === 'review';
    els.active.hidden = showReview;
    els.review.hidden = !showReview;
    els.activeTab.classList.toggle('is-active', !showReview);
    els.reviewTab.classList.toggle('is-active', showReview);
    els.activeTab.setAttribute('aria-selected', String(!showReview));
    els.reviewTab.setAttribute('aria-selected', String(showReview));
  }

  function renderActive() {
    const rows = filteredRows(STATE.active);
    const zone = STATE.zones.find((item) => item.id === STATE.selectedZone);
    const scope = zone ? ` · ${zone.name}` : '';
    els.activeSub.textContent = `${rows.length} of ${STATE.active.length} active delivery order(s)${scope}`;
    if (!rows.length) {
      els.active.innerHTML = `<div class="dispatch-empty-state"><span class="material-symbols-outlined" aria-hidden="true">${
        STATE.search || zone ? 'search_off' : 'check_circle'
      }</span><strong>${
        STATE.search || zone ? 'No matching deliveries' : 'Queue is clear'
      }</strong><span>${
        STATE.search || zone
          ? 'Try another search or zone filter.'
          : 'No READY delivery orders are waiting for a rider.'
      }</span></div>`;
      return;
    }

    els.active.innerHTML = rows
      .map((order) => {
        const onTheWay = order.handoffState === 'ON_THE_WAY';
        const handoff = order.handoff || {};
        const items = (order.items || [])
          .map((item) => `${F.escapeHtml(item.quantity)}× ${F.escapeHtml(item.name)}`)
          .join(' · ');
        return `
          <article class="dispatch-order-card${onTheWay ? ' is-transit' : ''}" data-order-card-id="${F.escapeHtml(order.id)}">
            <div class="dispatch-order-line">
              <div class="dispatch-order-identity">
                <strong class="dispatch-token">${F.escapeHtml(order.tokenNumber || '—')}</strong>
                <span>${F.escapeHtml(order.orderNumber || '—')} · ${F.escapeHtml(F.OUTLET_LABEL[order.outlet] || order.outlet)}</span>
              </div>
              <span class="dispatch-status-pill ${onTheWay ? 'is-transit' : 'is-pending'}"><i></i>${onTheWay ? 'In transit' : 'Pending'}</span>
            </div>
            <div class="dispatch-order-customer">
              <span class="material-symbols-outlined" aria-hidden="true">person</span>
              <strong>${F.escapeHtml(order.customerName || 'Phone customer')}</strong>
              ${order.customerPhone ? `<a href="${F.escapeHtml(order.callLink || `tel:+${order.customerPhone}`)}">${F.escapeHtml(order.customerPhone)}</a>` : ''}
              <span class="dispatch-order-age">${Number(order.elapsedMinutes) || 0}m ago</span>
            </div>
            <div class="dispatch-order-meta">
              <span><i class="material-symbols-outlined" aria-hidden="true">location_on</i>${F.escapeHtml(order.destinationZone || 'Zone not set')}${order.landmarkHint ? ` · ${F.escapeHtml(order.landmarkHint)}` : ''}</span>
              <strong>${F.formatUGX(order.totalUgx)}</strong>
            </div>
            ${onTheWay ? `<div class="dispatch-rider-assignment"><span class="material-symbols-outlined" aria-hidden="true">two_wheeler</span><span><strong>${F.escapeHtml(handoff.riderName || 'Rider')}</strong><small>${F.escapeHtml(handoff.riderPhone || 'Contact unavailable')} · ${F.escapeHtml(trackingStatusLabel(handoff.tracking))}${handoff.tracking && handoff.tracking.updatedAt ? ` · ${F.relativeTime(handoff.tracking.updatedAt)}` : ''}</small></span><span class="dispatch-rider-assignment-time">${F.relativeTime(handoff.dispatchedAt)}</span></div>` : ''}
            ${order.roomNote ? `<p class="dispatch-order-note">${F.escapeHtml(order.roomNote)}</p>` : ''}
            <div class="dispatch-order-items">${items || 'No line items returned.'}</div>
            <div class="dispatch-order-actions">
              <span class="dispatch-payment-tag ${order.cashOnDelivery ? 'is-cash' : ''}">${order.cashOnDelivery ? 'Cash due at delivery' : 'Paid'}</span>
              ${
                onTheWay
                  ? `<button class="dispatch-action-button is-success" type="button" data-action="complete" data-order-id="${F.escapeHtml(order.id)}" data-token="${F.escapeHtml(order.tokenNumber || '')}" data-cash-on-delivery="${order.cashOnDelivery ? 'true' : 'false'}" data-total-ugx="${F.escapeHtml(order.totalUgx)}">Complete delivery</button>`
                  : `<button class="dispatch-action-button" type="button" data-action="assign" data-order-id="${F.escapeHtml(order.id)}" data-token="${F.escapeHtml(order.tokenNumber || '')}">Assign rider</button>`
              }
              ${order.callLink ? `<a class="dispatch-icon-link" href="${F.escapeHtml(order.callLink)}" aria-label="Call customer"><span class="material-symbols-outlined" aria-hidden="true">call</span></a>` : ''}
              ${order.mapLink ? `<a class="dispatch-icon-link" href="${F.escapeHtml(order.mapLink)}" target="_blank" rel="noopener" aria-label="Open destination in maps"><span class="material-symbols-outlined" aria-hidden="true">near_me</span></a>` : ''}
            </div>
          </article>`;
      })
      .join('');
  }

  function renderReview() {
    const rows = filteredRows(STATE.review);
    const zone = STATE.zones.find((item) => item.id === STATE.selectedZone);
    els.reviewSub.textContent = `${rows.length} of ${STATE.review.length} unreviewed delivery exception(s)${zone ? ` · ${zone.name}` : ''}`;
    if (!rows.length) {
      els.review.innerHTML = `<div class="dispatch-empty-state"><span class="material-symbols-outlined" aria-hidden="true">${
        STATE.search || zone ? 'search_off' : 'task_alt'
      }</span><strong>${
        STATE.search || zone ? 'No matching exceptions' : 'No reviews required'
      }</strong><span>${
        STATE.search || zone
          ? 'Try another search or zone filter.'
          : 'Failed and returned handoffs will appear here.'
      }</span></div>`;
      return;
    }

    const outcomeLabels = {
      FAILED_UNREACHABLE: 'Customer unreachable',
      REFUSED: 'Customer refused',
      RETURNED: 'Returned to outlet'
    };
    els.review.innerHTML = rows
      .map((row) => {
        const outcomeLabel =
          outcomeLabels[row.outcome] || String(row.outcome || 'Failed handoff').replace(/_/g, ' ');
        return `
        <article class="dispatch-review-card" data-order-card-id="${F.escapeHtml(row.orderId)}">
          <div class="dispatch-order-line">
            <div class="dispatch-order-identity"><strong class="dispatch-token">${F.escapeHtml(row.tokenNumber || '—')}</strong><span>${F.escapeHtml(row.orderNumber || '—')} · ${F.escapeHtml(row.customerName || 'Customer')}</span></div>
            <span class="dispatch-status-pill is-review"><i></i>${F.escapeHtml(outcomeLabel)}</span>
          </div>
          <div class="dispatch-review-facts">
            <span><small>Customer</small><strong>${F.escapeHtml(row.customerPhone || '—')}</strong></span>
            <span><small>Rider</small><strong>${F.escapeHtml(row.riderName || '—')}</strong></span>
            <span><small>Destination</small><strong>${F.escapeHtml(row.destinationZone || '—')}</strong></span>
            <span><small>Dispatched</small><strong>${F.relativeTime(row.dispatchedAt)}</strong></span>
          </div>
          <p class="dispatch-review-note">${F.escapeHtml(row.notes || 'No handoff notes recorded.')}</p>
          <div class="dispatch-order-actions">
            ${row.customerPhone ? `<a class="dispatch-action-button is-secondary" href="tel:+${F.escapeHtml(row.customerPhone)}">Call customer</a>` : ''}
            <button class="dispatch-action-button" type="button" data-action="retry" data-order-id="${F.escapeHtml(row.orderId)}" data-token="${F.escapeHtml(row.tokenNumber || '')}">Retry delivery</button>
          </div>
        </article>`;
      })
      .join('');
  }

  function initializeMap() {
    if (STATE.map) return STATE.map;
    if (!window.L) return null;

    const home = [0.3335, 32.5686];
    STATE.map = window.L.map(els.mapCanvas, {
      scrollWheelZoom: false,
      zoomControl: true
    }).setView(home, 14);
    STATE.mapLayer = window.L.layerGroup().addTo(STATE.map);
    const tiles = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });
    tiles.on('tileload', () => {
      STATE.mapTileLoaded = true;
      if (STATE.mapTileErrorTimer) {
        window.clearTimeout(STATE.mapTileErrorTimer);
        STATE.mapTileErrorTimer = null;
      }
    });
    tiles.on('tileerror', () => {
      if (STATE.mapTileLoaded || STATE.mapTileErrorTimer) return;
      STATE.mapTileErrorTimer = window.setTimeout(() => {
        STATE.mapTileErrorTimer = null;
        if (!STATE.mapTileLoaded) {
          F.toast('Map tiles could not be loaded. Check your internet connection.', 'error');
        }
      }, 3000);
    });
    tiles.addTo(STATE.map);
    window.requestAnimationFrame(() => STATE.map.invalidateSize());
    return STATE.map;
  }

  function focusOrderOnQueue(orderId) {
    setQueueView('active');
    const card = Array.from(els.active.querySelectorAll('[data-order-card-id]'))
      .find((item) => item.dataset.orderCardId === orderId);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderMap() {
    const rows = filteredRows(STATE.active);
    const points = rows.filter(hasGps);
    const riderPoints = rows.filter(hasRiderGps);
    els.mapCount.textContent =
      `${points.length} destination${points.length === 1 ? '' : 's'} · ${riderPoints.length} rider${riderPoints.length === 1 ? '' : 's'}`;
    const map = initializeMap();
    if (!map) {
      els.mapEmpty.hidden = false;
      els.mapEmpty.innerHTML = '<strong>Street map unavailable</strong><span>Check your internet connection and reload the dashboard.</span>';
      if (!STATE.mapUnavailableNotified) {
        STATE.mapUnavailableNotified = true;
        F.toast('The street map library could not be loaded.', 'error');
      }
      els.mapSummary.textContent = 'Map centered on Makerere, Kampala';
      return;
    }

    STATE.mapLayer.clearLayers();
    points.forEach((order) => {
      const inTransit = order.handoffState === 'ON_THE_WAY';
      const token = F.escapeHtml(order.tokenNumber || order.orderNumber || 'Delivery');
      const zone = F.escapeHtml(order.destinationZone || 'Destination not set');
      const riderState = inTransit ? 'Rider assigned' : 'Awaiting rider';
      const popup = `<div class="dispatch-map-popup"><strong>${token}</strong><span>${F.escapeHtml(order.customerName || 'Customer')} · ${zone}</span><span>${riderState}</span><button type="button" data-map-order-id="${F.escapeHtml(order.id)}">View in queue</button></div>`;
      window.L.circleMarker([Number(order.gpsLatitude), Number(order.gpsLongitude)], {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: inTransit ? '#3989ee' : '#dc8c26',
        fillOpacity: 1,
        bubblingMouseEvents: false
      })
        .bindPopup(popup, { maxWidth: 240 })
        .addTo(STATE.mapLayer);
    });

    riderPoints.forEach((order) => {
      const tracking = order.handoff.tracking;
      const token = F.escapeHtml(order.tokenNumber || order.orderNumber || 'Delivery');
      const riderName = F.escapeHtml(order.handoff.riderName || 'Rider');
      const trackingState = tracking.status === 'SHARING' ? 'Sharing live' : 'Sharing paused';
      const updatedAt = tracking.updatedAt ? F.relativeTime(tracking.updatedAt) : 'Time unavailable';
      const popup = `<div class="dispatch-map-popup"><strong>${riderName} · Rider</strong><span>${token} · ${F.escapeHtml(order.destinationZone || 'Delivery')}</span><span>${trackingState} · last update ${F.escapeHtml(updatedAt)}</span><button type="button" data-map-order-id="${F.escapeHtml(order.id)}">View in queue</button></div>`;
      const icon = window.L.divIcon({
        className: '',
        html: '<span class="dispatch-live-rider-marker" aria-hidden="true">R</span>',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      window.L.marker([Number(tracking.latitude), Number(tracking.longitude)], { icon })
        .bindPopup(popup, { maxWidth: 250 })
        .addTo(STATE.mapLayer);
    });

    const viewKey = JSON.stringify({
      destinations: points.map((order) => `${order.id}:${order.gpsLatitude}:${order.gpsLongitude}`).sort(),
      riders: riderPoints.map((order) => order.id).sort()
    });
    if (viewKey !== STATE.mapViewKey) {
      const allPoints = [
        ...points.map((order) => [Number(order.gpsLatitude), Number(order.gpsLongitude)]),
        ...riderPoints.map((order) => [
          Number(order.handoff.tracking.latitude),
          Number(order.handoff.tracking.longitude)
        ])
      ];
      if (allPoints.length === 0) {
        map.setView([0.3335, 32.5686], 14);
      } else if (allPoints.length === 1) {
        map.setView(allPoints[0], 15);
      } else {
        map.fitBounds(window.L.latLngBounds(allPoints), { padding: [36, 36], maxZoom: 15 });
      }
      STATE.mapViewKey = viewKey;
    }

    if (points.length || riderPoints.length) {
      els.mapEmpty.hidden = true;
    } else {
      els.mapEmpty.hidden = false;
      els.mapEmpty.innerHTML = `<strong>No GPS destinations in this view</strong><span>${
        rows.length
          ? `${rows.length} active delivery order(s) have no saved coordinates. The street map remains centered on Makerere.`
          : 'The street map is centered on Makerere, Kampala. Delivery pins appear when an order has saved GPS coordinates.'
      }</span>`;
    }
    const missingGps = rows.length - points.length;
    els.mapSummary.textContent =
      `${points.length} customer GPS pin${points.length === 1 ? '' : 's'} · ${riderPoints.length} rider location${riderPoints.length === 1 ? '' : 's'}${missingGps ? ` · ${missingGps} order(s) without destination GPS` : ''}`;
  }

  function renderRiders() {
    const grouped = new Map();
    STATE.active.filter((row) => row.handoffState === 'ON_THE_WAY' && row.handoff).forEach((row) => {
      const handoff = row.handoff;
      const key = String(handoff.riderPhone || handoff.riderName || row.id).toLocaleLowerCase();
      if (!grouped.has(key)) {
        grouped.set(key, {
          name: handoff.riderName || 'Rider',
          phone: handoff.riderPhone || '',
          orders: []
        });
      }
      grouped.get(key).orders.push(row);
    });
    const riders = Array.from(grouped.values());
    els.ridersSub.textContent = `${riders.length} rider${riders.length === 1 ? '' : 's'} with open handoffs`;
    els.riderCount.textContent = `${riders.length} active`;
    if (!riders.length) {
      els.riders.innerHTML = '<div class="dispatch-empty-inline">No riders currently have an open delivery handoff.</div>';
      return;
    }
    els.riders.innerHTML = riders.map((rider) => {
      const statuses = rider.orders.map((row) =>
        row.handoff.tracking && row.handoff.tracking.status
      );
      const trackingLabel = statuses.includes('SHARING')
        ? 'GPS sharing'
        : statuses.includes('PAUSED')
          ? 'GPS paused'
          : statuses.includes('INVITED')
            ? 'GPS invite sent'
            : statuses.includes('STOPPED')
              ? 'GPS stopped'
              : 'GPS not started';
      const latestUpdate = rider.orders
        .map((row) => row.handoff.tracking && row.handoff.tracking.updatedAt)
        .filter(Boolean)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
      return `
        <article class="dispatch-rider-card">
          <span class="dispatch-rider-avatar">${F.escapeHtml(F.initials(rider.name))}</span>
          <div class="dispatch-rider-copy"><strong>${F.escapeHtml(rider.name)}</strong><small>${rider.phone ? `<a href="tel:+${F.escapeHtml(rider.phone)}">${F.escapeHtml(rider.phone)}</a>` : 'Phone unavailable'}</small><span>${rider.orders.map((row) => F.escapeHtml(row.tokenNumber || row.orderNumber)).join(' · ')}</span></div>
          <span class="dispatch-rider-status"><i></i>${F.escapeHtml(trackingLabel)}${latestUpdate ? ` · ${F.relativeTime(latestUpdate)}` : ''}</span>
        </article>`;
    }).join('');
  }

  function renderZones() {
    const selected = els.zoneFilter.value;
    els.zoneFilter.innerHTML = '<option value="all">All zones</option>' + STATE.zones.map((zone) =>
      `<option value="${F.escapeHtml(zone.id)}">${F.escapeHtml(zone.name)}</option>`
    ).join('');
    els.zoneFilter.value = STATE.zones.some((zone) => zone.id === selected) ? selected : 'all';
    STATE.selectedZone = els.zoneFilter.value;
    els.zonesSub.textContent = `${STATE.zones.length} active delivery zone(s) · ${F.OUTLET_LABEL[STATE.outlet] || STATE.outlet}`;
    if (!STATE.zones.length) {
      els.zones.innerHTML = '<div class="dispatch-empty-inline">No active delivery zones are configured for this outlet.</div>';
      return;
    }
    els.zones.innerHTML = STATE.zones.map((zone) => `
      <article class="dispatch-zone-card">
        <span class="dispatch-zone-icon material-symbols-outlined" aria-hidden="true">location_on</span>
        <div><strong>${F.escapeHtml(zone.name)}</strong><small>${F.escapeHtml(zone.landmarkHint || zone.landmarkGroup || 'Delivery area')}</small></div>
        <span class="dispatch-zone-fee">${F.formatUGX(zone.feeUgx)}</span>
        <span class="dispatch-zone-eta">${F.escapeHtml(zone.etaMinMinutes)}–${F.escapeHtml(zone.etaMaxMinutes)} min</span>
      </article>`).join('');
  }

  function renderActivity() {
    const entries = [];
    STATE.active.forEach((order) => {
      const handoff = order.handoff || {};
      if (order.handoffState === 'ON_THE_WAY') {
        entries.push({
          kind: 'is-transit',
          icon: 'two_wheeler',
          title: `${handoff.riderName || 'Rider'} assigned to ${order.tokenNumber || order.orderNumber}`,
          detail: order.destinationZone || 'Destination not set',
          time: handoff.dispatchedAt ? F.relativeTime(handoff.dispatchedAt) : 'Open handoff',
          timestamp: handoff.dispatchedAt ? new Date(handoff.dispatchedAt).getTime() : 0
        });
      } else {
        entries.push({
          kind: 'is-pending',
          icon: 'hourglass_top',
          title: `${order.tokenNumber || order.orderNumber} awaiting rider`,
          detail: `${order.destinationZone || 'Zone not set'} · ${Number(order.elapsedMinutes) || 0}m in queue`,
          time: 'Pending',
          timestamp: 0
        });
      }
    });
    STATE.review.forEach((row) => {
      entries.push({
        kind: 'is-review',
        icon: 'report_problem',
        title: `${row.tokenNumber || row.orderNumber} · ${String(row.outcome || 'Review').replace(/_/g, ' ').toLowerCase()}`,
        detail: `${row.riderName || 'Rider'} · ${row.destinationZone || 'Destination not set'}`,
        time: F.relativeTime(row.dispatchedAt),
        timestamp: row.dispatchedAt ? new Date(row.dispatchedAt).getTime() : 0
      });
    });
    entries.sort((a, b) => b.timestamp - a.timestamp);
    if (!entries.length) {
      els.activity.innerHTML = '<div class="dispatch-empty-inline">Current dispatch activity will appear here as orders enter the queue.</div>';
      return;
    }
    els.activity.innerHTML = entries.slice(0, 7).map((entry) => `
      <div class="dispatch-activity-item">
        <span class="dispatch-activity-icon ${entry.kind}"><span class="material-symbols-outlined" aria-hidden="true">${entry.icon}</span></span>
        <span><strong>${F.escapeHtml(entry.title)}</strong><small>${F.escapeHtml(entry.detail)}</small></span>
        <time>${F.escapeHtml(entry.time)}</time>
      </div>`).join('');
  }

  function renderAll() {
    renderZones();
    renderSummary();
    renderActive();
    renderReview();
    renderMap();
    renderRiders();
    renderActivity();
    setQueueView(STATE.queueView);
  }

  async function loadQueues() {
    const outlet = STATE.outlet;
    const query = outlet ? `?outlet=${encodeURIComponent(outlet)}` : '';
    const [active, review] = await Promise.all([
      F.request(`/api/v1/dispatch/queue${query ? `${query}&` : '?'}state=active`),
      F.request(`/api/v1/dispatch/queue${query ? `${query}&` : '?'}state=review`)
    ]);
    if (outlet !== STATE.outlet) return;
    STATE.active = active.queue || [];
    STATE.review = review.queue || [];
    renderAll();
  }

  async function loadZones() {
    const outlet = STATE.outlet;
    const data = await F.request(`/api/v1/orders/delivery-zones?outlet=${encodeURIComponent(outlet)}`);
    if (outlet !== STATE.outlet) return;
    STATE.zones = data.zones || [];
    renderAll();
  }

  async function refreshAll() {
    const outlet = STATE.outlet;
    await Promise.all([loadQueues(), loadZones()]);
    if (outlet === STATE.outlet) {
      els.updated.textContent = `Updated ${F.formatTime(new Date().toISOString())}`;
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

  function openAssign(orderId, token, retry) {
    els.orderId.value = orderId;
    els.assignSub.textContent = retry
      ? `Order ${token || orderId} · assign a rider for the retry`
      : `Order ${token || orderId} · rider handoff`;
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

  function closeTrackingInvite() {
    els.trackingInviteModal.hidden = true;
  }

  function validTrackingInvite(path, type) {
    const pattern = type === 'rider'
      ? /^\/rider\/track#token=[A-Za-z0-9_-]{43}$/
      : /^\/tracker#delivery=[A-Za-z0-9_-]{43}$/;
    if (typeof path !== 'string' || !pattern.test(path)) return null;
    const url = new URL(path, location.origin);
    return url.origin === location.origin ? url.href : null;
  }

  function showTrackingInvite(invitation, riderName) {
    const riderUrl = validTrackingInvite(invitation && invitation.riderUrl, 'rider');
    if (!riderUrl) {
      F.toast('Rider assigned, but a tracking invite was not returned. Refresh the dispatch queue and contact support if it persists.', 'error');
      return;
    }

    els.riderTrackingLink.value = riderUrl;
    els.trackingInviteSub.textContent =
      `Send this private link to ${riderName || 'the rider'}. GPS starts only after they allow location and tap Start.`;
    const customerUrl = validTrackingInvite(invitation && invitation.customerUrl, 'customer');
    els.customerTrackingInvite.hidden = !customerUrl;
    els.customerTrackingLink.value = customerUrl || '';
    els.trackingInviteModal.hidden = false;
    els.shareRiderLink.focus();
  }

  async function copyTrackingLink(input) {
    const text = input.value;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        F.toast('Tracking link copied.', 'success');
        return;
      }
      window.prompt('Copy this private tracking link:', text);
    } catch (error) {
      F.toast(`Could not copy the tracking link: ${error.message}`, 'error');
    }
  }

  async function shareRiderTrackingLink() {
    const url = els.riderTrackingLink.value;
    if (!url) return;
    if (!navigator.share) {
      await copyTrackingLink(els.riderTrackingLink);
      return;
    }
    try {
      await navigator.share({
        title: 'Foodizo delivery GPS invite',
        text: 'Open this private link on your Android phone to share your location for the active delivery.',
        url
      });
    } catch (error) {
      if (error.name !== 'AbortError') {
        F.toast(`Could not open the share sheet: ${error.message}`, 'error');
      }
    }
  }

  async function submitAssign() {
    if (STATE.busy) return;
    if (!els.assignForm.reportValidity()) return;
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
      showTrackingInvite(data.trackingInvitation, payload.riderName);
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
    if (!els.completeForm.reportValidity()) return;
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
      outlet: STATE.outlet || undefined,
      onStatus: setLiveState,
      onEvent(message) {
        if (
          ['DELIVERY_UPDATED', 'DELIVERY_LOCATION_UPDATED', 'ORDER_SETTLED', 'TOKEN_READY', 'TICKET_UPDATED', 'ORDER_CANCELLED'].includes(
            message.event
          )
        ) {
          scheduleRefresh();
        }
      }
    });
  }

  function setLiveState(state) {
    const labels = {
      connecting: 'Connecting…',
      online: 'Live',
      offline: 'Reconnecting…'
    };
    const label = labels[state] || state;
    els.live.dataset.state = state;
    els.live.setAttribute('aria-label', label);
    els.live.title = label;
    els.liveText.textContent = label;
    els.sidebarLive.textContent = state === 'online' ? 'Online' : state === 'offline' ? 'Reconnecting' : 'Connecting';
  }

  function updateOutletLabel() {
    const label = F.OUTLET_LABEL[STATE.outlet] || STATE.outlet || 'Restaurant';
    document.querySelectorAll('[data-session-outlet]').forEach((element) => {
      element.textContent = label;
    });
  }

  function updateClock() {
    const now = new Date();
    els.currentTime.textContent = new Intl.DateTimeFormat('en-UG', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Africa/Kampala'
    }).format(now);
  }

  function configurePolling() {
    if (STATE.pollTimer) window.clearInterval(STATE.pollTimer);
    STATE.pollTimer = window.setInterval(() => {
      if (document.visibilityState === 'hidden' || STATE.busy || STATE.refreshTimer) return;
      refreshAll().catch((error) => {
        F.toast(error.message || 'Dispatch refresh failed.', 'error');
      });
    }, STATE.refreshSeconds * 1000);
  }

  function csvCell(value) {
    const text = String(value === null || value === undefined ? '' : value);
    const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  }

  function exportQueueSnapshot() {
    const headers = [
      'Queue',
      'Order token',
      'Order number',
      'Customer',
      'Customer phone',
      'Destination',
      'Rider',
      'Status',
      'Payment',
      'Order total UGX',
      'Elapsed minutes',
      'Notes'
    ];
    const rows = [
      ...STATE.active.map((order) => [
        'Active',
        order.tokenNumber,
        order.orderNumber,
        order.customerName,
        order.customerPhone,
        order.destinationZone,
        order.handoff && order.handoff.riderName,
        order.handoffState,
        order.cashOnDelivery ? 'Cash on delivery' : 'Paid',
        order.totalUgx,
        order.elapsedMinutes,
        order.roomNote
      ]),
      ...STATE.review.map((row) => [
        'Needs review',
        row.tokenNumber,
        row.orderNumber,
        row.customerName,
        row.customerPhone,
        row.destinationZone,
        row.riderName,
        row.outcome,
        '',
        '',
        '',
        row.notes
      ])
    ];
    const contents = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${contents}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const reportDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Kampala' }).format(new Date());
    link.download = `dispatch-snapshot-${reportDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    F.toast('Current dispatch snapshot exported.', 'success');
  }

  function wireEvents() {
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

    els.review.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action="retry"][data-order-id]');
      if (button) openAssign(button.dataset.orderId, button.dataset.token, true);
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
    els.shareRiderLink.addEventListener('click', shareRiderTrackingLink);
    els.copyRiderLink.addEventListener('click', () => copyTrackingLink(els.riderTrackingLink));
    els.copyCustomerLink.addEventListener('click', () => copyTrackingLink(els.customerTrackingLink));
    els.trackingInviteClose.addEventListener('click', closeTrackingInvite);
    els.trackingInviteDone.addEventListener('click', closeTrackingInvite);
    els.trackingInviteModal.addEventListener('click', (event) => {
      if (event.target === els.trackingInviteModal) closeTrackingInvite();
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

    els.refresh.addEventListener('click', async () => {
      els.refresh.disabled = true;
      try {
        await refreshAll();
        F.toast('Dispatch queue and delivery zones refreshed.', 'success');
      } catch (error) {
        F.toast(error.message || 'Dispatch refresh failed.', 'error');
      } finally {
        els.refresh.disabled = false;
      }
    });

    els.search.addEventListener('input', () => {
      STATE.search = els.search.value;
      renderAll();
    });
    els.zoneFilter.addEventListener('change', () => {
      STATE.selectedZone = els.zoneFilter.value;
      renderAll();
    });
    els.activeTab.addEventListener('click', () => setQueueView('active'));
    els.reviewTab.addEventListener('click', () => setQueueView('review'));
    els.notificationButton.addEventListener('click', () => {
      setQueueView(STATE.review.length ? 'review' : 'active');
      document.getElementById('dispatch-queue-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    els.mapCanvas.addEventListener('click', (event) => {
      const marker = event.target.closest('[data-map-order-id]');
      if (!marker) return;
      focusOrderOnQueue(marker.dataset.mapOrderId);
    });
    els.exportButtons.forEach((button) => button.addEventListener('click', exportQueueSnapshot));
    els.refreshRate.addEventListener('change', () => {
      STATE.refreshSeconds = Number(els.refreshRate.value) || 60;
      configurePolling();
      F.toast(`Auto-refresh set to every ${STATE.refreshSeconds} seconds.`, 'info');
    });
    els.outlet.addEventListener('change', async () => {
      STATE.outlet = els.outlet.value;
      STATE.selectedZone = 'all';
      STATE.active = [];
      STATE.review = [];
      STATE.zones = [];
      startEvents();
      renderAll();
      updateOutletLabel();
      els.zoneFilter.value = 'all';
      try {
        await refreshAll();
        F.toast(`Showing ${F.OUTLET_LABEL[STATE.outlet] || STATE.outlet} dispatch data.`, 'success');
      } catch (error) {
        F.toast(error.message || 'Could not change outlet.', 'error');
      }
    });
    document.querySelector('[data-dispatch-nav="active"]').addEventListener('click', () => {
      setQueueView('active');
    });
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        els.search.focus();
      }
      if (event.key === 'Escape') {
        closeAssign();
        closeComplete();
        closeTrackingInvite();
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
    updateOutletLabel();
    updateClock();
    window.setInterval(updateClock, 30000);
    STATE.refreshSeconds = Number(els.refreshRate.value) || 60;
    wireEvents();
    try {
      await refreshAll();
    } catch (error) {
      F.toast(error.message || 'Could not load dispatch data.', 'error');
    }
    startEvents();
    configurePolling();
  }

  init().catch((error) => {
    F.toast(error.message || 'Dispatch failed to start.', 'error');
  });
})();
