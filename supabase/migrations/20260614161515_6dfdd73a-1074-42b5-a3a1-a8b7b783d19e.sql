DROP TRIGGER IF EXISTS trg_apply_order_item_to_fridge ON public.order_items;
DROP TRIGGER IF EXISTS trigger_apply_order_item_to_fridge ON public.order_items;
CREATE TRIGGER trg_apply_order_item_to_fridge
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.apply_order_item_to_fridge();

DROP TRIGGER IF EXISTS trg_apply_order_to_inventory ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_inventory ON public.orders;
DROP TRIGGER IF EXISTS trigger_apply_order_to_inventory ON public.orders;
CREATE TRIGGER trg_apply_order_to_inventory
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.apply_order_to_inventory();