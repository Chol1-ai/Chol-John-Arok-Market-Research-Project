ALTER TABLE "supplier_orders" DROP CONSTRAINT "supplier_orders_created_by_fkey";
ALTER TABLE "supplier_orders" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE "supplier_orders"
    ADD CONSTRAINT "supplier_orders_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "closing_surplus_logs" DROP CONSTRAINT "closing_surplus_logs_logged_by_fkey";
ALTER TABLE "closing_surplus_logs" ALTER COLUMN "logged_by" DROP NOT NULL;
ALTER TABLE "closing_surplus_logs"
    ADD CONSTRAINT "closing_surplus_logs_logged_by_fkey"
    FOREIGN KEY ("logged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_handoffs" DROP CONSTRAINT "delivery_handoffs_dispatched_by_fkey";
ALTER TABLE "delivery_handoffs" ALTER COLUMN "dispatched_by" DROP NOT NULL;
ALTER TABLE "delivery_handoffs"
    ADD CONSTRAINT "delivery_handoffs_dispatched_by_fkey"
    FOREIGN KEY ("dispatched_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_counts" DROP CONSTRAINT "cash_counts_counted_by_fkey";
ALTER TABLE "cash_counts" ALTER COLUMN "counted_by" DROP NOT NULL;
ALTER TABLE "cash_counts"
    ADD CONSTRAINT "cash_counts_counted_by_fkey"
    FOREIGN KEY ("counted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
