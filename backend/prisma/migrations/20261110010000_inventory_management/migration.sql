CREATE TYPE "stock_movement_type" AS ENUM ('STOCK_COUNT', 'MANUAL_USAGE', 'SALES_USAGE', 'SUPPLIER_RECEIPT');

CREATE TYPE "supplier_order_status" AS ENUM ('ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED');

CREATE TABLE "supplier_orders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "outlet" "outlet_location" NOT NULL,
    "supplier_name" VARCHAR(100) NOT NULL,
    "status" "supplier_order_status" NOT NULL DEFAULT 'ORDERED',
    "notes" VARCHAR(250),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_at" TIMESTAMPTZ(6),

    CONSTRAINT "supplier_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_order_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "supplier_order_id" UUID NOT NULL,
    "inventory_id" UUID NOT NULL,
    "quantity_ordered" DECIMAL(10,2) NOT NULL,
    "quantity_received" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "unit_cost_ugx" DECIMAL(10,2),

    CONSTRAINT "supplier_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "outlet" "outlet_location" NOT NULL,
    "inventory_id" UUID NOT NULL,
    "recorded_by" UUID,
    "movement_type" "stock_movement_type" NOT NULL,
    "quantity_change" DECIMAL(10,2) NOT NULL,
    "stock_after" DECIMAL(10,2) NOT NULL,
    "note" VARCHAR(250),
    "order_id" UUID,
    "supplier_order_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_order_item_unique" ON "supplier_order_items"("supplier_order_id", "inventory_id");
CREATE INDEX "idx_supplier_orders_outlet_status" ON "supplier_orders"("outlet", "status", "created_at" DESC);
CREATE INDEX "idx_stock_movements_outlet_created" ON "stock_movements"("outlet", "created_at" DESC);
CREATE INDEX "idx_stock_movements_inventory_created" ON "stock_movements"("inventory_id", "created_at" DESC);
CREATE UNIQUE INDEX "stock_movement_order_inventory_unique" ON "stock_movements"("order_id", "inventory_id");

ALTER TABLE "supplier_orders"
    ADD CONSTRAINT "supplier_orders_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_order_items"
    ADD CONSTRAINT "supplier_order_items_supplier_order_id_fkey"
    FOREIGN KEY ("supplier_order_id") REFERENCES "supplier_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "supplier_order_items_inventory_id_fkey"
    FOREIGN KEY ("inventory_id") REFERENCES "raw_inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
    ADD CONSTRAINT "stock_movements_inventory_id_fkey"
    FOREIGN KEY ("inventory_id") REFERENCES "raw_inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "stock_movements_recorded_by_fkey"
    FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "stock_movements_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "stock_movements_supplier_order_id_fkey"
    FOREIGN KEY ("supplier_order_id") REFERENCES "supplier_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
