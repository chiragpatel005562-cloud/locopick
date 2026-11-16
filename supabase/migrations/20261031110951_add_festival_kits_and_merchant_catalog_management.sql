/*
# Add festival kits, merchant pricing/catalog management, and bill generation

1. New tables
- `festival_kits`: shop-managed pre-packed festival kits with tier, price, and stock count.

2. Modified functions
- `complete_token_pickup`: now creates a bill, deducts the token fee from the wallet,
  and records a ledger entry on successful pickup (instead of only marking the token used).

3. Security
- Festival kits are fully managed (CRUD) only by the shop owner via RLS.
- Offer INSERT and UPDATE are now allowed for the shop owner via RLS (previously read-only).
- A SECURITY DEFINER trigger decrements kit counts when a customer places an
  order or token for a linked festival kit product.

4. Important notes
- No existing data is changed.
- The decrement trigger fires on both orders and tokens AFTER INSERT.
- Bill and wallet ledger entries are created automatically when a shopkeeper
  generates a bill via the scan flow, so the Earnings page has real data.
*/

CREATE TABLE IF NOT EXISTS festival_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product uuid REFERENCES products(id) ON DELETE SET NULL,
  name text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('basic', 'pro')),
  price numeric NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE festival_kits ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON festival_kits TO authenticated;

DROP POLICY IF EXISTS "merchant kits read" ON festival_kits;
CREATE POLICY "merchant kits read" ON festival_kits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = festival_kits.shop AND shops.owner = auth.uid()));
DROP POLICY IF EXISTS "merchant kits insert" ON festival_kits;
CREATE POLICY "merchant kits insert" ON festival_kits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM shops WHERE shops.id = festival_kits.shop AND shops.owner = auth.uid()));
DROP POLICY IF EXISTS "merchant kits update" ON festival_kits;
CREATE POLICY "merchant kits update" ON festival_kits FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = festival_kits.shop AND shops.owner = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM shops WHERE shops.id = festival_kits.shop AND shops.owner = auth.uid()));
DROP POLICY IF EXISTS "merchant kits delete" ON festival_kits;
CREATE POLICY "merchant kits delete" ON festival_kits FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = festival_kits.shop AND shops.owner = auth.uid()));

GRANT INSERT, UPDATE ON offers TO authenticated;
DROP POLICY IF EXISTS "merchant offers insert" ON offers;
CREATE POLICY "merchant offers insert" ON offers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM shops WHERE shops.id = offers.shop AND shops.owner = auth.uid()));
DROP POLICY IF EXISTS "merchant offers update" ON offers;
CREATE POLICY "merchant offers update" ON offers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = offers.shop AND shops.owner = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM shops WHERE shops.id = offers.shop AND shops.owner = auth.uid()));

CREATE OR REPLACE FUNCTION public.decrement_festival_kits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item jsonb;
  qty int;
  prod_id uuid;
BEGIN
  FOR item IN SELECT jsonb_array_elements(NEW.items) LOOP
    prod_id := NULLIF(item->'product'->>'id', '')::uuid;
    qty := COALESCE(NULLIF(item->>'quantity', '')::int, 1);
    IF prod_id IS NOT NULL AND qty > 0 THEN
      UPDATE festival_kits SET count = GREATEST(0, count - qty)
      WHERE shop = NEW.shop AND product = prod_id AND count > 0;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS decrement_kits_on_order ON orders;
CREATE TRIGGER decrement_kits_on_order AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION public.decrement_festival_kits();
DROP TRIGGER IF EXISTS decrement_kits_on_token ON tokens;
CREATE TRIGGER decrement_kits_on_token AFTER INSERT ON tokens
  FOR EACH ROW EXECUTE FUNCTION public.decrement_festival_kits();

CREATE OR REPLACE FUNCTION public.complete_token_pickup(p_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  token_customer uuid;
  token_shop uuid;
  token_items jsonb;
  token_total numeric;
  v_fee numeric := 0;
  item jsonb;
  item_category text;
  item_price numeric;
  item_qty int;
BEGIN
  SELECT t.customer, t.shop, t.items, t.total
  INTO token_customer, token_shop, token_items, token_total
  FROM public.tokens t JOIN public.shops s ON s.id = t.shop
  WHERE t.id = p_token AND s.owner = auth.uid() AND t.status = 'active';
  IF token_customer IS NULL THEN RAISE EXCEPTION 'Token is not active'; END IF;

  FOR item IN SELECT jsonb_array_elements(token_items) LOOP
    SELECT category INTO item_category FROM products WHERE id = NULLIF(item->'product'->>'id', '')::uuid;
    item_price := COALESCE(NULLIF(item->'offer'->>'price', '')::numeric, 0);
    item_qty := COALESCE(NULLIF(item->>'quantity', '')::int, 1);
    IF item_category = 'Fashion' THEN
      IF item_price <= 250 THEN v_fee := v_fee + 2.5 * item_qty;
      ELSIF item_price <= 499 THEN v_fee := v_fee + 10 * item_qty;
      ELSE v_fee := v_fee + 20 * item_qty; END IF;
    ELSE
      IF item_price <= 250 THEN v_fee := v_fee + 0;
      ELSIF item_price <= 499 THEN v_fee := v_fee + 6 * item_qty;
      ELSE v_fee := v_fee + 12 * item_qty; END IF;
    END IF;
  END LOOP;

  UPDATE public.tokens SET status = 'used' WHERE id = p_token;
  UPDATE public.profiles SET no_show_count = 0, free_tokens_disabled_until = NULL WHERE id = token_customer;
  INSERT INTO public.bills (token, shop, items, total, fee)
  VALUES (p_token, token_shop, token_items, token_total, v_fee);
  IF v_fee > 0 THEN
    INSERT INTO public.wallet_ledger (shop, type, amount, note)
    VALUES (token_shop, 'fee', v_fee, 'Token fee');
    UPDATE public.shops SET wallet_balance = wallet_balance - v_fee WHERE id = token_shop;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decrement_festival_kits() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_token_pickup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_token_pickup(uuid) TO authenticated;
