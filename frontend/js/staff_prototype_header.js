(function () {
  'use strict';

  const STORAGE_KEY = 'foodizo-prototype-selected-outlet';
  const OUTLETS = {
    fdz: { label: 'Foodizo · Ham Towers', buttonLabel: 'Foodizo (Ham Towers)' },
    obz: { label: 'Obunuzi · Opp. YMCA', buttonLabel: 'Obunuzi (Opp. YMCA)' }
  };
  const header = document.querySelector('body > header');
  if (!header) return;
  document.body.classList.add('staff-header-enhanced');
  const headerRow = header.querySelector(':scope > div');

  let selectedOutlet;
  try {
    selectedOutlet = localStorage.getItem(STORAGE_KEY);
  } catch (_error) {
    selectedOutlet = null;
  }
  if (!Object.hasOwn(OUTLETS, selectedOutlet)) selectedOutlet = 'fdz';

  function showMessage(message) {
    let node = header.querySelector('.staff-header-message');
    if (!node) {
      node = document.createElement('div');
      node.className = 'staff-header-message';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      header.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('is-visible');
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(() => node.classList.remove('is-visible'), 2200);
  }

  function makeOutletButton(key) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.outlet = key;
    button.textContent = OUTLETS[key].buttonLabel;
    button.setAttribute('aria-label', `Select ${OUTLETS[key].label}`);
    return button;
  }

  function getOutletButtons() {
    let buttons = [...header.querySelectorAll('button')].filter((button) =>
      /Foodizo\s*\(Ham Towers\)|Obunuzi\s*\(Opp\. YMCA\)/.test(button.textContent)
    );
    if (buttons.length >= 2) return buttons.slice(0, 2);

    const branchButton = [...header.querySelectorAll('button')].find((button) =>
      /Foodizo/.test(button.textContent) && /Ham Towers/.test(button.textContent)
    );
    if (!branchButton) return [];

    const group = document.createElement('div');
    group.className = 'staff-outlet-switch';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Select outlet');
    group.append(makeOutletButton('fdz'), makeOutletButton('obz'));
    branchButton.replaceWith(group);
    return [...group.querySelectorAll('button')];
  }

  const outletButtons = getOutletButtons();
  if (!outletButtons.length) return;

  const outletGroup = outletButtons[0].parentElement;
  outletGroup.classList.add('staff-outlet-switch');
  outletGroup.classList.remove('hidden');
  outletGroup.setAttribute('role', 'group');
  outletGroup.setAttribute('aria-label', 'Select outlet');

  let outletStatus = outletGroup.querySelector('.staff-outlet-status');
  if (!outletStatus) {
    outletStatus = document.createElement('span');
    outletStatus.className = 'staff-outlet-status';
    outletStatus.setAttribute('aria-live', 'polite');
    outletGroup.appendChild(outletStatus);
  }

  function renderOutlet() {
    const outlet = OUTLETS[selectedOutlet];
    document.body.dataset.selectedOutlet = selectedOutlet;
    outletStatus.textContent = `Selected: ${outlet.label}`;
    outletButtons.forEach((button) => {
      const key = button.dataset.outlet ||
        (/Obunuzi/.test(button.textContent) ? 'obz' : 'fdz');
      button.dataset.outlet = key;
      button.setAttribute('aria-pressed', String(key === selectedOutlet));
      button.classList.toggle('is-selected', key === selectedOutlet);
    });
  }

  outletButtons.forEach((button) => {
    button.dataset.outlet = /Obunuzi/.test(button.textContent) ? 'obz' : 'fdz';
    button.addEventListener('click', () => {
      selectedOutlet = button.dataset.outlet;
      try {
        localStorage.setItem(STORAGE_KEY, selectedOutlet);
      } catch (_error) {
        showMessage('Outlet selection changed for this page.');
      }
      renderOutlet();
      window.dispatchEvent(new CustomEvent('staff:outlet-change', {
        detail: { outlet: selectedOutlet }
      }));
      showMessage(`${OUTLETS[selectedOutlet].label} selected.`);
    });
  });
  renderOutlet();

  function layoutHeader() {
    if (!headerRow) return;
    const navigation = header.querySelector('nav[data-active-classes]');
    const compact = window.matchMedia('(max-width: 800px)').matches;
    if (compact) {
      headerRow.style.setProperty('display', 'grid', 'important');
      headerRow.style.gridTemplateColumns = 'minmax(0, 1fr) auto';
      headerRow.style.alignItems = 'center';
      const brandRow = headerRow.firstElementChild;
      if (brandRow) {
        brandRow.style.gridColumn = '1 / -1';
        brandRow.style.gridRow = '1';
        brandRow.style.minWidth = '0';
        brandRow.style.flexWrap = 'wrap';
      }
      if (navigation) {
        navigation.style.gridColumn = '1 / -1';
        navigation.style.gridRow = '3';
        navigation.style.width = '100%';
        navigation.style.maxWidth = '100%';
        navigation.style.minWidth = '0';
      }
      const actions = headerRow.lastElementChild;
      if (actions && actions !== navigation && actions !== brandRow) {
        actions.style.gridColumn = '2';
        actions.style.gridRow = '2';
        actions.style.justifySelf = 'end';
        actions.style.minWidth = '0';
      }
      const main = document.querySelector('body > main');
      if (main) {
        main.style.setProperty(
          'padding-top',
          `${Math.ceil(header.getBoundingClientRect().height + 16)}px`,
          'important'
        );
      }
      return;
    }

    headerRow.removeAttribute('style');
    [headerRow.firstElementChild, headerRow.lastElementChild, navigation].forEach((element) => {
      if (element) element.removeAttribute('style');
    });
    document.querySelector('body > main')?.style.removeProperty('padding-top');
  }

  layoutHeader();
  window.addEventListener('resize', layoutHeader, { passive: true });

  const brandName = [...header.querySelectorAll('span')].find((node) =>
    node.textContent.trim() === 'KLA RESTAURANT SUITE'
  );
  const brand = brandName?.closest('div');
  if (brand) {
    const logo = document.createElement('img');
    logo.src = '../images/foodizo-obunuzi-logo.svg';
    logo.alt = 'Foodizo and Obunuzi';
    logo.className = 'staff-header-logo';
    brand.replaceChildren(logo);
    brand.classList.add('staff-prototype-brand');
  }

  const navigation = header.querySelector('nav[data-active-classes]');
  const staffRoutes = {
    'waitress-pos': '/prototype/pos',
    'kitchen-kds': '/prototype/kds',
    'dispatch-queue': '/prototype/dispatch',
    'manager-admin-and-eod': '/prototype/admin'
  };
  if (navigation) {
    const currentPath = decodeURIComponent(window.location.pathname).toLowerCase();
    navigation.querySelectorAll('a[data-path]').forEach((link) => {
      const localHref = link.getAttribute('href') || '';
      if (staffRoutes[link.dataset.path] && window.location.protocol !== 'file:') {
        link.href = staffRoutes[link.dataset.path];
      }
      const href = decodeURIComponent(link.getAttribute('href') || localHref).toLowerCase();
      if (!href || href === '#') return;
      const active = currentPath.endsWith(href);
      if (active) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  window.addEventListener('staff:outlet-change', (event) => {
    const outlet = event.detail?.outlet;
    if (Object.hasOwn(OUTLETS, outlet) && outlet !== selectedOutlet) {
      selectedOutlet = outlet;
      renderOutlet();
    }
  });
})();
