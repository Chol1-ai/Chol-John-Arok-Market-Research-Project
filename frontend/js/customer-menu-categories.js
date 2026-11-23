(function () {
  'use strict';

  window.FOODIZO_MENU_CATEGORIES = [
    {
      name: 'African & Local Cuisine',
      description: 'Enjoy authentic campus and traditional favourites, slow-cooked to perfection with rich local flavors.',
      image: '/images/foodizo-luwombo.jpg'
    },
    {
      name: 'American',
      description: 'Crispy fries, loaded platters, and golden fried chicken to satisfy your quick-service cravings.',
      image: '/images/american-wings-and-fries.jpg'
    },
    {
      name: 'Asian',
      description: 'Savory stir-fried noodles, fragrant rice bowls, and savory oriental bites delivered hot.',
      image: '/images/category-asian-photo.jpg'
    },
    {
      name: 'Bakery & Pastries',
      description: 'Freshly baked treats, sweet cakes, and flaky pastries straight from the oven every morning.',
      image: '/images/category-bakery-photo.jpg'
    },
    {
      name: 'Breakfast & Morning Combos',
      description: 'Kickstart your campus morning with filling omelettes, pancakes, and hot morning tea combos.',
      image: '/images/category-breakfast-photo.jpg'
    },
    {
      name: 'Burgers',
      description: 'Grilled beef patties, crispy chicken burgers, and stacked buns loaded with flavor.',
      image: '/images/category-burger-photo.jpg'
    },
    {
      name: 'Coffee & Hot Teas',
      description: 'Rich espressos, frothy lattes, and spiced African teas to keep you energized through lectures.',
      image: '/images/category-coffee-photo.jpg'
    },
    {
      name: 'Cold Drinks & Beverages',
      description: 'Ice-cold sodas, refreshing bottled waters, and energy drinks to beat the Kampala heat.',
      image: '/images/category-drinks-photo.jpg'
    },
    {
      name: 'Juices & Smoothies',
      description: '100% natural, freshly squeezed tropical fruit juices and creamy yogurt blends.',
      image: '/images/foodizo-juice.jpg'
    },
    {
      name: 'Kampala Street Food Favourites',
      description: 'The undisputed campus champions—hot Rolexes, Kikkomandos, and muchomo joints.',
      image: '/images/foodizo-rolex.jpg'
    },
    {
      name: 'Pizza & Wraps',
      description: 'Oven-baked pizzas with rich toppings and tightly rolled, flavor-packed wraps.',
      image: '/images/category-pizza-photo.jpg'
    },
    {
      name: 'Snacks & Quick Bites',
      description: 'Quick, bite-sized snacks like crunchy samosas, cassava fries, and sweet gonja.',
      image: '/images/category-snacks-photo.jpg'
    },
    {
      name: 'Sweets & Desserts',
      description: 'Sweet treats, cold ice cream, and decadent waffles to finish your meal on a high note.',
      image: '/images/category-dessert-photo.jpg'
    }
  ];

  window.FOODIZO_MENU_ITEM_IMAGES = {
    'Matooke & Beef Stew': '/images/foodizo-matooke.jpg',
    'Traditional Luwombo (Chicken)': '/images/african-luwombo.jpg',
    'Traditional Luwombo (Goat)': '/images/african-luwombo.jpg',
    'Katogo (Banana & Offals)': '/images/foodizo-katogo.jpg',
    'Katogo (Banana & Beef)': '/images/foodizo-katogo.jpg',
    'Posho & Beans': '/images/african-posho-beans.jpg',
    'Groundnut Sauce with Local Greens': '/images/african-groundnut-greens.jpg',
    'Regular French Fries': '/images/foodizo-plain-chips.jpg',
    'Loaded Chips with Cheese & Beef Bits': '/images/american-loaded-fries.jpg',
    'Crispy Fried Chicken (2 Pieces)': '/images/american-fried-chicken.jpg',
    'Hot Dog Classic': '/images/american-hot-dog.jpg',
    'Vegetable Stir-fried Noodles': '/images/asian-vegetable-noodles.jpg',
    'Chicken Fried Rice': '/images/asian-chicken-fried-rice.jpg',
    'Asian Spring Rolls (3 pcs)': '/images/asian-spring-rolls.jpg',
    'Fresh Butter Scone': '/images/bakery-scone.jpg',
    'Mandazi (Pack of 3)': '/images/bakery-mandazi.jpg',
    'Meat Pie': '/images/bakery-meat-pie.jpg',
    'Sausage Roll': '/images/bakery-meat-pie.jpg',
    'Chocolate Doughnut': '/images/bakery-chocolate-doughnut.jpg',
    'Spanish Omelette with Toast': '/images/breakfast-spanish-omelette.jpg',
    'Pancakes Stack (3 pcs)': '/images/breakfast-pancakes.jpg',
    'Full Campus Breakfast Combo': '/images/category-breakfast-photo.jpg',
    'Aromatic Porridge (Bushera/Corn)': '/images/breakfast-porridge.jpg',
    'Classic Beef Burger': '/images/category-burger-photo.jpg',
    'Crispy Chicken Burger': '/images/burger-crispy-chicken.jpg',
    'Double Stack Cheeseburger': '/images/burger-double-cheeseburger.jpg',
    'Veggie Burger': '/images/burger-veggie.jpg',
    'Spiced African Tea (Cinnamon & Ginger)': '/images/coffee-spiced-tea.jpg',
    Cappuccino: '/images/coffee-latte.jpg',
    'Café Latte': '/images/coffee-latte.jpg',
    'Hot Chocolate': '/images/coffee-hot-chocolate.jpg',
    'Soda - Coca-Cola (500ml)': '/images/category-drinks-photo.jpg',
    'Soda - Sprite (500ml)': '/images/category-drinks-photo.jpg',
    'Soda - Mirinda (500ml)': '/images/category-drinks-photo.jpg',
    'Bottled Mineral Water (500ml)': '/images/foodizo-bottled-water.jpg',
    'Energy Drink - Predator': '/images/drinks-energy.jpg',
    'Energy Drink - Azam': '/images/drinks-energy.jpg',
    'Iced Lemon Tea': '/images/drinks-iced-lemon-tea.jpg',
    'Fresh Passion Fruit Juice': '/images/foodizo-juice.jpg',
    'Fresh Mango Juice (Seasonal)': '/images/juice-mango.jpg',
    'Pineapple Ginger Blend': '/images/juice-pineapple-ginger.jpg',
    'Tropical Yogurt Smoothie': '/images/juice-tropical-smoothie.jpg',
    'Single Egg Rolex': '/images/foodizo-rolex.jpg',
    'Double Egg Rolex with Cabbage': '/images/street-double-rolex.jpg',
    'Kikkomando (Chapati chopped with Beans)': '/images/street-kikkomando.jpg',
    'Grilled Muchomo (Beef Skewer)': '/images/street-muchomo.jpg',
    'Grilled Muchomo (Pork Skewer)': '/images/street-muchomo.jpg',
    'Chicken Tikka Pizza (Medium)': '/images/pizza-chicken-tikka.jpg',
    'Margherita Pizza (Medium)': '/images/category-pizza-photo.jpg',
    'Beef Shawarma Wrap': '/images/pizza-beef-shawarma.jpg',
    'Crispy Chicken Wrap': '/images/pizza-crispy-chicken-wrap.jpg',
    'Beef Samosa (2 pcs)': '/images/snack-samosa.jpg',
    'Vegetable Samosa (2 pcs)': '/images/snack-samosa.jpg',
    'Cassava Fries with Chili': '/images/snack-cassava-fries.jpg',
    'Fried Plantain (Gonja)': '/images/snack-fried-plantain.jpg',
    'Chicken Nuggets (5 pcs)': '/images/snack-chicken-nuggets.jpg',
    'Ice Cream Cup (2 Scoops)': '/images/category-dessert-photo.jpg',
    'Belgian Waffle with Syrup': '/images/dessert-belgian-waffle.jpg',
    'Sweet Crêpe with Nutella': '/images/dessert-chocolate-crepe.jpg'
  };

  window.OBUNUZI_MENU_CATEGORIES = [
    { name: 'African & Local Cuisine', description: 'Slow-cooked local favourites, prepared with care at Obunuzi.', image: '/images/obunuzi-ai-category-african-local.jpg' },
    { name: 'American', description: 'Crisp, hearty plates with a little Obunuzi warmth.', image: '/images/obunuzi-ai-category-american.jpg' },
    { name: 'Asian', description: 'Wok-tossed noodles and bright, savoury flavours.', image: '/images/obunuzi-ai-category-asian.jpg' },
    { name: 'Bakery & Pastries', description: 'Golden pastries and warm treats for any time of day.', image: '/images/obunuzi-ai-category-bakery.jpg' },
    { name: 'Breakfast & Morning Combos', description: 'A generous start, from eggs and toast to porridge.', image: '/images/obunuzi-ai-category-breakfast.jpg' },
    { name: 'Burgers', description: 'Grilled, stacked and made fresh to order.', image: '/images/obunuzi-ai-category-burgers.jpg' },
    { name: 'Coffee & Hot Teas', description: 'A comforting cup, steeped with local spice.', image: '/images/obunuzi-ai-category-coffee.jpg' },
    { name: 'Cold Drinks & Beverages', description: 'Cold refreshment for Kampala afternoons.', image: '/images/obunuzi-ai-category-drinks.jpg' },
    { name: 'Juices & Smoothies', description: 'Bright fruit blends made for a sunny day.', image: '/images/obunuzi-ai-category-juices.jpg' },
    { name: 'Kampala Street Food Favourites', description: 'Muchomo, Rolex and other street-side classics.', image: '/images/obunuzi-ai-category-street-food.jpg' },
    { name: 'Pizza & Wraps', description: 'Toasty slices and wraps filled to the edge.', image: '/images/obunuzi-ai-item-beef-shawarma-wrap.jpg' },
    { name: 'Snacks & Quick Bites', description: 'Crisp, golden bites for a quick pause.', image: '/images/obunuzi-ai-item-beef-samosa.jpg' },
    { name: 'Sweets & Desserts', description: 'A little something sweet to finish.', image: '/images/obunuzi-ai-item-belgian-waffle.jpg' }
  ];

  window.OBUNUZI_MENU_ITEM_IMAGES = {
    'Matooke & Beef Stew': '/images/obunuzi-ai-item-matooke-beef.jpg',
    'Traditional Luwombo (Chicken)': '/images/obunuzi-home-chicken-luwombo.jpg',
    'Traditional Luwombo (Goat)': '/images/obunuzi-home-chicken-luwombo.jpg',
    'Traditional Beef Luwombo': '/images/obunuzi-home-chicken-luwombo.jpg',
    'Katogo (Banana & Offals)': '/images/obunuzi-stitch-katogo-special.jpg',
    'Katogo (Banana & Beef)': '/images/obunuzi-stitch-katogo-special.jpg',
    'Posho & Beans': '/images/obunuzi-meal-posho-beans.jpg',
    'Rice & Beans': '/images/obunuzi-meal-posho-beans.jpg',
    'Groundnut Sauce with Local Greens': '/images/obunuzi-meal-matooke-beef.jpg',
    'Steamed Matooke': '/images/obunuzi-meal-matooke-beef.jpg',
    'Single Egg Rolex': '/images/obunuzi-imgcreator-double-egg-rolex.jpg',
    'Double Egg Rolex': '/images/obunuzi-imgcreator-double-egg-rolex.jpg',
    'Double Egg Rolex with Cabbage': '/images/obunuzi-imgcreator-double-egg-rolex.jpg',
    'Regular Rolex (2 Eggs, 1 Chapati)': '/images/obunuzi-imgcreator-double-egg-rolex.jpg',
    'Kikomando (Chapati chopped with Beans)': '/images/obunuzi-stitch-kikomando-supreme.jpg',
    'Kikkomando (Chapati chopped with Beans)': '/images/obunuzi-stitch-kikomando-supreme.jpg',
    'Grilled Muchomo (Beef Skewer)': '/images/obunuzi-meal-muchomo.jpg',
    'Grilled Muchomo (Pork Skewer)': '/images/obunuzi-meal-muchomo.jpg',
    'Aromatic Porridge (Bushera/Corn)': '/images/breakfast-porridge.jpg',
    'Vegetable Stir-fried Noodles': '/images/obunuzi-ai-item-vegetable-noodles.jpg',
    'Chicken Fried Rice': '/images/asian-chicken-fried-rice.jpg',
    'Asian Spring Rolls (3 pcs)': '/images/asian-spring-rolls.jpg',
    'Beef Samosa (2 pcs)': '/images/obunuzi-ai-item-beef-samosa.jpg',
    'Beef Shawarma Wrap': '/images/obunuzi-ai-item-beef-shawarma-wrap.jpg',
    'Belgian Waffle with Syrup': '/images/obunuzi-ai-item-belgian-waffle.jpg'
  };

  const normalizeMenuLabel = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const obunuziStaffImageRules = [
    ['double egg rolex', '/images/obunuzi-imgcreator-double-egg-rolex.jpg'],
    ['matooke beef stew', '/images/obunuzi-ai-item-matooke-beef.jpg'],
    ['chicken luwombo', '/images/obunuzi-stitch-chicken-luwombo.jpg'],
    ['luwombo chicken', '/images/obunuzi-stitch-chicken-luwombo.jpg'],
    ['katogo special', '/images/obunuzi-stitch-katogo-special.jpg'],
    ['fresh passion juice', '/images/obunuzi-stitch-fresh-passion-juice.jpg'],
    ['fresh passion fruit juice', '/images/obunuzi-stitch-fresh-passion-juice.jpg'],
    ['kikomando supreme', '/images/obunuzi-stitch-kikomando-supreme.jpg'],
    ['kikkomando supreme', '/images/obunuzi-stitch-kikomando-supreme.jpg'],
    ['pork muchomo', '/images/obunuzi-stitch-pork-muchomo-chips.jpg'],
    ['muchomo pork', '/images/obunuzi-stitch-pork-muchomo-chips.jpg']
  ];

  window.OBUNUZI_STAFF_MENU_IMAGE_FOR_ITEM = (item) => {
    if (!item || (typeof item === 'object' && item.hideOriginalImage)) return null;
    const itemName = normalizeMenuLabel(typeof item === 'string' ? item : item.name);
    const matchedRule = obunuziStaffImageRules.find(([keyword]) => itemName.includes(keyword));
    return matchedRule ? matchedRule[1] : null;
  };

  const obunuziCategoryAliases = {
    mains: 'african local cuisine',
    main: 'african local cuisine',
    sides: 'african local cuisine',
    side: 'african local cuisine',
    drinks: 'cold drinks beverages',
    beverages: 'cold drinks beverages',
    breakfast: 'breakfast morning combos',
    desserts: 'sweets desserts',
    dessert: 'sweets desserts',
    'street food': 'kampala street food favourites'
  };

  window.OBUNUZI_MENU_IMAGE_FOR_ITEM = (item) => {
    if (!item || item.hideOriginalImage) return null;
    const itemName = normalizeMenuLabel(item.name);
    const itemImage = Object.entries(window.OBUNUZI_MENU_ITEM_IMAGES)
      .find(([name]) => normalizeMenuLabel(name) === itemName);
    if (itemImage) return itemImage[1];

    const nameImageRules = [
      ['french fries', '/images/obunuzi-ai-category-american.jpg'],
      ['loaded chips', '/images/obunuzi-ai-category-american.jpg'],
      ['fried chicken', '/images/obunuzi-ai-category-american.jpg'],
      ['hot dog', '/images/obunuzi-ai-category-american.jpg'],
      ['noodles', '/images/obunuzi-ai-category-asian.jpg'],
      ['fried rice', '/images/asian-chicken-fried-rice.jpg'],
      ['spring rolls', '/images/asian-spring-rolls.jpg'],
      ['scone', '/images/obunuzi-ai-category-bakery.jpg'],
      ['mandazi', '/images/obunuzi-ai-category-bakery.jpg'],
      ['pie', '/images/obunuzi-ai-category-bakery.jpg'],
      ['doughnut', '/images/obunuzi-ai-category-bakery.jpg'],
      ['omelette', '/images/obunuzi-ai-category-breakfast.jpg'],
      ['pancakes', '/images/obunuzi-ai-category-breakfast.jpg'],
      ['breakfast combo', '/images/obunuzi-ai-category-breakfast.jpg'],
      ['porridge', '/images/breakfast-porridge.jpg'],
      ['burger', '/images/obunuzi-ai-category-burgers.jpg'],
      ['tea', '/images/obunuzi-ai-category-coffee.jpg'],
      ['cappuccino', '/images/obunuzi-ai-category-coffee.jpg'],
      ['latte', '/images/obunuzi-ai-category-coffee.jpg'],
      ['hot chocolate', '/images/obunuzi-ai-category-coffee.jpg'],
      ['soda', '/images/obunuzi-ai-category-drinks.jpg'],
      ['mineral water', '/images/obunuzi-ai-category-drinks.jpg'],
      ['energy drink', '/images/obunuzi-ai-category-drinks.jpg'],
      ['juice', '/images/obunuzi-ai-category-juices.jpg'],
      ['smoothie', '/images/obunuzi-ai-category-juices.jpg'],
      ['rolex', '/images/obunuzi-meal-rolex.jpg'],
      ['kikomando', '/images/obunuzi-meal-kikomando.jpg'],
      ['kikkomando', '/images/obunuzi-meal-kikomando.jpg'],
      ['muchomo', '/images/obunuzi-meal-muchomo.jpg'],
      ['pizza', '/images/obunuzi-ai-item-beef-shawarma-wrap.jpg'],
      ['wrap', '/images/obunuzi-ai-item-beef-shawarma-wrap.jpg'],
      ['samosa', '/images/obunuzi-ai-item-beef-samosa.jpg'],
      ['cassava', '/images/obunuzi-ai-item-beef-samosa.jpg'],
      ['plantain', '/images/obunuzi-ai-item-beef-samosa.jpg'],
      ['gonja', '/images/obunuzi-ai-item-beef-samosa.jpg'],
      ['nuggets', '/images/obunuzi-ai-item-beef-samosa.jpg'],
      ['ice cream', '/images/obunuzi-ai-item-belgian-waffle.jpg'],
      ['waffle', '/images/obunuzi-ai-item-belgian-waffle.jpg'],
      ['crepe', '/images/obunuzi-ai-item-belgian-waffle.jpg'],
      ['matooke', '/images/obunuzi-ai-item-matooke-beef.jpg'],
      ['luwombo', '/images/obunuzi-meal-luwombo.jpg'],
      ['katogo', '/images/obunuzi-meal-katogo.jpg'],
      ['posho', '/images/obunuzi-meal-posho-beans.jpg'],
      ['rice', '/images/obunuzi-meal-posho-beans.jpg']
    ];
    const matchedRule = nameImageRules.find(([keyword]) => itemName.includes(keyword));
    if (matchedRule) return matchedRule[1];

    const rawCategory = normalizeMenuLabel(item.category);
    const categoryName = obunuziCategoryAliases[rawCategory] || rawCategory;
    const category = window.OBUNUZI_MENU_CATEGORIES.find(
      (entry) => normalizeMenuLabel(entry.name) === categoryName
    );
    return category ? category.image : '/images/obunuzi-meal-luwombo.jpg';
  };
})();
