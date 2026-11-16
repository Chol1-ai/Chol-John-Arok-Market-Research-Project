UPDATE "menu_items" AS old_item
SET "is_active" = false,
    "is_86" = true,
    "updated_at" = now()
WHERE old_item."name" = 'Kikkomando (Chapati chopped with Beans)'
  AND EXISTS (
    SELECT 1
    FROM "menu_items" AS corrected_item
    WHERE corrected_item."outlet" = old_item."outlet"
      AND corrected_item."name" = 'Kikomando (Chapati chopped with Beans)'
  );

UPDATE "menu_items" AS old_item
SET "name" = 'Kikomando (Chapati chopped with Beans)',
    "updated_at" = now()
WHERE old_item."name" = 'Kikkomando (Chapati chopped with Beans)'
  AND NOT EXISTS (
    SELECT 1
    FROM "menu_items" AS corrected_item
    WHERE corrected_item."outlet" = old_item."outlet"
      AND corrected_item."name" = 'Kikomando (Chapati chopped with Beans)'
  );
