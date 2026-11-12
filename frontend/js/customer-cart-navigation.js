(function () {
  'use strict';

  const OUTLETS = new Set(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']);
  const CART_STORAGE_PREFIX = 'foodizo-customer-cart-v1:';
  const LAST_OUTLET_STORAGE_KEY = 'foodizo-customer-last-outlet';
  const DEFAULT_OUTLET = 'FOODIZO_HAM_TOWERS';
  const links = Array.from(document.querySelectorAll('[data-customer-cart]'));
  let selectedOutletOverride = null;

  function selectedOutlet() {
    if (selectedOutletOverride && OUTLETS.has(selectedOutletOverride)) {
      return selectedOutletOverride;
    }

    const homeOutlet = document.getElementById('home-outlet');
    if (homeOutlet && OUTLETS.has(homeOutlet.value)) return homeOutlet.value;

    const requestedOutlet = new URLSearchParams(location.search).get('outlet');
    if (requestedOutlet && OUTLETS.has(requestedOutlet)) return requestedOutlet;

    const orderOutlet = document.getElementById('outlet');
    if (orderOutlet && OUTLETS.has(orderOutlet.value)) return orderOutlet.value;

    try {
      const savedOutlet = localStorage.getItem(LAST_OUTLET_STORAGE_KEY);
      if (savedOutlet && OUTLETS.has(savedOutlet)) return savedOutlet;
    } catch (error) {
      console.error('Could not read the selected restaurant outlet for the cart link.', error);
    }

    return DEFAULT_OUTLET;
  }

  function countForOutlet(outlet) {
    try {
      const serialized = localStorage.getItem(`${CART_STORAGE_PREFIX}${outlet}`);
      if (!serialized) return 0;
      const saved = JSON.parse(serialized);
      if (!Array.isArray(saved)) throw new Error('Saved cart data is not a list.');
      let skippedInvalidEntries = false;
      const count = saved.reduce((total, entry) => {
        if (!Array.isArray(entry) || entry.length !== 2 ||
            typeof entry[0] !== 'string' || !Number.isSafeInteger(entry[1]) || entry[1] < 1) {
          skippedInvalidEntries = true;
          return total;
        }
        return total + entry[1];
      }, 0);
      if (skippedInvalidEntries) console.error('Skipped invalid entries in the saved cart count.');
      return count;
    } catch (error) {
      console.error('Could not read the saved cart count.', error);
      return 0;
    }
  }

  function updateLinks() {
    const outlet = selectedOutlet();
    const count = countForOutlet(outlet);
    const destination = `/order?outlet=${encodeURIComponent(outlet)}#cart`;

    links.forEach((link) => {
      link.href = destination;
      const badge = link.querySelector('[data-customer-cart-count]');
      if (badge) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.hidden = count === 0;
      }
      link.setAttribute(
        'aria-label',
        `Open cart${count ? `, ${count} ${count === 1 ? 'item' : 'items'}` : ''}`
      );
    });
  }

  document.addEventListener('customer-cart-change', updateLinks);
  window.addEventListener('storage', updateLinks);
  const homeOutlet = document.getElementById('home-outlet');
  if (homeOutlet) homeOutlet.addEventListener('change', updateLinks);
  const orderOutlet = document.getElementById('outlet');
  if (orderOutlet) {
    orderOutlet.addEventListener('change', () => {
      selectedOutletOverride = orderOutlet.value;
      updateLinks();
    });
  }

  updateLinks();
})();
