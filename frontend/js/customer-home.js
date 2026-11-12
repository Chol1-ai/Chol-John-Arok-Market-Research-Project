(function () {
  'use strict';

  const outlet = document.getElementById('home-outlet');
  const zoneSelect = document.getElementById('home-zone');
  const status = document.getElementById('home-zone-status');
  const retry = document.getElementById('home-zone-retry');
  const submit = document.getElementById('home-delivery-submit');
  const menuGroups = document.getElementById('home-menu-groups');
  let requestNumber = 0;
  let zones = [];

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function formatUgx(value) {
    return `UGX ${Number(value || 0).toLocaleString('en-UG')}`;
  }

  function renderCategoryCards(categories) {
    menuGroups.innerHTML = `
      <div class="cards home-category-grid">
        ${categories.map((category) => {
          const params = new URLSearchParams({ name: category.title });
          return `
            <a class="card home-category-card" href="/category?${escapeHtml(params.toString())}">
              <div class="card-media">
                <img src="${escapeHtml(category.image)}" alt="${escapeHtml(category.imageAlt)}" loading="lazy" />
              </div>
              <div class="card-content">
                <h3>${escapeHtml(category.title)}</h3>
                <p>${escapeHtml(category.description)}</p>
                <span class="card-link">Explore ${escapeHtml(category.title)} <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></span>
              </div>
            </a>
          `;
        }).join('')}
      </div>
    `;
  }

  renderCategoryCards(window.FOODIZO_MENU_CATEGORIES);

  function updateSelection() {
    const zone = zones.find((item) => item.id === zoneSelect.value);
    submit.disabled = !zone;
    submit.textContent = zone ? 'Browse delivery menu' : 'Choose an area to continue';
    if (zone) {
      const landmark = zone.landmarkHint || zone.landmarkGroup || zone.name;
      status.textContent = `${landmark} · ${zone.etaMinMinutes}–${zone.etaMaxMinutes} min estimated.`;
    } else {
      status.textContent = 'Choose an area to see its fee and estimated delivery time.';
    }
  }

  async function loadZones() {
    const currentRequest = ++requestNumber;
    zoneSelect.disabled = true;
    submit.disabled = true;
    submit.textContent = 'Loading delivery areas…';
    retry.hidden = true;
    status.textContent = 'Loading delivery areas…';
    zoneSelect.innerHTML = '<option value="">Loading areas…</option>';

    try {
      const response = await fetch(
        `/api/v1/orders/delivery-zones?outlet=${encodeURIComponent(outlet.value)}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Request failed (${response.status}).`);
      }
      if (currentRequest !== requestNumber) return;

      zones = Array.isArray(data.zones) ? data.zones : [];
      zoneSelect.innerHTML = '<option value="">Choose your delivery area</option>';
      zones.forEach((zone) => {
        const option = document.createElement('option');
        option.value = zone.id;
        option.textContent = `${zone.name} · ${formatUgx(zone.feeUgx)}`;
        zoneSelect.appendChild(option);
      });

      if (!zones.length) {
        zoneSelect.disabled = true;
        status.textContent = 'No delivery areas are available at this outlet. Browse the menu for pickup.';
        submit.textContent = 'Choose an area to continue';
        return;
      }

      zoneSelect.disabled = false;
      status.textContent = 'Choose an area to see its fee and estimated delivery time.';
      updateSelection();
    } catch (error) {
      if (currentRequest !== requestNumber) return;
      zones = [];
      zoneSelect.innerHTML = '<option value="">Delivery areas unavailable</option>';
      zoneSelect.disabled = true;
      submit.disabled = true;
      submit.textContent = 'Choose an area to continue';
      status.textContent = `Could not load delivery areas: ${error.message}`;
      retry.hidden = false;
    }
  }

  outlet.addEventListener('change', loadZones);
  zoneSelect.addEventListener('change', updateSelection);
  retry.addEventListener('click', loadZones);
  document.querySelectorAll('[data-info-dialog]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const dialog = document.querySelector(link.getAttribute('href'));
      if (!dialog || typeof dialog.showModal !== 'function') return;
      event.preventDefault();
      dialog.showModal();
    });
  });
  document.querySelectorAll('[data-dialog-close]').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog').close());
  });
  document.getElementById('delivery-finder').addEventListener('submit', (event) => {
    event.preventDefault();
    if (submit.disabled || !zoneSelect.value) return;
    const params = new URLSearchParams({
      outlet: outlet.value,
      fulfillment: 'PHONE_DELIVERY',
      deliveryZoneId: zoneSelect.value
    });
    window.location.assign(`/order?${params.toString()}`);
  });

  loadZones();
})();
