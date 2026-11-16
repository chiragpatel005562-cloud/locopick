/*
# Move demo catalog to Pune and rename the shop

1. Modified data
- Updates every existing public table with a `city` column from `Nandurbar` to `Pune`.
- Renames `Shahada Cloth House` to `Hadapsar Cloth House`.
- Changes the shop slug from `shahada-cloth-house` to `hadapsar-cloth-house`.

2. Compatibility
- The city update discovers all current public tables that have a `city` column, including profiles, shops, and any future table already present when this migration runs.
- The shop update is safe to rerun and preserves the existing shop row and all related offers or activity.

3. Security
- No tables, columns, permissions, policies, or ownership rules are changed.

4. Important notes
- Distances, prices, inventory, and all other catalog rules remain unchanged.
*/

DO $$
DECLARE
  city_table record;
BEGIN
  FOR city_table IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'city'
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET city = $1 WHERE city = $2',
      city_table.table_schema,
      city_table.table_name
    ) USING 'Pune', 'Nandurbar';
  END LOOP;
END $$;

UPDATE public.shops
SET name = 'Hadapsar Cloth House', slug = 'hadapsar-cloth-house'
WHERE name = 'Shahada Cloth House' OR slug = 'shahada-cloth-house';