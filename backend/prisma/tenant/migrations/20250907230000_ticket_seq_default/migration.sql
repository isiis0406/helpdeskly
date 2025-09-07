-- Create a sequence for ticket numbers if not exists
DO $$ BEGIN
  CREATE SEQUENCE IF NOT EXISTS tickets_ticketNumber_seq;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Set default using the sequence (prefix T- and zero-pad to 6)
ALTER TABLE "tickets"
  ALTER COLUMN "ticketNumber" SET DEFAULT 'T-' || LPAD(nextval('tickets_ticketNumber_seq')::text, 6, '0');

