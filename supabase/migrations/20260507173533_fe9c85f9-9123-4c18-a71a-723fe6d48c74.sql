ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS item_id text;
CREATE INDEX IF NOT EXISTS idx_order_items_item_id ON public.order_items(item_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone_created_at ON public.orders(customer_phone, created_at DESC);