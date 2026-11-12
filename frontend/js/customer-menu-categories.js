(function () {
  'use strict';

  window.FOODIZO_MENU_CATEGORIES = [
    {
      name: 'African & Local Cuisine',
      description: 'Enjoy authentic campus and traditional favourites, slow-cooked to perfection with rich local flavors.',
      image: '/images/menu-categories/african-local.svg'
    },
    {
      name: 'American',
      description: 'Crispy fries, loaded platters, and golden fried chicken to satisfy your quick-service cravings.',
      image: '/images/menu-categories/american.svg'
    },
    {
      name: 'Asian',
      description: 'Savory stir-fried noodles, fragrant rice bowls, and savory oriental bites delivered hot.',
      image: '/images/menu-categories/asian.svg'
    },
    {
      name: 'Bakery & Pastries',
      description: 'Freshly baked treats, sweet cakes, and flaky pastries straight from the oven every morning.',
      image: '/images/menu-categories/bakery-pastries.svg'
    },
    {
      name: 'Breakfast & Morning Combos',
      description: 'Kickstart your campus morning with filling omelettes, pancakes, and hot morning tea combos.',
      image: '/images/menu-categories/breakfast-combos.svg'
    },
    {
      name: 'Burgers',
      description: 'Grilled beef patties, crispy chicken burgers, and stacked buns loaded with flavor.',
      image: '/images/menu-categories/burgers.svg'
    },
    {
      name: 'Coffee & Hot Teas',
      description: 'Rich espressos, frothy lattes, and spiced African teas to keep you energized through lectures.',
      image: '/images/menu-categories/coffee-hot-teas.svg'
    },
    {
      name: 'Cold Drinks & Beverages',
      description: 'Ice-cold sodas, refreshing bottled waters, and energy drinks to beat the Kampala heat.',
      image: '/images/menu-categories/cold-drinks.svg'
    },
    {
      name: 'Juices & Smoothies',
      description: '100% natural, freshly squeezed tropical fruit juices and creamy yogurt blends.',
      image: '/images/menu-categories/juices-smoothies.svg'
    },
    {
      name: 'Kampala Street Food Favourites',
      description: 'The undisputed campus champions—hot Rolexes, Kikkomandos, and muchomo joints.',
      image: '/images/menu-categories/kampala-street-food.svg'
    },
    {
      name: 'Pizza & Wraps',
      description: 'Oven-baked pizzas with rich toppings and tightly rolled, flavor-packed wraps.',
      image: '/images/menu-categories/pizza-wraps.svg'
    },
    {
      name: 'Snacks & Quick Bites',
      description: 'Quick, bite-sized snacks like crunchy samosas, cassava fries, and sweet gonja.',
      image: '/images/menu-categories/snacks-quick-bites.svg'
    },
    {
      name: 'Sweets & Desserts',
      description: 'Sweet treats, cold ice cream, and decadent waffles to finish your meal on a high note.',
      image: '/images/menu-categories/sweets-desserts.svg'
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
})();
