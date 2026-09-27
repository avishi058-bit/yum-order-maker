ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS soldier_donation numeric NOT NULL DEFAULT 0;

CREATE TABLE public.soldier_fund_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delta numeric NOT NULL,
  reason text NOT NULL CHECK (reason IN ('donation','donation_reversal','spend','adjust')),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.soldier_fund_ledger TO authenticated;
GRANT ALL ON public.soldier_fund_ledger TO service_role;
ALTER TABLE public.soldier_fund_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read soldier fund" ON public.soldier_fund_ledger FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'kitchen'));
CREATE POLICY "admin adjust soldier fund" ON public.soldier_fund_ledger FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'admin') AND reason = 'adjust');

-- Credit donation once the order is actually paid; reverse on unmark
CREATE OR REPLACE FUNCTION public.soldier_fund_on_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_net numeric;
BEGIN
  IF COALESCE(NEW.soldier_donation,0) <= 0 THEN RETURN NEW; END IF;
  SELECT COALESCE(SUM(delta),0) INTO v_net FROM public.soldier_fund_ledger
   WHERE order_id = NEW.id AND reason IN ('donation','donation_reversal');
  IF NEW.paid_at IS NOT NULL AND OLD.paid_at IS NULL AND v_net = 0 THEN
    INSERT INTO public.soldier_fund_ledger(delta, reason, order_id, note)
    VALUES (NEW.soldier_donation, 'donation', NEW.id, 'הזמנה #' || NEW.order_number);
  ELSIF NEW.paid_at IS NULL AND OLD.paid_at IS NOT NULL AND v_net > 0 THEN
    INSERT INTO public.soldier_fund_ledger(delta, reason, order_id, note)
    VALUES (-v_net, 'donation_reversal', NEW.id, 'ביטול סימון תשלום');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_soldier_fund_on_paid AFTER UPDATE OF paid_at ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.soldier_fund_on_paid();

CREATE OR REPLACE FUNCTION public.soldier_fund_balance()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(delta),0) FROM public.soldier_fund_ledger
$$;

-- Pay an unpaid order entirely from the fund
CREATE OR REPLACE FUNCTION public.pay_order_from_soldier_fund(p_order_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total numeric; v_paid timestamptz; v_num int; v_bal numeric; v_q int;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'kitchen')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('soldier_fund', 3));
  SELECT total - COALESCE(soldier_donation,0), paid_at, order_number INTO v_total, v_paid, v_num
    FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_total IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF v_paid IS NOT NULL THEN RAISE EXCEPTION 'already paid'; END IF;
  v_bal := public.soldier_fund_balance();
  IF v_bal < v_total THEN RAISE EXCEPTION 'insufficient fund'; END IF;
  INSERT INTO public.soldier_fund_ledger(delta, reason, order_id, note)
  VALUES (-v_total, 'spend', p_order_id, 'הזמנה #' || v_num);
  UPDATE public.orders SET payment_method = 'soldier_fund', soldier_donation = 0 WHERE id = p_order_id;
  v_q := public.mark_order_paid(p_order_id);
  RETURN v_q;
END $$;

-- Public counter
CREATE OR REPLACE FUNCTION public.soldier_fund_public_stats()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'collected', COALESCE((SELECT SUM(delta) FROM public.soldier_fund_ledger WHERE reason IN ('donation','donation_reversal')),0),
    'meals', (SELECT COUNT(*) FROM public.soldier_fund_ledger WHERE reason = 'spend')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.soldier_fund_public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soldier_fund_public_stats() TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pay_order_from_soldier_fund(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_order_from_soldier_fund(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.soldier_fund_balance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soldier_fund_balance() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.soldier_fund_on_paid() FROM PUBLIC, anon, authenticated;