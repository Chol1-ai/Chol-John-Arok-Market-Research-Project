ALTER TABLE "stock_movements"
    ADD COLUMN "business_date" DATE NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE "stock_movements"
    ALTER COLUMN "business_date" DROP DEFAULT;
