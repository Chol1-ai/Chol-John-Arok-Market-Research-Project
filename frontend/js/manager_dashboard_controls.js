(function () {
  'use strict';

  const headerEnhancer = document.createElement('script');
  headerEnhancer.src = '../js/staff_prototype_header.js';
  document.head.appendChild(headerEnhancer);

  function showMessage(message) {
    const toast = document.getElementById('actionToast');
    const text = document.getElementById('toastMsg');
    if (!toast || !text) return;
    text.textContent = message;
    toast.classList.remove('hidden');
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
  }

  window.showManagerInfo = showMessage;

  const outletButtons = [...document.querySelectorAll('header button')].filter((button) =>
    /Foodizo \(Ham Towers\)|Obunuzi \(Opp\. YMCA\)/.test(button.textContent)
  );
  outletButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.textContent.includes('Foodizo')) {
        showMessage('Foodizo Ham Towers report is selected. This dashboard contains data for that outlet only.');
      } else {
        showMessage('Obunuzi outlet data is not available in this report. The Ham Towers figures remain unchanged.');
      }
    });
  });

  window.recordDiscardEntry = function () {
    const item = document.getElementById('discardItemSelect');
    const quantity = document.getElementById('discardQty');
    const unit = document.getElementById('discardUnit');
    const staff = document.getElementById('responsibleStaff');
    const reason = document.querySelector('input[name="reason"]:checked');
    const list = document.getElementById('discard-log-list');
    const amount = Number(quantity?.value);

    if (!item || !quantity || !unit || !staff || !reason || !list || !Number.isFinite(amount) || amount <= 0) {
      showMessage('Choose an item, quantity, unit, reason, and staff member before adding the entry.');
      return;
    }

    const row = document.createElement('div');
    row.className = 'flex flex-wrap items-center justify-between gap-space-sm py-space-xs text-body-sm font-body-sm';
    const description = document.createElement('span');
    description.className = 'font-bold text-on-surface';
    description.textContent = `${amount} ${unit.value} ${item.selectedOptions[0].textContent}`;
    const details = document.createElement('span');
    details.className = 'text-on-surface-variant';
    details.textContent = `${reason.value} · ${staff.value} · value pending`;
    row.append(description, details);
    list.appendChild(row);
    document.getElementById('discardModal')?.classList.add('hidden');
    showMessage('Discard entry added to this page. Inventory, totals, and the nightly digest were not changed.');
  };
})();
