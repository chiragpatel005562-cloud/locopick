/*
# Add shopkeeper signup fields and ownership access

1. Modified table
- `shops`: add category, phone, and city so new shopkeeper accounts can create a complete shop profile.

2. Security
- Authenticated users may insert a shop only when they own it.
- Authenticated users may update their own shop profile.

3. Important notes
- Existing shops keep their current values through safe defaults.
- New shops start with a zero wallet balance from the existing default.
*/

ALTER TABLE shops ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT 'Nandurbar';

GRANT INSERT, UPDATE ON shops TO authenticated;
DROP POLICY IF EXISTS "own shop insert" ON shops;
CREATE POLICY "own shop insert" ON shops FOR INSERT TO authenticated WITH CHECK (owner = auth.uid());
DROP POLICY IF EXISTS "own shop update" ON shops;
CREATE POLICY "own shop update" ON shops FOR UPDATE TO authenticated USING (owner = auth.uid()) WITH CHECK (owner = auth.uid());