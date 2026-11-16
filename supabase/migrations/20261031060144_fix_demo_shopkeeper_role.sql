/*
# Fix demo shopkeeper role and shop ownership

1. Modified behavior
- New accounts using the demo shopkeeper email receive `profiles.role = 'merchant'`.
- The demo shopkeeper account claims the seeded Sharma Fashion shop.
- Existing demo shopkeeper sessions can safely claim the same role and shop through a protected RPC.

2. Security
- The claim function is SECURITY DEFINER, validates the authenticated user's email, uses a fixed shop slug, and is executable only by authenticated users.
- No customer account can claim the merchant role or Sharma Fashion through this function.

3. Important notes
- The operation is idempotent and does not delete or replace any records.
- Wallet balance remains controlled by the existing shop row and is not changed here.
*/

CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, role, name)
  VALUES (
    NEW.id,
    CASE WHEN NEW.email = 'demo-shop@locopick.app' THEN 'merchant' ELSE 'customer' END,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
  IF NEW.email = 'demo-shop@locopick.app' THEN
    UPDATE public.shops SET owner = NEW.id WHERE slug = 'sharma-fashion';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_demo_shopkeeper()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_email text;
BEGIN
  SELECT email INTO current_email FROM auth.users WHERE id = auth.uid();
  IF current_email IS DISTINCT FROM 'demo-shop@locopick.app' THEN
    RAISE EXCEPTION 'Not a demo shopkeeper account';
  END IF;
  UPDATE public.profiles SET role = 'merchant' WHERE id = auth.uid();
  UPDATE public.shops SET owner = auth.uid() WHERE slug = 'sharma-fashion';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_demo_shopkeeper() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_demo_shopkeeper() TO authenticated;