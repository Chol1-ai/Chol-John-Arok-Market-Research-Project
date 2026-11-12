(function () {
  'use strict';

  const outlet = document.getElementById('home-outlet');
  const zoneSelect = document.getElementById('home-zone');
  const status = document.getElementById('home-zone-status');
  const retry = document.getElementById('home-zone-retry');
  const submit = document.getElementById('home-delivery-submit');
  const menuGroups = document.getElementById('home-menu-groups');
  const allMealsLink = document.getElementById('see-all-meals');
  const OUTLETS = new Set(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']);
  let requestNumber = 0;
  let menuRequestNumber = 0;
  let zones = [];

  const requestedOutlet = new URLSearchParams(location.search).get('outlet');
  if (requestedOutlet && OUTLETS.has(requestedOutlet)) {
    outlet.value = requestedOutlet;
  } else {
    try {
      const savedOutlet = localStorage.getItem('foodizo-customer-last-outlet');
      if (savedOutlet && OUTLETS.has(savedOutlet)) outlet.value = savedOutlet;
    } catch (error) {
      console.error('Could not restore the selected restaurant outlet.', error);
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function formatUgx(value) {
    return `UGX ${Number(value || 0).toLocaleString('en-UG')}`;
  }

  function renderMenuGroups(items) {
    const groups = new Map();
    items.forEach((item) => {
      const category = typeof item.category === 'string' && item.category.trim()
        ? item.category
        : 'Other';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(item);
    });

    if (!groups.size) {
      menuGroups.innerHTML = '<p class="section-description" role="status">No active meals are listed for this outlet.</p>';
      return;
    }

    menuGroups.innerHTML = `
      <div class="cards home-category-grid">
        ${Array.from(groups.entries()).map(([category, categoryItems]) => {
          const params = new URLSearchParams({ outlet: outlet.value });
          if (category !== 'Other') params.set('category', category);
          return `
            <a class="card home-category-card" href="/order?${escapeHtml(params.toString())}">
              <div class="card-content">
                <h3>${escapeHtml(category)}</h3>
                <ul class="home-category-items">
                  ${categoryItems.map((item) => `
                    <li>
                      <span>
                        ${escapeHtml(item.name)}
                        ${item.isAvailable && !item.is86 ? '' : '<small>Temporarily unavailable</small>'}
                      </span>
                      <strong>${formatUgx(item.priceUgx)}</strong>
                    </li>
                  `).join('')}
                </ul>
                <span class="card-link">Browse ${escapeHtml(category)} <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></span>
              </div>
            </a>
          `;
        }).join('')}
      </div>
    `;
  }

  async function loadMenu() {
    const currentRequest = ++menuRequestNumber;
    menuGroups.innerHTML = '<p class="section-description" role="status">Loading the current menu…</p>';
    try {
      const response = await fetch(
        `/api/v1/menu-items?outlet=${encodeURIComponent(outlet.value)}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Request failed (${response.status}).`);
      }
      if (!Array.isArray(data.items)) {
        throw new Error('The current menu response was invalid.');
      }
      if (currentRequest !== menuRequestNumber) return;
      renderMenuGroups(data.items.filter((item) => item.isActive));
    } catch (error) {
      if (currentRequest !== menuRequestNumber) return;
      menuGroups.innerHTML =
        `<p class="section-description" role="status">Could not load the current menu: ${escapeHtml(error.message)} <a href="/order?outlet=${encodeURIComponent(outlet.value)}">Open the full menu</a>.</p>`;
    }
  }

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

  function updateAllMealsLink() {
    allMealsLink.href = `/order?outlet=${encodeURIComponent(outlet.value)}`;
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

  outlet.addEventListener('change', () => {
    updateAllMealsLink();
    loadZones();
    loadMenu();
  });
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

  updateAllMealsLink();
  loadZones();
  loadMenu();
})();
