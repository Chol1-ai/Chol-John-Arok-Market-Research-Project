(function () {
  'use strict';

  const outlet = document.getElementById('home-outlet');
  const zoneSelect = document.getElementById('home-zone');
  const status = document.getElementById('home-zone-status');
  const retry = document.getElementById('home-zone-retry');
  const submit = document.getElementById('home-delivery-submit');
  const form = document.getElementById('delivery-finder');
  const menuGroups = document.getElementById('home-menu-groups');
  const allMealsLink = document.getElementById('see-all-meals');
  const bestSellersCarousel = document.getElementById('best-sellers-carousel');
  const bestSellersGrid = document.getElementById('best-sellers-grid');
  const bestSellersIndicators = document.getElementById('best-sellers-indicators');
  const bestSellersPrevious = document.getElementById('best-sellers-previous');
  const bestSellersNext = document.getElementById('best-sellers-next');
  const bestSellersTitle = document.getElementById('best-sellers-title');
  const bestSellersDescription = document.getElementById('best-sellers-description');
  const favoritesStatus = document.getElementById('favorites-status');
  const favoriteNavCount = document.querySelector('[data-customer-favorites-count]');
  const APP_CONFIG = window.FoodizoAppConfig || { outlet: 'FOODIZO_HAM_TOWERS' };
  const OUTLETS = new Set([APP_CONFIG.outlet]);
  const defaultOutlet = APP_CONFIG.outlet;
  const favoritesStorageKey = 'foodizo-customer-favorites-v1';
  const featuredMealNames = [
    'Double Egg Rolex with Cabbage',
    'Single Egg Rolex',
    'Kikkomando (Chapati chopped with Beans)',
    'Katogo (Banana & Beef)',
    'Traditional Luwombo (Chicken)',
    'Traditional Luwombo (Goat)',
    'Traditional Beef Luwombo'
  ];
  const obunuziFeaturedMealNames = [
    'Matooke & Beef Stew',
    'Double Egg Rolex with Cabbage',
    'Traditional Beef Luwombo',
    'Katogo (Banana & Beef)',
    'Traditional Luwombo (Chicken)',
    'Single Egg Rolex',
    'Kikkomando (Chapati chopped with Beans)'
  ];
  const activeOutletValue = () => (outlet && outlet.value ? outlet.value : defaultOutlet);
  let requestNumber = 0;
  let menuRequestNumber = 0;
  let zones = [];
  const prefersReducedMotion = Boolean(
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  if (bestSellersGrid && APP_CONFIG.outlet === 'OBUNUZI_YMCA') {
    bestSellersGrid.setAttribute('role', 'region');
    bestSellersGrid.setAttribute('aria-label', 'Bestselling meals');
    bestSellersGrid.setAttribute('aria-roledescription', 'carousel');
    bestSellersGrid.setAttribute('tabindex', '0');
  }
  const categoryRevealObserver = !prefersReducedMotion && 'IntersectionObserver' in window
    ? new window.IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -24px 0px', threshold: 0.12 })
    : null;

  function updateBestSellersCarouselControls() {
    if (!bestSellersGrid || !bestSellersCarousel) return;
    const maxScroll = bestSellersGrid.scrollWidth - bestSellersGrid.clientWidth;
    const isCarousel = APP_CONFIG.outlet === 'OBUNUZI_YMCA' && maxScroll > 1;
    bestSellersCarousel.classList.toggle('best-sellers-carousel-ready', isCarousel);
    if (bestSellersPrevious) bestSellersPrevious.disabled = !isCarousel || bestSellersGrid.scrollLeft <= 1;
    if (bestSellersNext) bestSellersNext.disabled = !isCarousel || bestSellersGrid.scrollLeft >= maxScroll - 1;

    if (isCarousel && bestSellersIndicators) {
      const cards = [...bestSellersGrid.querySelectorAll('.best-seller-card')];
      let activeIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;
      cards.forEach((card, index) => {
        const distance = Math.abs(card.offsetLeft - bestSellersGrid.scrollLeft);
        if (distance < closestDistance) {
          closestDistance = distance;
          activeIndex = index;
        }
      });
      bestSellersIndicators.querySelectorAll('[data-bs-slide-to]').forEach((indicator, index) => {
        const active = index === activeIndex;
        indicator.classList.toggle('active', active);
        indicator.toggleAttribute('aria-current', active);
      });
    }
  }

  function refreshBestSellersCarouselControls() {
    window.requestAnimationFrame(updateBestSellersCarouselControls);
  }

  function renderBestSellersIndicators(count) {
    if (!bestSellersIndicators) return;
    bestSellersIndicators.innerHTML = Array.from({ length: count }, (_, index) => `
      <button type="button" data-bs-target="#best-sellers-carousel" data-bs-slide-to="${index}"
        class="${index === 0 ? 'active' : ''}" ${index === 0 ? 'aria-current="true"' : ''}
        aria-label="Slide ${index + 1}"></button>
    `).join('');
    bestSellersIndicators.querySelectorAll('[data-bs-slide-to]').forEach((indicator) => {
      indicator.addEventListener('click', () => {
        const card = bestSellersGrid?.querySelectorAll('.best-seller-card')[Number(indicator.dataset.bsSlideTo)];
        if (!card) return;
        bestSellersGrid.scrollTo({
          left: card.offsetLeft,
          behavior: prefersReducedMotion ? 'auto' : 'smooth'
        });
      });
    });
  }

  function scrollBestSellers(direction) {
    if (!bestSellersGrid) return;
    const firstCard = bestSellersGrid.querySelector('.best-seller-card');
    if (!firstCard) return;
    const styles = window.getComputedStyle(bestSellersGrid);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
    bestSellersGrid.scrollBy({
      left: direction * (firstCard.getBoundingClientRect().width + gap),
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
  }

  if (bestSellersPrevious) bestSellersPrevious.addEventListener('click', () => scrollBestSellers(-1));
  if (bestSellersNext) bestSellersNext.addEventListener('click', () => scrollBestSellers(1));
  if (bestSellersGrid) {
    bestSellersGrid.addEventListener('scroll', updateBestSellersCarouselControls, { passive: true });
    bestSellersGrid.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        scrollBestSellers(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        scrollBestSellers(1);
      }
    });
    window.addEventListener('resize', refreshBestSellersCarouselControls);
    if ('ResizeObserver' in window) {
      const bestSellersResizeObserver = new window.ResizeObserver(refreshBestSellersCarouselControls);
      bestSellersResizeObserver.observe(bestSellersGrid);
    }
  }

  if (outlet) {
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
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function formatUgx(value) {
    return `UGX ${Number(value || 0).toLocaleString('en-UG')}`;
  }

  function savedFavorites() {
    try {
      const stored = JSON.parse(localStorage.getItem(favoritesStorageKey) || '[]');
      return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : [];
    } catch (error) {
      console.error('Could not read saved meal favorites.', error);
      if (favoritesStatus) favoritesStatus.textContent = 'Could not load saved favorites from this browser.';
      return [];
    }
  }

  function updateFavoriteCount() {
    if (!favoriteNavCount) return;
    const count = savedFavorites().length;
    favoriteNavCount.textContent = count > 99 ? '99+' : String(count);
    favoriteNavCount.hidden = count === 0;
  }

  function fallbackMenuImage() {
    return activeOutletValue() === 'OBUNUZI_YMCA'
      ? '/images/obunuzi-meal-luwombo.jpg'
      : '/images/foodizo-landing-hero.jpg';
  }

  function menuItemImage(item) {
    const isObunuzi = APP_CONFIG.outlet === 'OBUNUZI_YMCA';
    const uploadedImage = typeof item.imageUrl === 'string' &&
      item.imageUrl.startsWith('/api/v1/menu-items/images/')
      ? item.imageUrl
      : null;
    if (uploadedImage) return uploadedImage;
    if (isObunuzi && typeof window.OBUNUZI_MENU_IMAGE_FOR_ITEM === 'function') {
      return window.OBUNUZI_MENU_IMAGE_FOR_ITEM(item);
    }
    if (item.hideOriginalImage) return null;
    const itemImages = isObunuzi
      ? window.OBUNUZI_MENU_ITEM_IMAGES || {}
      : window.FOODIZO_MENU_ITEM_IMAGES || {};
    if (Object.prototype.hasOwnProperty.call(itemImages, item.name)) return itemImages[item.name];
    const categories = isObunuzi
      ? window.OBUNUZI_MENU_CATEGORIES || []
      : window.FOODIZO_MENU_CATEGORIES || [];
    const category = categories.find((entry) => entry.name === item.category);
    return category ? category.image : fallbackMenuImage();
  }

  function renderBestSellers(items) {
    if (!bestSellersGrid) return;
    const favoritesView = new URLSearchParams(location.search).get('view') === 'favorites';
    const isObunuzi = APP_CONFIG.outlet === 'OBUNUZI_YMCA';
    const byName = new Map(items.map((item) => [item.name, item]));
    const featuredNames = isObunuzi ? obunuziFeaturedMealNames : featuredMealNames;
    const featuredItems = featuredNames.map((name) => byName.get(name)).filter(Boolean);
    const selectedItems = favoritesView
      ? items.filter((item) => savedFavorites().includes(item.id))
      : isObunuzi
        ? [
          ...featuredItems,
          ...items.filter((item) => !featuredItems.includes(item))
        ].slice(0, 4)
        : (featuredItems.length ? featuredItems : items).slice(0, 4);

    if (bestSellersTitle) {
      if (favoritesView) {
        bestSellersTitle.textContent = 'Your favorites';
      } else if (isObunuzi) {
        bestSellersTitle.textContent = 'Bestsellers';
      } else {
        bestSellersTitle.textContent = 'Best-selling meals';
      }
    }
    if (bestSellersDescription) {
      if (favoritesView) {
        bestSellersDescription.textContent = 'Meals you have saved in this browser.';
      } else if (isObunuzi) {
        bestSellersDescription.textContent = 'Beloved Kampala plates, prepared fresh at Obunuzi.';
      } else {
        bestSellersDescription.textContent = 'Campus favorites made fresh at your selected outlet.';
      }
    }

    if (!selectedItems.length) {
      bestSellersGrid.innerHTML = favoritesView
        ? '<p class="section-description">No favorites saved yet. Tap the heart on a meal to save it here.</p>'
        : '<p class="section-description">No featured meals are available at this outlet right now.</p>';
      if (bestSellersIndicators) bestSellersIndicators.innerHTML = '';
      refreshBestSellersCarouselControls();
      return;
    }

    const favorites = savedFavorites();
    bestSellersGrid.innerHTML = selectedItems.map((item, index) => {
      const selected = favorites.includes(item.id);
      const orderUrl = `/order?q=${encodeURIComponent(item.name)}&outlet=${encodeURIComponent(activeOutletValue())}`;
      const image = menuItemImage(item);
      return `
        <article class="best-seller-card" ${
          isObunuzi ? `role="group" aria-roledescription="slide" aria-label="${index + 1} of ${selectedItems.length}"` : ''
        }>
          ${
            image
              ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
              : '<span class="best-seller-image-placeholder" aria-hidden="true"><span class="material-symbols-outlined">restaurant</span></span>'
          }
          <button class="best-seller-favorite" type="button" data-favorite-id="${escapeHtml(item.id)}"
            aria-label="${selected ? 'Remove' : 'Save'} ${escapeHtml(item.name)} ${selected ? 'from' : 'to'} favorites"
            aria-pressed="${selected}">
            <span class="material-symbols-outlined" aria-hidden="true">favorite</span>
          </button>
          <div class="best-seller-content">
            <h3>${escapeHtml(item.name)}</h3>
            <p>${escapeHtml(item.description || item.category || 'Freshly prepared to order')}</p>
            <div class="best-seller-actions">
              <span class="best-seller-price">${formatUgx(item.priceUgx)}</span>
              <a class="button button-primary best-seller-order" href="${escapeHtml(orderUrl)}">Order meal</a>
            </div>
          </div>
        </article>
      `;
    }).join('');

    renderBestSellersIndicators(isObunuzi ? selectedItems.length : 0);
    refreshBestSellersCarouselControls();

    bestSellersGrid.querySelectorAll('[data-favorite-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.favoriteId;
        const currentFavorites = savedFavorites();
        const updatedFavorites = currentFavorites.includes(id)
          ? currentFavorites.filter((favoriteId) => favoriteId !== id)
          : [...currentFavorites, id];
        try {
          localStorage.setItem(favoritesStorageKey, JSON.stringify(updatedFavorites));
          if (favoritesStatus) favoritesStatus.textContent = 'Favorite list updated.';
          updateFavoriteCount();
          renderBestSellers(items);
        } catch (error) {
          console.error('Could not save meal favorites.', error);
          if (favoritesStatus) favoritesStatus.textContent = 'Could not save favorites in this browser.';
        }
      });
    });
  }

  function renderMenuGroups(items) {
    if (categoryRevealObserver && menuGroups) {
      menuGroups.querySelectorAll('.home-category-reveal').forEach((card) => {
        categoryRevealObserver.unobserve(card);
      });
    }

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

    const categories = APP_CONFIG.outlet === 'OBUNUZI_YMCA'
      ? window.OBUNUZI_MENU_CATEGORIES || []
      : window.FOODIZO_MENU_CATEGORIES || [];
    const categoryByName = new Map(categories.map((category) => [category.name, category]));
    const orderedNames = [
      ...categories.filter((category) => groups.has(category.name)).map((category) => category.name),
      ...Array.from(groups.keys()).filter((category) => !categoryByName.has(category))
    ];

    menuGroups.innerHTML = `
      <div class="cards home-category-grid">
        ${orderedNames.map((category) => {
          const categoryDetails = categoryByName.get(category);
          const params = new URLSearchParams({ outlet: activeOutletValue() });
          if (category !== 'Other') params.set('category', category);
          const categoryQuery = `${escapeHtml(params.toString())}`;
          return `
            <a class="card home-category-card" href="/order?${categoryQuery}">
              <div class="card-media">
                <img src="${escapeHtml(categoryDetails ? categoryDetails.image : fallbackMenuImage())}"
                  alt="" loading="lazy" />
              </div>
              <div class="card-content">
                <h3>${escapeHtml(category)}</h3>
                <p>${escapeHtml(categoryDetails ? categoryDetails.description : `Browse ${category} meals.`)}</p>
                <span class="card-link">View meals <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></span>
              </div>
            </a>
          `;
        }).join('')}
      </div>
    `;

    if (categoryRevealObserver) {
      menuGroups.querySelectorAll('.home-category-card').forEach((card, index) => {
        card.style.setProperty('--reveal-delay', `${Math.min(index * 70, 280)}ms`);
        categoryRevealObserver.observe(card);
        card.classList.add('home-category-reveal');
      });
    }
  }

  async function loadMenu() {
    const currentRequest = ++menuRequestNumber;
    if (!menuGroups) return;
    menuGroups.innerHTML = '<p class="section-description" role="status">Loading the current menu…</p>';
    try {
      const response = await fetch(
        `/api/v1/menu-items?outlet=${encodeURIComponent(activeOutletValue())}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Request failed (${response.status}).`);
      }
      if (!Array.isArray(data.items)) {
        throw new Error('The current menu response was invalid.');
      }
      if (currentRequest !== menuRequestNumber) return;
      const activeItems = data.items.filter((item) => item.isActive);
      renderMenuGroups(activeItems);
      renderBestSellers(activeItems);
      updateFavoriteCount();
    } catch (error) {
      if (currentRequest !== menuRequestNumber) return;
      menuGroups.innerHTML =
        `<p class="section-description" role="status">Could not load the current menu: ${escapeHtml(error.message)} <a href="/order?outlet=${encodeURIComponent(activeOutletValue())}">Open the full menu</a>.</p>`;
      if (bestSellersGrid) {
        bestSellersGrid.innerHTML = `<p class="section-description" role="status">Could not load featured meals: ${escapeHtml(error.message)}.</p>`;
      }
    }
  }

  function updateSelection() {
    if (!zoneSelect || !status || !submit) return;
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
    if (!allMealsLink) return;
    allMealsLink.href = `/order?outlet=${encodeURIComponent(activeOutletValue())}`;
  }

  async function loadZones() {
    if (!zoneSelect || !status || !submit || !retry) return;
    const currentRequest = ++requestNumber;
    zoneSelect.disabled = true;
    submit.disabled = true;
    submit.textContent = 'Loading delivery areas…';
    retry.hidden = true;
    status.textContent = 'Loading delivery areas…';
    zoneSelect.innerHTML = '<option value="">Loading areas…</option>';

    try {
      const response = await fetch(
        `/api/v1/orders/delivery-zones?outlet=${encodeURIComponent(activeOutletValue())}`
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

  if (outlet) {
    outlet.addEventListener('change', () => {
      updateAllMealsLink();
      loadZones();
      loadMenu();
    });
  }
  if (zoneSelect) zoneSelect.addEventListener('change', updateSelection);
  if (retry) retry.addEventListener('click', loadZones);
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
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!submit || !zoneSelect || submit.disabled || !zoneSelect.value) return;
      const params = new URLSearchParams({
        outlet: activeOutletValue(),
        fulfillment: 'PHONE_DELIVERY',
        deliveryZoneId: zoneSelect.value
      });
      window.location.assign(`/order?${params.toString()}`);
    });
  }

  updateAllMealsLink();
  if (outlet) {
    loadZones();
  }
  loadMenu();
})();
