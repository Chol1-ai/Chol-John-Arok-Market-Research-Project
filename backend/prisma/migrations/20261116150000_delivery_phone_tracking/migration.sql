CREATE TYPE "delivery_tracking_status" AS ENUM ('INVITED', 'SHARING', 'PAUSED', 'STOPPED');

CREATE TABLE "delivery_tracking_sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_id" UUID NOT NULL,
    "handoff_id" UUID,
    "customer_token_hash" CHAR(64) NOT NULL,
    "rider_token_hash" CHAR(64),
    "customer_token_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "rider_token_expires_at" TIMESTAMPTZ(6),
    "status" "delivery_tracking_status" NOT NULL DEFAULT 'INVITED',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "accuracy_m" DECIMAL(7,1),
    "speed_mps" DECIMAL(7,2),
    "heading_degrees" DECIMAL(6,2),
    "location_updated_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "paused_at" TIMESTAMPTZ(6),
    "stopped_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_tracking_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "delivery_tracking_coordinates_pair_check"
      CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
    CONSTRAINT "delivery_tracking_latitude_check"
      CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)),
    CONSTRAINT "delivery_tracking_longitude_check"
      CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180)),
    CONSTRAINT "delivery_tracking_accuracy_check"
      CHECK ("accuracy_m" IS NULL OR "accuracy_m" >= 0),
    CONSTRAINT "delivery_tracking_speed_check"
      CHECK ("speed_mps" IS NULL OR "speed_mps" >= 0),
    CONSTRAINT "delivery_tracking_heading_check"
      CHECK ("heading_degrees" IS NULL OR ("heading_degrees" >= 0 AND "heading_degrees" < 360))
);

CREATE UNIQUE INDEX "delivery_tracking_sessions_order_id_key"
  ON "delivery_tracking_sessions"("order_id");
CREATE UNIQUE INDEX "delivery_tracking_sessions_handoff_id_key"
  ON "delivery_tracking_sessions"("handoff_id");
CREATE UNIQUE INDEX "delivery_tracking_sessions_customer_token_hash_key"
  ON "delivery_tracking_sessions"("customer_token_hash");
CREATE UNIQUE INDEX "delivery_tracking_sessions_rider_token_hash_key"
  ON "delivery_tracking_sessions"("rider_token_hash");
CREATE INDEX "idx_delivery_tracking_status_updated"
  ON "delivery_tracking_sessions"("status", "location_updated_at");

ALTER TABLE "delivery_tracking_sessions"
  ADD CONSTRAINT "delivery_tracking_sessions_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_tracking_sessions"
  ADD CONSTRAINT "delivery_tracking_sessions_handoff_id_fkey"
  FOREIGN KEY ("handoff_id") REFERENCES "delivery_handoffs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
