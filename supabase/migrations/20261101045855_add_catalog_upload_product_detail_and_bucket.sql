/*
# Support catalog upload: product detail columns, catalog-images bucket, product insert access

1. Modified tables
- `products`: adds description, material, color, image_url, attributes (all nullable) so
  catalog-uploaded items can carry the details the AI-bill reader produces.

2. Storage
- Creates a public-read bucket `catalog-images` for product photos attached to
  catalog-uploaded items.

3. Security
- Grants INSERT on `products` to `authenticated` (everyone can already SELECT).
- Adds a merchant INSERT policy on products: any authenticated merchant can insert
  a product row (slug is unique, so duplicates are rejected by the constraint).
- Storage bucket policies allow authenticated uploads and public reads.
*/

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS attributes jsonb;

GRANT INSERT ON public.products TO authenticated;

DROP POLICY IF EXISTS "merchant products insert" ON public.products;
CREATE POLICY "merchant products insert" ON public.products
  FOR INSERT TO authenticated WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog-images', 'catalog-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "catalog images public read" ON storage.objects;
CREATE POLICY "catalog images public read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'catalog-images');

DROP POLICY IF EXISTS "catalog images authenticated upload" ON storage.objects;
CREATE POLICY "catalog images authenticated upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'catalog-images');
