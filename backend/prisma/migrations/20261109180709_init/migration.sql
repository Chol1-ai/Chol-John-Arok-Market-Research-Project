CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "outlet_location" AS ENUM ('FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('CUSTOMER', 'WAITER_FOH', 'KITCHEN_STAFF', 'MANAGER_ADMIN');

-- CreateEnum
CREATE TYPE "channel_type" AS ENUM ('DINE_IN', 'TAKEAWAY_PICKUP', 'PHONE_DELIVERY');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('AWAITING_PAYMENT', 'PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "station_type" AS ENUM ('STEAM_LINE', 'GRILL_FRYER', 'ROLEX_GRIDDLE', 'BAR_BEVERAGE');

-- CreateEnum
CREATE TYPE "table_status" AS ENUM ('VACANT', 'OCCUPIED', 'BILL_REQUESTED', 'NEEDS_CLEARING');

-- CreateEnum
CREATE TYPE "uom_type" AS ENUM ('MILLILITERS', 'LITERS', 'GRAMS', 'KILOGRAMS', 'PIECES', 'PORTIONS', 'UNITS');

-- CreateEnum
CREATE TYPE "surplus_action" AS ENUM ('DISCOUNTED_CLEARANCE', 'STAFF_MEAL', 'WASTE_DISCARDED');

-- CreateEnum
CREATE TYPE "dispatch_method" AS ENUM ('CALL', 'WHATSAPP', 'COUNTER_HANDOFF');

-- CreateEnum
CREATE TYPE "handoff_outcome" AS ENUM ('PENDING', 'DELIVERED', 'FAILED_UNREACHABLE', 'REFUSED', 'RETURNED');

-- CreateEnum
CREATE TYPE "digest_status" AS ENUM ('GENERATED', 'PARTIAL', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('INITIATED', 'PENDING_CUSTOMER_PIN', 'SUCCESSFUL', 'FAILED', 'TIMED_OUT', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "payment_carrier" AS ENUM ('MTN', 'AIRTEL', 'CASH', 'MANUAL_MOMO');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "outlet" "outlet_location",
    "role" "user_role" NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "ip_address" INET,
    "user_agent" TEXT,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "actor_role" "user_role",
    "outlet" "outlet_location",
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID,
    "before_json" JSONB,
    "after_json" JSONB,
    "reason" TEXT,
    "ip_address" INET,
    "request_id" UUID,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "outlet" "outlet_location" NOT NULL,
    "zone_code" VARCHAR(40) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "landmark_group" VARCHAR(60) NOT NULL,
    "landmark_hint" VARCHAR(160),
    "fee_ugx" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "eta_min_minutes" INTEGER NOT NULL DEFAULT 10,
    "eta_max_minutes" INTEGER NOT NULL DEFAULT 20,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_tables" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "outlet" "outlet_location" NOT NULL,
    "table_label" VARCHAR(20) NOT NULL,
    "capacity" INTEGER DEFAULT 4,
    "status" "table_status" NOT NULL DEFAULT 'VACANT',
    "current_waiter_id" UUID,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "outlet" "outlet_location" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "price_ugx" DECIMAL(10,2) NOT NULL,
    "station" "station_type" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_86" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "outlet" "outlet_location" NOT NULL,
    "digital_token" VARCHAR(20) NOT NULL,
    "public_ref" VARCHAR(32) NOT NULL,
    "business_date" DATE NOT NULL,
    "channel" "channel_type" NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "table_id" UUID,
    "created_by" UUID,
    "customer_name" VARCHAR(80),
    "customer_phone" VARCHAR(20),
    "delivery_zone_id" UUID,
    "delivery_note" VARCHAR(160),
    "delivery_lat" DECIMAL(9,6),
    "delivery_lng" DECIMAL(9,6),
    "delivery_accuracy_m" DECIMAL(6,1),
    "delivery_pin_captured_at" TIMESTAMPTZ(6),
    "subtotal_ugx" DECIMAL(10,2) NOT NULL,
    "delivery_fee_ugx" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "total_amount_ugx" DECIMAL(10,2) NOT NULL,
    "estimated_prep_minutes" INTEGER DEFAULT 10,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ready_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by" UUID,
    "cancellation_reason" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "menu_item_name" VARCHAR(100) NOT NULL,
    "station" "station_type" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_ugx" DECIMAL(10,2) NOT NULL,
    "line_total_ugx" DECIMAL(10,2) NOT NULL,
    "is_bumped" BOOLEAN NOT NULL DEFAULT false,
    "special_notes" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_inventory" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "outlet" "outlet_location" NOT NULL,
    "item_name" VARCHAR(100) NOT NULL,
    "unit_of_measure" "uom_type" NOT NULL,
    "current_stock" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "alert_threshold" DECIMAL(10,2) NOT NULL DEFAULT 5.00,
    "is_high_turnover" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_bom" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "menu_item_id" UUID NOT NULL,
    "raw_material_id" UUID NOT NULL,
    "quantity_deducted" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "recipe_bom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closing_surplus_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "outlet" "outlet_location" NOT NULL,
    "log_date" DATE NOT NULL,
    "menu_item_id" UUID,
    "item_name" VARCHAR(100) NOT NULL,
    "leftover_portions" INTEGER NOT NULL,
    "resolution" "surplus_action" NOT NULL,
    "logged_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closing_surplus_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_handoffs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_id" UUID NOT NULL,
    "rider_name" VARCHAR(80) NOT NULL,
    "rider_phone" VARCHAR(20),
    "dispatched_by" UUID NOT NULL,
    "dispatch_method" "dispatch_method" NOT NULL DEFAULT 'CALL',
    "rider_advance_ugx" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "rider_advance_returned_ugx" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "dispatched_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ(6),
    "outcome" "handoff_outcome" NOT NULL DEFAULT 'PENDING',
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "delivery_handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_counts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "outlet" "outlet_location" NOT NULL,
    "business_date" DATE NOT NULL,
    "counted_cash_ugx" DECIMAL(10,2) NOT NULL,
    "expected_cash_ugx" DECIMAL(10,2) NOT NULL,
    "variance_ugx" DECIMAL(10,2) NOT NULL,
    "counted_by" UUID NOT NULL,
    "counted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "cash_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_digests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "business_date" DATE NOT NULL,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "digest_status" NOT NULL DEFAULT 'GENERATED',
    "gross_ugx" DECIMAL(12,2),
    "flags" INTEGER NOT NULL DEFAULT 0,
    "link_token" VARCHAR(16),
    "payload_json" JSONB NOT NULL,
    "channels_sent" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sms_status" VARCHAR(20),
    "email_status" VARCHAR(20),
    "sent_at" TIMESTAMPTZ(6),
    "error" TEXT,

    CONSTRAINT "daily_digests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_counters" (
    "outlet" "outlet_location" NOT NULL,
    "business_date" DATE NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "token_counters_pkey" PRIMARY KEY ("outlet","business_date")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(36) NOT NULL,
    "carrier" "payment_carrier" NOT NULL,
    "customer_msisdn" VARCHAR(20),
    "amount_ugx" DECIMAL(10,2) NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'INITIATED',
    "external_transaction_id" VARCHAR(100),
    "audit_flag" VARCHAR(50),
    "failure_reason" TEXT,
    "recorded_by" UUID,
    "manual_verified_by" UUID,
    "manual_verified_at" TIMESTAMPTZ(6),
    "initiated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "refunded_at" TIMESTAMPTZ(6),
    "refund_reference" VARCHAR(100),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" BIGSERIAL NOT NULL,
    "payment_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "event_id" VARCHAR(180) NOT NULL,
    "payload_json" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "idx_user_sessions_active" ON "user_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "idx_audit_log_occurred" ON "audit_log"("occurred_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_log_entity" ON "audit_log"("entity_type", "entity_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_log_actor" ON "audit_log"("actor_user_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "idx_delivery_zones_outlet_active" ON "delivery_zones"("outlet", "is_active", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zones_outlet_zone_code_key" ON "delivery_zones"("outlet", "zone_code");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_tables_outlet_table_label_key" ON "restaurant_tables"("outlet", "table_label");

-- CreateIndex
CREATE INDEX "idx_menu_items_outlet_active" ON "menu_items"("outlet", "is_active", "category", "name");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_outlet_name_key" ON "menu_items"("outlet", "name");

-- CreateIndex
CREATE UNIQUE INDEX "orders_public_ref_key" ON "orders"("public_ref");

-- CreateIndex
CREATE INDEX "idx_orders_delivery_zone" ON "orders"("delivery_zone_id");

-- CreateIndex
CREATE INDEX "idx_orders_channel_status" ON "orders"("channel", "status");

-- CreateIndex
CREATE INDEX "idx_orders_outlet_business_date" ON "orders"("outlet", "business_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_outlet_business_date_digital_token_key" ON "orders"("outlet", "business_date", "digital_token");

-- CreateIndex
CREATE INDEX "idx_order_items_order" ON "order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "raw_inventory_outlet_item_name_key" ON "raw_inventory"("outlet", "item_name");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_bom_menu_item_id_raw_material_id_key" ON "recipe_bom"("menu_item_id", "raw_material_id");

-- CreateIndex
CREATE INDEX "idx_closing_surplus_date" ON "closing_surplus_logs"("outlet", "log_date");

-- CreateIndex
CREATE INDEX "idx_delivery_handoffs_order" ON "delivery_handoffs"("order_id");

-- CreateIndex
CREATE INDEX "idx_delivery_handoffs_outcome" ON "delivery_handoffs"("outcome", "dispatched_at");

-- CreateIndex
CREATE INDEX "idx_cash_counts_date" ON "cash_counts"("business_date", "outlet");

-- CreateIndex
CREATE UNIQUE INDEX "cash_counts_outlet_business_date_key" ON "cash_counts"("outlet", "business_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_digests_business_date_key" ON "daily_digests"("business_date");

-- CreateIndex
CREATE INDEX "idx_daily_digests_status" ON "daily_digests"("status", "business_date");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_payments_order" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "idx_payments_completed" ON "payments"("carrier", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_event_id_key" ON "payment_events"("provider", "event_id");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_current_waiter_id_fkey" FOREIGN KEY ("current_waiter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "restaurant_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "delivery_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_bom" ADD CONSTRAINT "recipe_bom_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_bom" ADD CONSTRAINT "recipe_bom_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closing_surplus_logs" ADD CONSTRAINT "closing_surplus_logs_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closing_surplus_logs" ADD CONSTRAINT "closing_surplus_logs_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_handoffs" ADD CONSTRAINT "delivery_handoffs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_handoffs" ADD CONSTRAINT "delivery_handoffs_dispatched_by_fkey" FOREIGN KEY ("dispatched_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_counts" ADD CONSTRAINT "cash_counts_counted_by_fkey" FOREIGN KEY ("counted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_manual_verified_by_fkey" FOREIGN KEY ("manual_verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
