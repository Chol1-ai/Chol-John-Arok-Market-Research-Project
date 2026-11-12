ALTER TABLE "menu_items"
ADD COLUMN "description" VARCHAR(280);

UPDATE "menu_items"
SET "is_active" = false
WHERE "is_active" = true;

WITH menu_catalog("name", "category", "price_ugx", "station", "description") AS (
  VALUES
    ('Matooke & Beef Stew', 'African & Local Cuisine', 12000, 'STEAM_LINE', 'Fresh green bananas served with tender beef stew'),
    ('Traditional Luwombo (Chicken)', 'African & Local Cuisine', 18000, 'STEAM_LINE', 'Steamed to perfection in banana leaves'),
    ('Traditional Luwombo (Goat)', 'African & Local Cuisine', 18000, 'STEAM_LINE', 'Steamed to perfection in banana leaves'),
    ('Katogo (Banana & Offals)', 'African & Local Cuisine', 10000, 'ROLEX_GRIDDLE', 'A classic breakfast or lunch comfort meal'),
    ('Katogo (Banana & Beef)', 'African & Local Cuisine', 10000, 'ROLEX_GRIDDLE', 'A classic breakfast or lunch comfort meal'),
    ('Posho & Beans', 'African & Local Cuisine', 6000, 'STEAM_LINE', 'Simple, filling campus staple'),
    ('Groundnut Sauce with Local Greens', 'African & Local Cuisine', 8000, 'STEAM_LINE', 'Rich peanut paste stew'),
    ('Regular French Fries', 'American', 7000, 'GRILL_FRYER', 'Crispy golden potato chips'),
    ('Loaded Chips with Cheese & Beef Bits', 'American', 14000, 'GRILL_FRYER', 'Fries topped with melted cheese and minced meat'),
    ('Crispy Fried Chicken (2 Pieces)', 'American', 10000, 'GRILL_FRYER', 'Juicy, deep-fried crunchy chicken pieces'),
    ('Hot Dog Classic', 'American', 8000, 'GRILL_FRYER', 'Sausage in a soft roll with mustard and ketchup'),
    ('Vegetable Stir-fried Noodles', 'Asian', 15000, 'STEAM_LINE', 'Wok-tossed noodles with fresh veggies'),
    ('Chicken Fried Rice', 'Asian', 16000, 'STEAM_LINE', 'Aromatic fried rice with diced chicken and egg'),
    ('Asian Spring Rolls (3 pcs)', 'Asian', 7000, 'GRILL_FRYER', 'Crispy rolls with sweet chili dip'),
    ('Fresh Butter Scone', 'Bakery & Pastries', 3000, 'STEAM_LINE', 'Warm, crumbly classic tea accompaniment'),
    ('Mandazi (Pack of 3)', 'Bakery & Pastries', 2500, 'GRILL_FRYER', 'Fluffy triangular golden-brown dough snacks'),
    ('Meat Pie', 'Bakery & Pastries', 5000, 'STEAM_LINE', 'Flaky pastry filled with spiced minced meat'),
    ('Sausage Roll', 'Bakery & Pastries', 5000, 'STEAM_LINE', 'Flaky pastry filled with spiced minced meat'),
    ('Chocolate Doughnut', 'Bakery & Pastries', 4000, 'STEAM_LINE', 'Soft glazed doughnut with rich chocolate topping'),
    ('Spanish Omelette with Toast', 'Breakfast & Morning Combos', 8000, 'STEAM_LINE', 'Eggs folded with tomatoes, onions, and peppers'),
    ('Pancakes Stack (3 pcs)', 'Breakfast & Morning Combos', 6000, 'STEAM_LINE', 'Fluffy pancakes served with syrup or honey'),
    ('Full Campus Breakfast Combo', 'Breakfast & Morning Combos', 12000, 'STEAM_LINE', 'Eggs, sausage, toast, and African spiced tea'),
    ('Aromatic Porridge (Bushera/Corn)', 'Breakfast & Morning Combos', 4000, 'STEAM_LINE', 'Warm, nourishing traditional porridge'),
    ('Classic Beef Burger', 'Burgers', 12000, 'GRILL_FRYER', 'Juicy beef patty, lettuce, tomato, special sauce'),
    ('Crispy Chicken Burger', 'Burgers', 13000, 'GRILL_FRYER', 'Crunchy fried chicken fillet with mayo and slaw'),
    ('Double Stack Cheeseburger', 'Burgers', 18000, 'GRILL_FRYER', 'Double beef patties with extra melted cheese'),
    ('Veggie Burger', 'Burgers', 10000, 'GRILL_FRYER', 'Plant-based patty with fresh garden greens'),
    ('Spiced African Tea (Cinnamon & Ginger)', 'Coffee & Hot Teas', 4000, 'BAR_BEVERAGE', 'Strong local tea brewed with milk and spices'),
    ('Cappuccino', 'Coffee & Hot Teas', 7000, 'BAR_BEVERAGE', 'Espresso with steamed milk foam'),
    ('Café Latte', 'Coffee & Hot Teas', 7500, 'BAR_BEVERAGE', 'Smooth espresso with textured milk'),
    ('Hot Chocolate', 'Coffee & Hot Teas', 6000, 'BAR_BEVERAGE', 'Rich and creamy cocoa drink'),
    ('Soda - Coca-Cola (500ml)', 'Cold Drinks & Beverages', 3000, 'BAR_BEVERAGE', 'Chilled soft drink'),
    ('Soda - Sprite (500ml)', 'Cold Drinks & Beverages', 3000, 'BAR_BEVERAGE', 'Chilled soft drink'),
    ('Soda - Mirinda (500ml)', 'Cold Drinks & Beverages', 3000, 'BAR_BEVERAGE', 'Chilled soft drink'),
    ('Bottled Mineral Water (500ml)', 'Cold Drinks & Beverages', 2000, 'BAR_BEVERAGE', 'Purified drinking water'),
    ('Energy Drink - Predator', 'Cold Drinks & Beverages', 5000, 'BAR_BEVERAGE', 'Quick energy boost'),
    ('Energy Drink - Azam', 'Cold Drinks & Beverages', 5000, 'BAR_BEVERAGE', 'Quick energy boost'),
    ('Iced Lemon Tea', 'Cold Drinks & Beverages', 5000, 'BAR_BEVERAGE', 'Refreshing cold brewed tea with lemon'),
    ('Fresh Passion Fruit Juice', 'Juices & Smoothies', 6000, 'BAR_BEVERAGE', 'Naturally sweet and tangy local passion juice'),
    ('Fresh Mango Juice (Seasonal)', 'Juices & Smoothies', 6000, 'BAR_BEVERAGE', 'Smooth, rich blended fresh mango'),
    ('Pineapple Ginger Blend', 'Juices & Smoothies', 6000, 'BAR_BEVERAGE', 'Refreshing citrus kick with a hint of ginger'),
    ('Tropical Yogurt Smoothie', 'Juices & Smoothies', 8000, 'BAR_BEVERAGE', 'Blended yogurt with mixed fruits'),
    ('Single Egg Rolex', 'Kampala Street Food Favourites', 3500, 'ROLEX_GRIDDLE', 'Eggs, onions, tomatoes wrapped in a warm chapati'),
    ('Double Egg Rolex with Cabbage', 'Kampala Street Food Favourites', 5000, 'ROLEX_GRIDDLE', 'Extra eggs, veggies, and chapati goodness'),
    ('Kikkomando (Chapati chopped with Beans)', 'Kampala Street Food Favourites', 5000, 'ROLEX_GRIDDLE', 'Campus favorite comfort food'),
    ('Grilled Muchomo (Beef Skewer)', 'Kampala Street Food Favourites', 6000, 'GRILL_FRYER', 'Juicy spiced meat skewers with kachumbari'),
    ('Grilled Muchomo (Pork Skewer)', 'Kampala Street Food Favourites', 6000, 'GRILL_FRYER', 'Juicy spiced meat skewers with kachumbari'),
    ('Chicken Tikka Pizza (Medium)', 'Pizza & Wraps', 25000, 'GRILL_FRYER', 'Spiced chicken chunks, mozzarella, and bell peppers'),
    ('Margherita Pizza (Medium)', 'Pizza & Wraps', 20000, 'GRILL_FRYER', 'Classic tomato sauce, basil, and double cheese'),
    ('Beef Shawarma Wrap', 'Pizza & Wraps', 12000, 'GRILL_FRYER', 'Tender shredded beef, garlic sauce, and veggies in flatbread'),
    ('Crispy Chicken Wrap', 'Pizza & Wraps', 11000, 'GRILL_FRYER', 'Fried chicken strips with lettuce and creamy dressing'),
    ('Beef Samosa (2 pcs)', 'Snacks & Quick Bites', 3000, 'GRILL_FRYER', 'Crispy triangular pastry with savory filling'),
    ('Vegetable Samosa (2 pcs)', 'Snacks & Quick Bites', 3000, 'GRILL_FRYER', 'Crispy triangular pastry with savory filling'),
    ('Cassava Fries with Chili', 'Snacks & Quick Bites', 5000, 'GRILL_FRYER', 'Golden fried cassava chunks'),
    ('Fried Plantain (Gonja)', 'Snacks & Quick Bites', 4000, 'GRILL_FRYER', 'Sweet caramelized ripe plantain slices'),
    ('Chicken Nuggets (5 pcs)', 'Snacks & Quick Bites', 8000, 'GRILL_FRYER', 'Bite-sized crispy chicken pieces with dipping sauce'),
    ('Ice Cream Cup (2 Scoops)', 'Sweets & Desserts', 6000, 'BAR_BEVERAGE', 'Vanilla, chocolate, or strawberry'),
    ('Belgian Waffle with Syrup', 'Sweets & Desserts', 9000, 'STEAM_LINE', 'Warm golden waffle drizzled with maple syrup'),
    ('Sweet Crêpe with Nutella', 'Sweets & Desserts', 10000, 'STEAM_LINE', 'Thin pancake folded with rich chocolate spread')
)
INSERT INTO "menu_items" (
  "outlet",
  "name",
  "category",
  "price_ugx",
  "station",
  "description",
  "is_active"
)
SELECT
  outlets."outlet",
  menu_catalog."name",
  menu_catalog."category",
  menu_catalog."price_ugx",
  menu_catalog."station"::"station_type",
  menu_catalog."description",
  true
FROM menu_catalog
CROSS JOIN (
  VALUES
    ('FOODIZO_HAM_TOWERS'::"outlet_location"),
    ('OBUNUZI_YMCA'::"outlet_location")
) AS outlets("outlet")
ON CONFLICT ("outlet", "name") DO UPDATE SET
  "category" = EXCLUDED."category",
  "price_ugx" = EXCLUDED."price_ugx",
  "station" = EXCLUDED."station",
  "description" = EXCLUDED."description",
  "is_active" = true,
  "is_86" = false,
  "updated_at" = now();
