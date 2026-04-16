
-- Add auth & analytics columns to customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz,
ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
ADD COLUMN IF NOT EXISTS login_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS device_token text;

-- Unique constraints
ALTER TABLE public.customers ADD CONSTRAINT customers_phone_unique UNIQUE (phone);
ALTER TABLE public.customers ADD CONSTRAINT customers_device_token_unique UNIQUE (device_token);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_customers_device_token ON public.customers(device_token) WHERE device_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

-- RLS: allow service_role full access (already default), keep existing policies
-- Add policy for anon device-token based read (via edge function only - no direct client access needed)
