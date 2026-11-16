/*
# Add delivery checkout and return evidence support

1. Modified tables
- `orders`: adds delivery recipient fields, delivery address, pin code, and payment method.
- `returns`: allows token grievances without an order, records request kind, evidence path, and optional note.

2. New storage
- Creates the private `return-photos` bucket with a 5 MB limit for JPEG, PNG, and WebP evidence.
- Users may upload and read only files under their own user-id folder.

3. Security
- Existing authenticated row policies remain in place.
- Return evidence storage policies require the authenticated user's id to be the first path segment.
- No public bucket access is enabled.

4. Important notes
- Existing orders and returns remain valid through nullable additions.
- Existing status, distance, pricing, and ownership rules are unchanged.
*/

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_phone text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_pin text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE public.returns ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS token_id uuid REFERENCES public.tokens(id) ON DELETE CASCADE;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'return' CHECK (kind IN ('return', 'exchange', 'grievance'));
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS photo_path text;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS note text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('return-photos', 'return-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "return photos insert own folder" ON storage.objects;
CREATE POLICY "return photos insert own folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'return-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "return photos select own folder" ON storage.objects;
CREATE POLICY "return photos select own folder" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'return-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "return photos delete own folder" ON storage.objects;
CREATE POLICY "return photos delete own folder" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'return-photos' AND (storage.foldername(name))[1] = auth.uid()::text);