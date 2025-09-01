-- Membership indexes
CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON "memberships" ("tenant_id");
CREATE INDEX IF NOT EXISTS idx_memberships_user_tenant ON "memberships" ("user_id", "tenant_id");

-- Subscription indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON "subscriptions" ("plan_id");

-- Invoice indexes
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON "invoices" ("tenant_id");
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON "invoices" ("subscription_id");
