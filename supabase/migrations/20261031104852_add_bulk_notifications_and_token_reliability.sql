/*
# Add bulk approvals, availability notifications, and token reliability

1. Modified tables
- `requests`: adds a 30-minute bulk approval deadline and an optional approved-items list.
- `profiles`: adds consecutive no-show count and the end of any free-token pause.

2. New tables
- `notifications`: private in-app messages for a signed-in customer.

3. Security
- Notifications are readable and markable only by their recipient.
- Waitlist notifications use a SECURITY DEFINER function that verifies the shop owner before creating messages.
- Token expiry and successful pickup use SECURITY DEFINER functions that derive the customer or shop owner from the session.
- Functions use a fixed search path and are not callable by anonymous users.

4. Important notes
- Existing requests, tokens, and profiles keep their current values.
- Existing waitlist rows are reused; no rows are deleted.
- No pricing, distance, or catalog rules change.
*/

ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS approval_expires_at timestamptz;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS approved_items jsonb;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS no_show_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_tokens_disabled_until timestamptz;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE (read_at) ON public.notifications TO authenticated;
DROP POLICY IF EXISTS "own notifications read" ON public.notifications;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (customer = auth.uid());
DROP POLICY IF EXISTS "own notifications update" ON public.notifications;
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (customer = auth.uid()) WITH CHECK (customer = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_waitlist_for_offer(p_product uuid, p_shop uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  shop_owner uuid;
  product_name text;
  shop_name text;
BEGIN
  SELECT owner, name INTO shop_owner, shop_name FROM public.shops WHERE id = p_shop;
  IF shop_owner IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT name INTO product_name FROM public.products WHERE id = p_product;
  INSERT INTO public.notifications (customer, message)
  SELECT customer, product_name || ' is now available at ' || shop_name
  FROM public.waitlist
  WHERE product = p_product
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_my_tokens()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE public.tokens t
  SET status = 'expired'
  WHERE t.customer = auth.uid()
    AND t.status = 'active'
    AND t.expires_at < now()
    AND NOT EXISTS (SELECT 1 FROM public.scan_reports s WHERE s.token = t.id);
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  IF expired_count > 0 THEN
    UPDATE public.profiles
    SET no_show_count = no_show_count + expired_count,
        free_tokens_disabled_until = CASE WHEN no_show_count + expired_count >= 3 THEN now() + interval '24 hours' ELSE free_tokens_disabled_until END
    WHERE id = auth.uid();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_token_pickup(p_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  token_customer uuid;
BEGIN
  SELECT t.customer INTO token_customer
  FROM public.tokens t JOIN public.shops s ON s.id = t.shop
  WHERE t.id = p_token AND s.owner = auth.uid() AND t.status = 'active';
  IF token_customer IS NULL THEN RAISE EXCEPTION 'Token is not active'; END IF;
  UPDATE public.tokens SET status = 'used' WHERE id = p_token;
  UPDATE public.profiles SET no_show_count = 0, free_tokens_disabled_until = NULL WHERE id = token_customer;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_waitlist_for_offer(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.expire_my_tokens() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_token_pickup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_waitlist_for_offer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_my_tokens() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_token_pickup(uuid) TO authenticated;