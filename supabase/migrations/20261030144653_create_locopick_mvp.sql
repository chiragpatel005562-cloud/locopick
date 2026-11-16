/*
# Create LocoPick MVP schema and Nandurbar demo catalog

1. New tables
- `profiles`: signed-in user name and role (customer or merchant).
- `shops`: local shop details, ownership, distance, and ranking signals.
- `products`: searchable catalog items and size support.
- `offers`: shop-specific prices and stock JSON.
- `requests`: customer stock-hold requests and their lifecycle.
- `tokens`: single-use reservation tokens with OTP and expiry.
- `orders`: delivery orders and status.
- `bills`: completed in-store token bills.
- `wallet_ledger`: merchant prepaid wallet activity.
- `waitlist`: customer notifications for unavailable products.
- `returns`: delivery return or exchange requests.
- `scan_reports`: customer reports for refused scans.

2. Security
- Row-level security is enabled on every table.
- Public catalog rows are readable by signed-in users.
- Customers can access their own activity; merchants can access requests, tokens, bills, and wallet rows for shops they own.
- Grants are limited to the authenticated role.

3. Important notes
- Authenticated email/password accounts are used; profiles are created automatically after signup.
- Nandurbar seed data is intentionally shared catalog data for the demo.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer','merchant')) DEFAULT 'customer',
  name text NOT NULL DEFAULT 'LocoPick member',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  distance_km numeric NOT NULL DEFAULT 1,
  subscribed boolean NOT NULL DEFAULT false,
  token_volume integer NOT NULL DEFAULT 0,
  wallet_balance numeric NOT NULL DEFAULT 500,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  has_sizes boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price numeric NOT NULL,
  mrp numeric,
  stock jsonb NOT NULL DEFAULT '{"quantity": 0}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop, product)
);

CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  shop uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  items jsonb NOT NULL,
  total numeric NOT NULL,
  bulk boolean NOT NULL DEFAULT false,
  multi boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','held','rejected','expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request uuid REFERENCES requests(id) ON DELETE SET NULL,
  customer uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  shop uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  items jsonb NOT NULL,
  total numeric NOT NULL,
  otp text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','cancelled','expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  shop uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  items jsonb NOT NULL,
  total numeric NOT NULL,
  delivery_fee numeric NOT NULL,
  status text NOT NULL DEFAULT 'placed' CHECK (status IN ('placed','confirmed','out_for_delivery','delivered','returned')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  shop uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  items jsonb NOT NULL,
  total numeric NOT NULL,
  fee numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('topup','fee')),
  amount numeric NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer, product)
);

CREATE TABLE IF NOT EXISTS returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scan_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  customer uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

INSERT INTO products (slug, name, category, has_sizes) VALUES
('cotton-blue-kurti','Cotton Blue Kurti','Fashion',true),
('chikankari-white-kurti','Chikankari White Kurti','Fashion',true),
('cotton-dupatta-mustard','Cotton Dupatta','Fashion',false),
('led-diya-lights-12','LED Diya Lights 12','Decor',false),
('pipe-cleaner-flower-kit','Pipe Cleaner Flower Kit','Crafts',false),
('kanya-pujan-kit-basic','Kanya Pujan Kit Basic','Festival kits',false),
('kanya-pujan-kit-pro','Kanya Pujan Kit Pro','Festival kits',false),
('steel-katori-set','Steel Katori Set','Essentials',false)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO shops (name, slug, distance_km, subscribed, token_volume) VALUES
('Sharma Fashion','sharma-fashion',0.8,true,42),
('Verma Boutique','verma-boutique',1.2,false,80),
('Patel Garments','patel-garments',2.4,false,36),
('Patel Decor','patel-decor',1.9,false,70),
('Gupta Crafts','gupta-crafts',0.6,false,28),
('Joshi Stores','joshi-stores',0.9,false,52),
('Raj Textiles','raj-textiles',6.5,false,18),
('Shahada Cloth House','shahada-cloth-house',12,false,12)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO offers (shop, product, price, mrp, stock)
SELECT s.id, p.id, v.price, v.mrp, v.stock::jsonb
FROM (VALUES
('sharma-fashion','cotton-blue-kurti',449,599,'{"S":4,"M":2,"L":3}'),('verma-boutique','cotton-blue-kurti',459,599,'{"S":2,"M":4,"L":1}'),('patel-garments','cotton-blue-kurti',479,650,'{"S":1,"M":2,"L":2}'),('raj-textiles','cotton-blue-kurti',439,599,'{"S":3,"M":3,"L":3}'),('shahada-cloth-house','cotton-blue-kurti',429,599,'{"S":2,"M":1,"L":1}'),
('verma-boutique','chikankari-white-kurti',459,599,'{"S":2,"M":3,"L":2}'),('sharma-fashion','cotton-dupatta-mustard',299,399,'{"quantity":8}'),('patel-decor','led-diya-lights-12',349,449,'{"quantity":12}'),('gupta-crafts','pipe-cleaner-flower-kit',260,null,'{"quantity":9}'),('joshi-stores','kanya-pujan-kit-basic',299,null,'{"quantity":16}'),('joshi-stores','kanya-pujan-kit-pro',999,null,'{"quantity":7}'),('joshi-stores','steel-katori-set',225,null,'{"quantity":20}')
) AS v(shop_slug, product_slug, price, mrp, stock)
JOIN shops s ON s.slug = v.shop_slug JOIN products p ON p.slug = v.product_slug
ON CONFLICT (shop, product) DO NOTHING;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_reports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT ON shops, products, offers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON requests, tokens, orders, returns, waitlist, scan_reports TO authenticated;
GRANT SELECT, INSERT ON bills, wallet_ledger TO authenticated;

DROP POLICY IF EXISTS "own profile select" ON profiles; CREATE POLICY "own profile select" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "own profile update" ON profiles; CREATE POLICY "own profile update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "catalog shops read" ON shops; CREATE POLICY "catalog shops read" ON shops FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "catalog products read" ON products; CREATE POLICY "catalog products read" ON products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "catalog offers read" ON offers; CREATE POLICY "catalog offers read" ON offers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "customer requests read" ON requests; CREATE POLICY "customer requests read" ON requests FOR SELECT TO authenticated USING (customer = auth.uid() OR EXISTS (SELECT 1 FROM shops WHERE shops.id = requests.shop AND shops.owner = auth.uid()));
DROP POLICY IF EXISTS "customer requests insert" ON requests; CREATE POLICY "customer requests insert" ON requests FOR INSERT TO authenticated WITH CHECK (customer = auth.uid());
DROP POLICY IF EXISTS "request owner update" ON requests; CREATE POLICY "request owner update" ON requests FOR UPDATE TO authenticated USING (customer = auth.uid() OR EXISTS (SELECT 1 FROM shops WHERE shops.id = requests.shop AND shops.owner = auth.uid())) WITH CHECK (customer = auth.uid() OR EXISTS (SELECT 1 FROM shops WHERE shops.id = requests.shop AND shops.owner = auth.uid()));
DROP POLICY IF EXISTS "customer tokens read" ON tokens; CREATE POLICY "customer tokens read" ON tokens FOR SELECT TO authenticated USING (customer = auth.uid() OR EXISTS (SELECT 1 FROM shops WHERE shops.id = tokens.shop AND shops.owner = auth.uid()));
DROP POLICY IF EXISTS "customer tokens insert" ON tokens; CREATE POLICY "customer tokens insert" ON tokens FOR INSERT TO authenticated WITH CHECK (customer = auth.uid());
DROP POLICY IF EXISTS "token update" ON tokens; CREATE POLICY "token update" ON tokens FOR UPDATE TO authenticated USING (customer = auth.uid() OR EXISTS (SELECT 1 FROM shops WHERE shops.id = tokens.shop AND shops.owner = auth.uid())) WITH CHECK (customer = auth.uid() OR EXISTS (SELECT 1 FROM shops WHERE shops.id = tokens.shop AND shops.owner = auth.uid()));
DROP POLICY IF EXISTS "customer orders access" ON orders; CREATE POLICY "customer orders access" ON orders FOR SELECT TO authenticated USING (customer = auth.uid() OR EXISTS (SELECT 1 FROM shops WHERE shops.id = orders.shop AND shops.owner = auth.uid()));
DROP POLICY IF EXISTS "customer orders insert" ON orders; CREATE POLICY "customer orders insert" ON orders FOR INSERT TO authenticated WITH CHECK (customer = auth.uid());
DROP POLICY IF EXISTS "customer orders update" ON orders; CREATE POLICY "customer orders update" ON orders FOR UPDATE TO authenticated USING (customer = auth.uid() OR EXISTS (SELECT 1 FROM shops WHERE shops.id = orders.shop AND shops.owner = auth.uid())) WITH CHECK (customer = auth.uid() OR EXISTS (SELECT 1 FROM shops WHERE shops.id = orders.shop AND shops.owner = auth.uid()));
DROP POLICY IF EXISTS "merchant bills access" ON bills; CREATE POLICY "merchant bills access" ON bills FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = bills.shop AND shops.owner = auth.uid()));
DROP POLICY IF EXISTS "merchant bills insert" ON bills; CREATE POLICY "merchant bills insert" ON bills FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM shops WHERE shops.id = bills.shop AND shops.owner = auth.uid()));
DROP POLICY IF EXISTS "merchant wallet access" ON wallet_ledger; CREATE POLICY "merchant wallet access" ON wallet_ledger FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = wallet_ledger.shop AND shops.owner = auth.uid()));
DROP POLICY IF EXISTS "merchant wallet insert" ON wallet_ledger; CREATE POLICY "merchant wallet insert" ON wallet_ledger FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM shops WHERE shops.id = wallet_ledger.shop AND shops.owner = auth.uid()));
DROP POLICY IF EXISTS "own waitlist" ON waitlist; CREATE POLICY "own waitlist" ON waitlist FOR SELECT TO authenticated USING (customer = auth.uid());
DROP POLICY IF EXISTS "own waitlist insert" ON waitlist; CREATE POLICY "own waitlist insert" ON waitlist FOR INSERT TO authenticated WITH CHECK (customer = auth.uid());
DROP POLICY IF EXISTS "own returns access" ON returns; CREATE POLICY "own returns access" ON returns FOR SELECT TO authenticated USING (customer = auth.uid() OR EXISTS (SELECT 1 FROM orders JOIN shops ON shops.id = orders.shop WHERE orders.id = returns.order_id AND shops.owner = auth.uid()));
DROP POLICY IF EXISTS "own returns insert" ON returns; CREATE POLICY "own returns insert" ON returns FOR INSERT TO authenticated WITH CHECK (customer = auth.uid());
DROP POLICY IF EXISTS "own reports access" ON scan_reports; CREATE POLICY "own reports access" ON scan_reports FOR SELECT TO authenticated USING (customer = auth.uid());
DROP POLICY IF EXISTS "own reports insert" ON scan_reports; CREATE POLICY "own reports insert" ON scan_reports FOR INSERT TO authenticated WITH CHECK (customer = auth.uid());