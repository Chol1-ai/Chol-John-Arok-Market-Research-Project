(function () {
  'use strict';

  const elements = {
    title: document.getElementById('category-title'),
    description: document.getElementById('category-description'),
    status: document.getElementById('category-status'),
    items: document.getElementById('category-items'),
    order: document.getElementById('category-order')
  };
  const requestedCategory = new URLSearchParams(location.search).get('name');

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function itemImage(item, category) {
    if (item.image) return item.image;
    const name = item.name.toLowerCase();
    if (name.includes('water')) return '/images/rwenzori-bottle.png';
    if (name.includes('juice')) return '/images/foodizo-juice.jpg';
    if (name.includes('luwombo') || name.includes('fish')) return '/images/foodizo-luwombo.jpg';
    if (name.includes('katogo')) return '/images/foodizo-katogo.jpg';
    if (name.includes('matooke')) return '/images/foodizo-landing-hero.jpg';
    if (name.includes('beans')) return '/images/foodizo-rice-beans.jpg';
    if (name.includes('rolex')) return '/images/foodizo-rolex.jpg';
    if (name.includes('chips') || name.includes('fries')) return '/images/foodizo-plain-chips.jpg';
    if (name.includes('chicken')) return '/images/foodizo-chicken-chips.jpg';
    return category.image;
  }

  function renderCategory(category) {
    elements.items.innerHTML = category.items.map((item) => `
      <article class="category-meal">
        <div class="category-meal-photo">
          <img src="${escapeHtml(itemImage(item, category))}" alt="${escapeHtml(item.name)}" loading="lazy" />
        </div>
        <div class="category-meal-copy">
          <h2>${escapeHtml(item.name)}</h2>
          <p>${escapeHtml(item.note)}</p>
          <strong class="category-meal-price">${escapeHtml(item.price)}</strong>
        </div>
      </article>
    `).join('');
  }

  function loadCategory() {
    if (!requestedCategory) {
      elements.title.textContent = 'Choose a menu category';
      elements.description.textContent = 'Go back to the homepage to browse our main categories.';
      elements.status.textContent = '';
      elements.items.innerHTML = '<p class="category-empty">No category was selected. <a href="/">Browse menu categories</a>.</p>';
      return;
    }

    const category = window.FOODIZO_MENU_CATEGORIES.find((item) => item.title === requestedCategory);
    if (!category) {
      elements.title.textContent = 'Category not found';
      elements.description.textContent = 'Return to the homepage to choose one of our menu categories.';
      elements.status.textContent = '';
      elements.items.innerHTML = '<p class="category-empty"><a href="/">Browse menu categories</a>.</p>';
      return;
    }

    elements.title.textContent = category.title;
    elements.description.textContent = category.description;
    elements.order.href = `/order?${new URLSearchParams({ category: category.title }).toString()}`;
    document.title = `${category.title} | Foodizo & Obunuzi`;
    elements.status.textContent = `${category.items.length} ${category.items.length === 1 ? 'meal' : 'meals'}`;
    renderCategory(category);
  }

  loadCategory();
})();
