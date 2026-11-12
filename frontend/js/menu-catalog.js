(function () {
  'use strict';

  window.FOODIZO_MENU_CATEGORIES = [
    {
      title: 'African & Local Cuisine',
      description: 'Enjoy authentic campus and traditional favourites, slow-cooked to perfection with rich local flavors.',
      image: '/images/african-groundnut-greens.jpg',
      imageAlt: 'Matooke served with steamed local greens and groundnut sauce.',
      items: [
        { name: 'Matooke & Beef Stew', price: 'UGX 12,000', note: 'Fresh green bananas served with tender beef stew', image: '/images/foodizo-luwombo.jpg' },
        { name: 'Traditional Luwombo (Chicken or Goat)', price: 'UGX 18,000', note: 'Steamed to perfection in banana leaves', image: '/images/african-luwombo.jpg' },
        { name: 'Katogo (Banana & Offals/Beef)', price: 'UGX 10,000', note: 'A classic breakfast or lunch comfort meal', image: '/images/foodizo-katogo.jpg' },
        { name: 'Posho & Beans', price: 'UGX 6,000', note: 'Simple, filling campus staple', image: '/images/african-posho-beans.jpg' },
        { name: 'Groundnut Sauce with Local Greens', price: 'UGX 8,000', note: 'Rich peanut paste stew', image: '/images/african-groundnut-greens.jpg' }
      ]
    },
    {
      title: 'American',
      description: 'Crispy fries, loaded platters, and golden fried chicken to satisfy your quick-service cravings.',
      image: '/images/american-wings-and-fries.jpg',
      imageAlt: 'Golden crispy French fries served with fried chicken wings.',
      items: [
        { name: 'Regular French Fries', price: 'UGX 7,000', note: 'Crispy golden potato chips', image: '/images/foodizo-plain-chips.jpg' },
        { name: 'Loaded Chips with Cheese & Beef Bits', price: 'UGX 14,000', note: 'Fries topped with melted cheese and minced meat', image: '/images/american-loaded-fries.jpg' },
        { name: 'Crispy Fried Chicken (2 Pieces)', price: 'UGX 10,000', note: 'Juicy, deep-fried crunchy chicken pieces', image: '/images/american-fried-chicken.jpg' },
        { name: 'Hot Dog Classic', price: 'UGX 8,000', note: 'Sausage in a soft roll with mustard and ketchup', image: '/images/american-hot-dog.jpg' }
      ]
    },
    {
      title: 'Asian',
      description: 'Savory stir-fried noodles, fragrant rice bowls, and savory oriental bites delivered hot.',
      image: '/images/category-asian-photo.jpg',
      imageAlt: 'A bowl of stir-fried noodles with vegetables and chopsticks.',
      items: [
        { name: 'Vegetable Stir-fried Noodles', price: 'UGX 15,000', note: 'Wok-tossed noodles with fresh veggies', image: '/images/asian-vegetable-noodles.jpg' },
        { name: 'Chicken Fried Rice', price: 'UGX 16,000', note: 'Aromatic fried rice with diced chicken and egg', image: '/images/asian-chicken-fried-rice.jpg' },
        { name: 'Asian Spring Rolls (3 pcs)', price: 'UGX 7,000', note: 'Crispy rolls with sweet chili dip', image: '/images/asian-spring-rolls.jpg' }
      ]
    },
    {
      title: 'Bakery & Pastries',
      description: 'Freshly baked treats, sweet cakes, and flaky pastries straight from the oven every morning.',
      image: '/images/category-bakery-photo.jpg',
      imageAlt: 'Fresh bread and assorted golden pastries in a bakery display.',
      items: [
        { name: 'Fresh Butter Scone', price: 'UGX 3,000', note: 'Warm, crumbly classic tea accompaniment', image: '/images/bakery-scone.jpg' },
        { name: 'Mandazi (Pack of 3)', price: 'UGX 2,500', note: 'Fluffy triangular golden-brown dough snacks', image: '/images/bakery-mandazi.jpg' },
        { name: 'Meat Pie / Sausage Roll', price: 'UGX 5,000', note: 'Flaky pastry filled with spiced minced meat', image: '/images/bakery-meat-pie.jpg' },
        { name: 'Chocolate Doughnut', price: 'UGX 4,000', note: 'Soft glazed doughnut with rich chocolate topping', image: '/images/bakery-chocolate-doughnut.jpg' }
      ]
    },
    {
      title: 'Breakfast & Morning Combos',
      description: 'Kickstart your campus morning with filling omelettes, pancakes, and hot morning tea combos.',
      image: '/images/category-breakfast-photo.jpg',
      imageAlt: 'A hearty breakfast plate with eggs, toast, sausages, and iced tea.',
      items: [
        { name: 'Spanish Omelette with Toast', price: 'UGX 8,000', note: 'Eggs folded with tomatoes, onions, and peppers', image: '/images/breakfast-spanish-omelette.jpg' },
        { name: 'Pancakes Stack (3 pcs)', price: 'UGX 6,000', note: 'Fluffy pancakes served with syrup or honey', image: '/images/breakfast-pancakes.jpg' },
        { name: 'Full Campus Breakfast Combo', price: 'UGX 12,000', note: 'Eggs, sausage, toast, and African spiced tea', image: '/images/category-breakfast-photo.jpg' },
        { name: 'Aromatic Porridge (Bushera/Corn)', price: 'UGX 4,000', note: 'Warm, nourishing traditional porridge', image: '/images/breakfast-porridge.jpg' }
      ]
    },
    {
      title: 'Burgers',
      description: 'Grilled beef patties, crispy chicken burgers, and stacked buns loaded with flavor.',
      image: '/images/category-burger-photo.jpg',
      imageAlt: 'A cheeseburger stacked with lettuce, tomato, onion, and cheese.',
      items: [
        { name: 'Classic Beef Burger', price: 'UGX 12,000', note: 'Juicy beef patty, lettuce, tomato, special sauce', image: '/images/category-burger-photo.jpg' },
        { name: 'Crispy Chicken Burger', price: 'UGX 13,000', note: 'Crunchy fried chicken fillet with mayo and slaw', image: '/images/burger-crispy-chicken.jpg' },
        { name: 'Double Stack Cheeseburger', price: 'UGX 18,000', note: 'Double beef patties with extra melted cheese', image: '/images/burger-double-cheeseburger.jpg' },
        { name: 'Veggie Burger', price: 'UGX 10,000', note: 'Plant-based patty with fresh garden greens', image: '/images/burger-veggie.jpg' }
      ]
    },
    {
      title: 'Coffee & Hot Teas',
      description: 'Rich espressos, frothy lattes, and spiced African teas to keep you energized through lectures.',
      image: '/images/category-coffee-photo.jpg',
      imageAlt: 'A cappuccino topped with detailed latte art.',
      items: [
        { name: 'Spiced African Tea (Cinnamon & Ginger)', price: 'UGX 4,000', note: 'Strong local tea brewed with milk and spices', image: '/images/coffee-spiced-tea.jpg' },
        { name: 'Cappuccino', price: 'UGX 7,000', note: 'Espresso with steamed milk foam', image: '/images/category-coffee-photo.jpg' },
        { name: 'Café Latte', price: 'UGX 7,500', note: 'Smooth espresso with textured milk', image: '/images/coffee-latte.jpg' },
        { name: 'Hot Chocolate', price: 'UGX 6,000', note: 'Rich and creamy cocoa drink', image: '/images/coffee-hot-chocolate.jpg' }
      ]
    },
    {
      title: 'Cold Drinks & Beverages',
      description: 'Ice-cold sodas, refreshing bottled waters, and energy drinks to beat the Kampala heat.',
      image: '/images/category-drinks-photo.jpg',
      imageAlt: 'Chilled bottled sodas resting on ice.',
      items: [
        { name: 'Soda (Coca-Cola, Sprite, Mirinda 500ml)', price: 'UGX 3,000', note: 'Chilled soft drink', image: '/images/category-drinks-photo.jpg' },
        { name: 'Bottled Mineral Water (500ml)', price: 'UGX 2,000', note: 'Purified drinking water', image: '/images/foodizo-bottled-water.jpg' },
        { name: 'Energy Drink (Predator / Azam)', price: 'UGX 5,000', note: 'Quick energy boost', image: '/images/drinks-energy.jpg' },
        { name: 'Iced Lemon Tea', price: 'UGX 5,000', note: 'Refreshing cold brewed tea with lemon', image: '/images/drinks-iced-lemon-tea.jpg' }
      ]
    },
    {
      title: 'Juices & Smoothies',
      description: '100% natural, freshly squeezed tropical fruit juices and creamy yogurt blends.',
      image: '/images/foodizo-juice.jpg',
      imageAlt: 'Fresh passion fruit juice garnished with mint.',
      items: [
        { name: 'Fresh Passion Fruit Juice', price: 'UGX 6,000', note: 'Naturally sweet and tangy local passion juice', image: '/images/foodizo-juice.jpg' },
        { name: 'Fresh Mango Juice (Seasonal)', price: 'UGX 6,000', note: 'Smooth, rich blended fresh mango', image: '/images/juice-mango.jpg' },
        { name: 'Pineapple Ginger Blend', price: 'UGX 6,000', note: 'Refreshing citrus kick with a hint of ginger', image: '/images/juice-pineapple-ginger.jpg' },
        { name: 'Tropical Yogurt Smoothie', price: 'UGX 8,000', note: 'Blended yogurt with mixed fruits', image: '/images/juice-tropical-smoothie.jpg' }
      ]
    },
    {
      title: 'Kampala Street Food Favourites',
      description: 'The undisputed campus champions—hot Rolexes, Kikkomandos, and muchomo joints.',
      image: '/images/foodizo-rolex.jpg',
      imageAlt: 'Ugandan Rolex chapati wraps filled with egg and vegetables.',
      items: [
        { name: 'Single Egg Rolex', price: 'UGX 3,500', note: 'Eggs, onions, tomatoes wrapped in a warm chapati', image: '/images/foodizo-rolex.jpg' },
        { name: 'Double Egg Rolex with Cabbage', price: 'UGX 5,000', note: 'Extra eggs, veggies, and chapati goodness', image: '/images/street-double-rolex.jpg' },
        { name: 'Kikkomando (Chapati chopped with Beans)', price: 'UGX 5,000', note: 'Campus favorite comfort food', image: '/images/street-kikkomando.jpg' },
        { name: 'Grilled Muchomo (Beef/Pork Skewer)', price: 'UGX 6,000', note: 'Juicy spiced meat skewers with kachumbari', image: '/images/street-muchomo.jpg' }
      ]
    },
    {
      title: 'Pizza & Wraps',
      description: 'Oven-baked pizzas with rich toppings and tightly rolled, flavor-packed wraps.',
      image: '/images/category-pizza-photo.jpg',
      imageAlt: 'A pizza slice lifted from the pie with melted cheese stretching.',
      items: [
        { name: 'Chicken Tikka Pizza (Medium)', price: 'UGX 25,000', note: 'Spiced chicken chunks, mozzarella, and bell peppers', image: '/images/pizza-chicken-tikka.jpg' },
        { name: 'Margherita Pizza (Medium)', price: 'UGX 20,000', note: 'Classic tomato sauce, basil, and double cheese', image: '/images/category-pizza-photo.jpg' },
        { name: 'Beef Shawarma Wrap', price: 'UGX 12,000', note: 'Tender shredded beef, garlic sauce, and veggies in flatbread', image: '/images/pizza-beef-shawarma.jpg' },
        { name: 'Crispy Chicken Wrap', price: 'UGX 11,000', note: 'Fried chicken strips with lettuce and creamy dressing', image: '/images/pizza-crispy-chicken-wrap.jpg' }
      ]
    },
    {
      title: 'Snacks & Quick Bites',
      description: 'Quick, bite-sized snacks like crunchy samosas, cassava fries, and sweet gonja.',
      image: '/images/category-snacks-photo.jpg',
      imageAlt: 'Golden samosas beside fried plantain slices.',
      items: [
        { name: 'Beef / Vegetable Samosa (2 pcs)', price: 'UGX 3,000', note: 'Crispy triangular pastry with savory filling', image: '/images/snack-samosa.jpg' },
        { name: 'Cassava Fries with Chili', price: 'UGX 5,000', note: 'Golden fried cassava chunks', image: '/images/snack-cassava-fries.jpg' },
        { name: 'Fried Plantain (Gonja)', price: 'UGX 4,000', note: 'Sweet caramelized ripe plantain slices', image: '/images/snack-fried-plantain.jpg' },
        { name: 'Chicken Nuggets (5 pcs)', price: 'UGX 8,000', note: 'Bite-sized crispy chicken pieces with dipping sauce', image: '/images/snack-chicken-nuggets.jpg' }
      ]
    },
    {
      title: 'Sweets & Desserts',
      description: 'Sweet treats, cold ice cream, and decadent waffles to finish your meal on a high note.',
      image: '/images/category-dessert-photo.jpg',
      imageAlt: 'Ice cream in a waffle cone beside a sundae with toppings.',
      items: [
        { name: 'Ice Cream Cup (2 Scoops)', price: 'UGX 6,000', note: 'Vanilla, chocolate, or strawberry', image: '/images/category-dessert-photo.jpg' },
        { name: 'Belgian Waffle with Syrup', price: 'UGX 9,000', note: 'Warm golden waffle drizzled with maple syrup', image: '/images/dessert-belgian-waffle.jpg' },
        { name: 'Sweet Crêpe with Nutella', price: 'UGX 10,000', note: 'Thin pancake folded with rich chocolate spread', image: '/images/dessert-chocolate-crepe.jpg' }
      ]
    }
  ];
})();
