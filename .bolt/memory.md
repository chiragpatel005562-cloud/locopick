# Project memory

## Product intent & audience

- **LocoPick**: hyperlocal marketplace connecting customers with nearby local shops in their city.
- Two distinct user roles:
  - **Customer** (route prefix `/c`): browses shops/products, collects tokens, cart, checkout, orders, returns.
  - **Shopkeeper** (route prefix `/m`): receives requests, scans, radar (festival trend forecasting), wallet.
- Tagline: "Your City. Your Local Shops."
- Audience: Indian city shoppers and local shop owners (currency Rs, Indian festivals like Dhanteras/Diwali).

## Brand personality & voice

- Navy + orange brand colors: "Loco" navy, "Pick" orange in the wordmark.
- Friendly, local, community-oriented tone.
- Map-pin logo mark (drop-in animation metaphor).
- Demo-aware voice: transparently labels demo data ("Demo data") rather than presenting mock numbers as real.

## Visual design & UX direction

- **Navigation**: persistent bottom tab bar, never disappears. Single layout route renders tab bar once; page content scrolls above with bottom padding. Active tab tap scrolls to top. Scroll position preserved per tab. Sub-pages show back arrow; top-level tab pages do not.
- **Customer tabs**: Home, Tokens, Cart, Profile.
- **Shopkeeper tabs**: Requests, Scan, Radar, Wallet.
- **Auth flow**: splash → welcome (two role cards) → signup/login → role-routed home. Sign out → welcome. Demo sessions show chip on Profile.
- **Splash**: 2-second Framer Motion animation, once per session (sessionStorage). Respects `prefers-reduced-motion`.
- **Forms**: customer signup (name, phone, city, email, password); shopkeeper signup (owner name, shop name, category, phone, city, email, password; wallet init Rs 0).
- **Wallet**: balance, Top up, ledger only. No fee preview card.
- **Trend Radar**: festival forecast computes "in N days" from real current date; config: Dhanteras 6 Nov 2026, Diwali 8 Nov 2026. Search counts/waitlist labeled "Demo data."
- **Bulk cart**: 5+ items in a shop bucket → bulk request; customer sees 30-min countdown card on Tokens. Partial approval sheet: Continue with available / Swap items (search) / Try another shop (nearby shops holding full list). Expired window → suggest other shops.
- **Multi-shop route**: ≥2 active tokens → route card on Tokens, shops nearest-first, Google Maps link, estimated time = 3 min/km + 5 min/shop.
- **Notify me**: empty search → card writes to waitlist table. Shopkeeper "Mark in stock" → `notify_waitlist_for_offer` → in-app bell notification "<item> now available at <shop>".
- **Scan report**: Active token has "Shop refused to scan" → form → `scan_reports` row. Expired unscanned token with report ≠ no-show.
- **Reliability**: 3 consecutive no-shows → free tokens paused 24h, banner on Tokens + Profile. Successful pickup (`complete_token_pickup`) resets count. Profile shows reliability status.

## Decisions, constraints & rationale

- React Router with nested routes and real URLs — enables instant tab switching, scroll preservation, back-button correctness.
- Route guards prevent cross-role access.
- Role stored in `profiles.role`; email confirmation disabled.
- Framer Motion for splash (explicitly requested deviation from no-extra-packages).
- Fee preview only in Pricing, not Wallet.
- Minimal-edit discipline: no restyle of existing screens; additions only.
- Supabase RPCs used: `complete_token_pickup`, `expire_my_tokens`, `notify_waitlist_for_offer`.
- Bulk request carries `bulk = true` flag; 30-min approval window enforced client-side.

## Open questions & assumptions

- Assuming Supabase backend for auth/profiles, waitlist, scan_reports, reliability.
- Festival config hard-coded dates (2026); may need annual update mechanism.
- Ledger entry schema (fixed vs freeform) still undefined.
- `prefers-reduced-motion` handling for non-splash screens not yet defined.
- Bulk approval window expiry: client-side timer only or also server-enforced?