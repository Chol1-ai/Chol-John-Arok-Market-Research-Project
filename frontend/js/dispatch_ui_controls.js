(function () {
  'use strict';

  const main = document.querySelector('main');
  if (!main) return;

  const headerEnhancer = document.createElement('script');
  headerEnhancer.src = '../js/staff_prototype_header.js';
  document.head.appendChild(headerEnhancer);

  const orderLabels = [...main.querySelectorAll('span')].filter((node) =>
    /^#(?:FDZ|OBZ)-\d+/i.test(node.textContent.trim())
  );
  const orderCards = [...new Set(orderLabels
    .map((label) => label.closest('div.bg-surface-container-lowest.rounded-xl'))
    .filter(Boolean))];
  orderCards.forEach((card) => {
    const label = orderLabels.find((candidate) =>
      candidate.closest('div.bg-surface-container-lowest.rounded-xl') === card
    );
    card.dataset.dispatchOutlet = label?.textContent.trim().toUpperCase().startsWith('#OBZ-')
      ? 'obz'
      : 'fdz';
  });
  const outletButtons = [...document.querySelectorAll('header button')].filter((button) =>
    /Foodizo \(Ham Towers\)|Obunuzi \(Opp\. YMCA\)/.test(button.textContent)
  );
  const zoneButtons = [...main.querySelectorAll('button')].filter((button) =>
    ['All campus areas', 'Lumumba / Mary Stuart', 'YMCA & Ham Suites', 'Mitchell / Complex']
      .includes(button.textContent.trim())
  );

  let selectedOutlet = 'fdz';
  try {
    selectedOutlet = localStorage.getItem('foodizo-prototype-selected-outlet') || 'fdz';
  } catch (_error) {
    // Keep the default outlet when browser storage is unavailable.
  }
  let selectedZone = 'all';
  let resultMessage;

  function notice(message) {
    if (typeof window.showToast === 'function') {
      window.showToast(message);
      return;
    }

    if (!resultMessage) {
      resultMessage = document.createElement('p');
      resultMessage.className = 'dispatch-filter-status';
      resultMessage.setAttribute('role', 'status');
      resultMessage.setAttribute('aria-live', 'polite');
      main.prepend(resultMessage);
    }
    resultMessage.textContent = message;
  }

  function updateButtonGroup(buttons, selected) {
    buttons.forEach((button) => {
      const active = button.dataset.filterValue === selected;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('bg-inverse-surface', active);
      button.classList.toggle('text-inverse-on-surface', active);
      button.classList.toggle('shadow-sm', active);
      button.classList.toggle('bg-surface-container-lowest', !active);
      button.classList.toggle('text-on-surface', !active);
    });
  }

  function applyFilters() {
    let visible = 0;

    orderCards.forEach((card) => {
      const content = card.innerText.toLowerCase();
      const outletMatches = selectedOutlet === 'all' ||
        card.dataset.dispatchOutlet === selectedOutlet;
      const zoneMatches = selectedZone === 'all' ||
        (selectedZone === 'lumumba' && /lumumba|mary stuart/.test(content)) ||
        (selectedZone === 'ymca' && /ymca|ham towers|ham suites/.test(content)) ||
        (selectedZone === 'mitchell' && /mitchell|complex/.test(content));
      const matches = outletMatches && zoneMatches;
      card.hidden = !matches;
      if (matches) visible += 1;
    });

    updateButtonGroup(outletButtons, selectedOutlet);
    updateButtonGroup(zoneButtons, selectedZone);
    if (resultMessage) {
      resultMessage.textContent = `Showing ${visible} of ${orderCards.length} dispatch orders.`;
    }
  }

  outletButtons.forEach((button) => {
    const outlet = button.textContent.includes('Foodizo') ? 'fdz' : 'obz';
    button.dataset.filterValue = outlet;
    button.setAttribute('aria-label', `Filter dispatch orders for ${button.textContent.trim()}`);
    button.addEventListener('click', () => {
      selectedOutlet = outlet;
      try {
        localStorage.setItem('foodizo-prototype-selected-outlet', outlet);
      } catch (_error) {
        // The outlet filter still works for the current page when storage is disabled.
      }
      applyFilters();
      window.dispatchEvent(new CustomEvent('staff:outlet-change', { detail: { outlet } }));
      notice(`Showing ${outlet === 'fdz' ? 'Foodizo' : 'Obunuzi'} dispatch orders.`);
    });
  });

  window.addEventListener('staff:outlet-change', (event) => {
    if (event.detail?.outlet !== 'fdz' && event.detail?.outlet !== 'obz') return;
    selectedOutlet = event.detail.outlet;
    applyFilters();
  });

  zoneButtons.forEach((button) => {
    const label = button.textContent.trim();
    const zone = label.startsWith('Lumumba') ? 'lumumba' :
      label.startsWith('YMCA') ? 'ymca' :
        label.startsWith('Mitchell') ? 'mitchell' : 'all';
    button.dataset.filterValue = zone;
    button.addEventListener('click', () => {
      selectedZone = zone;
      applyFilters();
      notice(zone === 'all' ? 'Showing all campus delivery zones.' : `Filtered to ${label}.`);
    });
  });

  applyFilters();
})();
