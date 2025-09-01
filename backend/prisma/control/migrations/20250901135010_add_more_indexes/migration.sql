-- UsageRecord composite index for period queries
CREATE INDEX IF NOT EXISTS idx_usage_records_tenant_period ON "usage_records" ("tenant_id", "recorded_year", "recorded_month");
