(function () {
  const routes = {
    'customer_pwa_landing_page.html': '/prototype/customer',
    'campus_pre_order_menu.html': '/prototype/menu',
    'momo_checkout_delivery_zone_selector.html': '/prototype/checkout',
    'digital_token_queue_bypass_status.html': '/prototype/token',
    'boda_landmark_delivery_tracker.html': '/prototype/tracker'
  };
  const titles = {
    '/prototype/customer': 'Foodizo Customer Home',
    '/prototype/menu': 'Campus Express Menu | Foodizo & Obunuzi',
    '/prototype/checkout': 'MoMo Checkout | Foodizo',
    '/prototype/token': 'Takeaway Token Pass | Foodizo',
    '/prototype/tracker': 'Boda Delivery Tracker | Foodizo'
  };
  const filenamesByRoute = Object.fromEntries(
    Object.entries(routes).map(([filename, route]) => [route, filename])
  );
  const favoriteStorageKey = 'foodizo-prototype-favorites';
  let toastTimer;

  function routeHref(route, suffix = '') {
    if (window.location.protocol === 'file:') {
      const filename = filenamesByRoute[route];
      return filename ? `${filename}${suffix}` : `${window.location.pathname}${suffix}`;
    }
    return `${route}${suffix}`;
  }

  function navigateToRoute(route, suffix = '') {
    window.location.assign(routeHref(route, suffix));
  }

  function showToast(message) {
    let toast = document.querySelector('.prototype-support-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'prototype-support-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  function convertIcons(root) {
    const icons = root.querySelectorAll
      ? root.querySelectorAll('.material-symbols-outlined:not(.prototype-icon-fallback)')
      : [];
    icons.forEach((icon) => {
      const name = icon.textContent.trim();
      if (!['moped', 'sports_motorsports', 'two_wheeler'].includes(name)) return;
      const bikeImage = document.createElement('img');
      bikeImage.src = '../images/motorbike-illustration.svg';
      bikeImage.alt = '';
      bikeImage.setAttribute('aria-hidden', 'true');
      bikeImage.className = 'bike-icon-image';
      icon.replaceChildren(bikeImage);
      icon.classList.add('prototype-icon-fallback', 'bike-icon-fallback');
      icon.setAttribute('aria-hidden', 'true');
    });
  }

  function imageFallback(image) {
    if (image.dataset.fallbackApplied === 'true') return;
    image.dataset.fallbackApplied = 'true';
    const alt = `${image.alt || ''} ${image.dataset.alt || ''}`.toLowerCase();
    const computed = window.getComputedStyle(image);
    const isBrand = alt.includes('emblem') || alt.includes('logo');
    const isAvatar = alt.includes('profile') || alt.includes('rider') || image.classList.contains('rounded-full');
    const height = Math.max(image.clientHeight, parseFloat(computed.height) || 32);
    const width = isBrand ? Math.max(image.clientWidth, height) :
      isAvatar ? height : Math.max(image.clientWidth, height);
    const fallback = document.createElement('img');
    fallback.className = `${image.className} prototype-image-fallback`;
    fallback.dataset.imageKind = isBrand ? 'brand' : isAvatar ? 'avatar' : 'food';
    fallback.alt = image.alt || image.dataset.alt || '';
    fallback.setAttribute('aria-hidden', 'true');
    fallback.src = isBrand ? '../images/foodizo-obunuzi-logo.svg' :
      isAvatar ? (alt.includes('rider') ? '../images/motorbike-illustration.svg' : '../images/profile-placeholder.svg') :
        alt.includes('juice') ? '../images/foodizo-juice.jpg' :
          alt.includes('luwombo') || alt.includes('tilapia') || alt.includes('fish') ? '../images/foodizo-luwombo.jpg' :
            alt.includes('katogo') || alt.includes('chicken') || alt.includes('poultry') ? '../images/foodizo-katogo.jpg' :
              alt.includes('rolex') || alt.includes('egg') ? '../images/foodizo-rolex.jpg' :
                '../images/foodizo-landing-hero.jpg';
    fallback.style.width = `${width}px`;
    fallback.style.height = `${height}px`;
    image.replaceWith(fallback);
  }

  function replaceBrandMarks(root) {
    const images = root.querySelectorAll ? root.querySelectorAll('img[alt*="Foodizo Obunuzi Emblem"]') : [];
    images.forEach((image) => {
      image.src = '../images/foodizo-obunuzi-logo.svg';
      image.alt = 'Foodizo and Obunuzi logo';
    });
  }

  function replaceBrokenImages(root) {
    const images = root.querySelectorAll ? root.querySelectorAll('img') : [];
    images.forEach((image) => {
      image.addEventListener('error', () => imageFallback(image), { once: true });
      if (image.complete && image.naturalWidth === 0) imageFallback(image);
    });
  }

  function openDialog(title, description, actions) {
    const backdrop = document.createElement('div');
    backdrop.className = 'prototype-support-backdrop';
    const dialog = document.createElement('section');
    dialog.className = 'prototype-support-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'prototype-support-title');

    const heading = document.createElement('h2');
    heading.id = 'prototype-support-title';
    heading.textContent = title;
    const message = document.createElement('p');
    message.textContent = description;
    const actionRow = document.createElement('div');
    actionRow.className = 'prototype-support-actions';
    actions.forEach(({ label, onClick }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => {
        onClick();
        if (backdrop.isConnected) close();
      });
      actionRow.appendChild(button);
    });
    dialog.append(heading, message, actionRow);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    function close() {
      backdrop.remove();
      document.removeEventListener('keydown', onKeyDown);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') close();
    }

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close();
    });
    document.addEventListener('keydown', onKeyDown);
    dialog.querySelector('button').focus();
    return close;
  }

  function openProfileDialog() {
    const backdrop = document.createElement('div');
    backdrop.className = 'prototype-support-backdrop';
    const dialog = document.createElement('section');
    dialog.className = 'prototype-support-dialog prototype-profile-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'prototype-profile-title');

    const avatar = document.createElement('div');
    avatar.className = 'prototype-profile-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    const avatarImage = document.createElement('img');
    avatarImage.src = '../images/profile-placeholder.svg';
    avatarImage.alt = '';
    avatar.appendChild(avatarImage);
    const heading = document.createElement('h2');
    heading.id = 'prototype-profile-title';
    heading.textContent = localStorage.getItem('foodizo-prototype-customer-name') || 'Guest customer';
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Your Foodizo profile';

    const details = document.createElement('dl');
    details.className = 'prototype-profile-details';
    [
      ['Account', 'Guest account'],
      ['Preferred branch', localStorage.getItem('foodizo-prototype-branch') || 'Ham Towers'],
      ['Order history', 'No completed orders yet']
    ].forEach(([label, value]) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = label;
      const description = document.createElement('dd');
      description.textContent = value;
      row.append(term, description);
      details.appendChild(row);
    });

    const actions = document.createElement('div');
    actions.className = 'prototype-support-actions';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = 'Done';
    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.textContent = 'Browse menu';
    actions.append(closeButton, menuButton);
    dialog.append(avatar, heading, subtitle, details, actions);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    function close() {
      backdrop.remove();
      document.removeEventListener('keydown', onKeyDown);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') close();
    }

    closeButton.addEventListener('click', close);
    menuButton.addEventListener('click', () => navigateToRoute('/prototype/menu'));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close();
    });
    document.addEventListener('keydown', onKeyDown);
    closeButton.focus();
  }

  function savedFavorites() {
    const stored = localStorage.getItem(favoriteStorageKey);
    if (!stored) return [];
    const favorites = JSON.parse(stored);
    return Array.isArray(favorites) ? favorites : [];
  }

  function setFavorites(favorites) {
    localStorage.setItem(favoriteStorageKey, JSON.stringify(favorites));
  }

  function getBranchLabel() {
    const currentBranchLabel = document.getElementById('current-branch-label');
    if (currentBranchLabel) return currentBranchLabel;
    const branchButton = [...document.querySelectorAll('header button')].find((button) =>
      [...button.querySelectorAll('.material-symbols-outlined')].some((icon) => icon.textContent.trim() === 'storefront')
    );
    return [...(branchButton?.querySelectorAll('span') || [])].find((span) =>
      !span.classList.contains('material-symbols-outlined')
    );
  }

  function wireFavorites() {
    const cards = [...document.querySelectorAll('[data-category]')];
    if (!cards.length) return;

    cards.forEach((card) => {
      const addButton = card.querySelector('.add-to-cart-btn');
      if (!addButton || card.querySelector('.prototype-favorite-toggle')) return;
      const name = addButton.dataset.name;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'prototype-favorite-toggle';
      button.setAttribute('aria-label', `Save ${name} to favorites`);
      button.dataset.favoriteName = name;

      function syncFavorite() {
        const selected = savedFavorites().includes(name);
        button.innerHTML = `<img src="../images/${selected ? 'favorite-filled' : 'favorite-outline'}.svg" alt="" aria-hidden="true">`;
        button.setAttribute('aria-pressed', String(selected));
        button.setAttribute('aria-label', `${selected ? 'Remove' : 'Save'} ${name} ${selected ? 'from' : 'to'} favorites`);
      }

      button.addEventListener('click', () => {
        const favorites = savedFavorites();
        const updated = favorites.includes(name)
          ? favorites.filter((favorite) => favorite !== name)
          : [...favorites, name];
        setFavorites(updated);
        syncFavorite();
        showToast(updated.includes(name) ? `${name} saved to favorites.` : `${name} removed from favorites.`);
        if (new URLSearchParams(window.location.search).get('view') === 'favorites') {
          applyFavoritesView();
        }
      });
      addButton.before(button);
      syncFavorite();
    });

    applyFavoritesView();
  }

  function applyFavoritesView() {
    if (new URLSearchParams(window.location.search).get('view') !== 'favorites') return;
    const cards = [...document.querySelectorAll('[data-category]')];
    const favorites = savedFavorites();
    const categoryRail = document.querySelector('[data-filter="all"]')?.parentElement?.parentElement;
    if (categoryRail) categoryRail.hidden = true;

    let heading = document.getElementById('prototype-favorites-heading');
    if (!heading && cards.length) {
      heading = document.createElement('h1');
      heading.id = 'prototype-favorites-heading';
      heading.className = 'prototype-favorites-heading';
      heading.textContent = 'Your Favorites';
      cards[0].parentElement.before(heading);
    }
    cards.forEach((card) => {
      const name = card.querySelector('.add-to-cart-btn')?.dataset.name;
      card.hidden = !favorites.includes(name);
      card.style.display = card.hidden ? 'none' : '';
    });

    let emptyState = document.getElementById('prototype-favorites-empty');
    if (favorites.length === 0) {
      if (!emptyState) {
        emptyState = document.createElement('p');
        emptyState.id = 'prototype-favorites-empty';
        emptyState.className = 'prototype-favorites-empty';
        emptyState.textContent = 'No favorites saved yet. Tap the heart on a menu item to keep it here.';
        cards[0]?.parentElement.before(emptyState);
      }
      emptyState.hidden = false;
    } else if (emptyState) {
      emptyState.hidden = true;
    }
  }

  function wireBranchPicker() {
    const savedBranch = localStorage.getItem('foodizo-prototype-branch');
    const pageBranchLabel = getBranchLabel();
    if (savedBranch && pageBranchLabel) pageBranchLabel.textContent = savedBranch;

    const branchButton = [...document.querySelectorAll('header button')].find((button) =>
      [...button.querySelectorAll('.material-symbols-outlined')].some((icon) => icon.textContent.trim() === 'storefront')
    );
    if (!branchButton || branchButton.id === 'branch-switcher-btn') return;

    branchButton.addEventListener('click', () => {
      const close = openDialog(
        'Choose a branch',
        'This changes the displayed location. It does not place or update an order.',
        [
          { label: 'Ham Towers', onClick: () => selectBranch('Ham Towers') },
          { label: 'Obunuzi YMCA', onClick: () => selectBranch('Obunuzi YMCA') },
          { label: 'Close', onClick: () => close() }
        ]
      );

      function selectBranch(name) {
        localStorage.setItem('foodizo-prototype-branch', name);
        const label = [...branchButton.querySelectorAll('span')].find((span) =>
          !span.classList.contains('material-symbols-outlined')
        );
        if (label) label.textContent = name;
        close();
        showToast(`Location set to ${name}.`);
      }
    });
  }

  function wireBackButton() {
    const backButton = [...document.querySelectorAll('header button')].find((button) =>
      [...button.querySelectorAll('.material-symbols-outlined')].some((icon) => icon.textContent.trim() === 'arrow_back')
    );
    if (!backButton) return;
    backButton.onclick = null;
    backButton.addEventListener('click', () => navigateToRoute('/prototype/menu'));
  }

  function wireOutletSelector() {
    [
      ['btn-outlet-foodizo', 'Ham Towers'],
      ['btn-outlet-obunuzi', 'Obunuzi YMCA']
    ].forEach(([id, name]) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.addEventListener('click', () => {
        localStorage.setItem('foodizo-prototype-branch', name);
        const pageBranchLabel = getBranchLabel();
        if (pageBranchLabel) pageBranchLabel.textContent = name;
        showToast(`Location set to ${name}.`);
      });
    });
  }

  function wireProfile() {
    const triggers = new Set(document.querySelectorAll('[data-path="profile"], [data-profile-trigger], img[alt="Profile"]'));
    triggers.forEach((trigger) => {
      const target = trigger.matches('img') ? (trigger.closest('button') || trigger.parentElement) : trigger;
      if (!target) return;
      target.addEventListener('click', (event) => {
        if (target.matches('a')) event.preventDefault();
        openProfileDialog();
      });
      if (target.tagName !== 'BUTTON' && target.tagName !== 'A') {
        target.setAttribute('role', 'button');
        target.setAttribute('tabindex', '0');
        target.setAttribute('aria-label', 'Open customer profile');
        target.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            target.click();
          }
        });
      }
    });
  }

  function wirePrintReceipt() {
    const printButton = document.getElementById('save-chit-btn');
    if (printButton) {
      printButton.addEventListener('click', () => {
        window.print();
      });
    }
  }

  function canonicalizePrototypeLinks() {
    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      const [, path, suffix = ''] = href.match(/^([^?#]*)([?#].*)?$/);
      const filename = path.split('/').pop();
      if (routes[filename]) link.href = routeHref(routes[filename], suffix);
      if (link.dataset.path === 'profile') link.href = '#profile';
    });
  }

  if (titles[window.location.pathname]) document.title = titles[window.location.pathname];
  canonicalizePrototypeLinks();
  replaceBrandMarks(document);
  replaceBrokenImages(document);
  wireBranchPicker();
  wireBackButton();
  wireOutletSelector();
  convertIcons(document);
  document.querySelectorAll('[data-path="favorites-history"]').forEach((link) => {
    link.href = routeHref('/prototype/menu', '?view=favorites');
  });
  wireFavorites();
  wireProfile();
  wirePrintReceipt();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        replaceBrandMarks(node);
        convertIcons(node);
        replaceBrokenImages(node);
      });
      if (mutation.target.nodeType === Node.ELEMENT_NODE) convertIcons(mutation.target);
    });
    wireFavorites();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
