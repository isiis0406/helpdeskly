-- Create webhook_events audit table for Stripe webhooks
CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" TEXT PRIMARY KEY,
  "stripe_event_id" TEXT UNIQUE NOT NULL,
  "event_type" TEXT NOT NULL,
  "processed" BOOLEAN NOT NULL DEFAULT TRUE,
  "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "event_data" JSONB NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Helpful index for queries by type/time
CREATE INDEX IF NOT EXISTS idx_webhook_events_type_time ON "webhook_events" ("event_type", "processed_at");
