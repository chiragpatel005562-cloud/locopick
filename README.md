# LocoPick

LocoPick is a mobile-first hyperlocal shopping app for Pune. Customers search real nearby stock by size and quantity, then reserve with a free token or book same-day delivery. Shopkeepers approve requests, verify one-time OTPs, generate bills, and manage a prepaid wallet.

## Demo flow

1. Choose **Try demo customer** on the welcome screen.
2. Search **Cotton Blue Kurti**, choose size **S**, tap **Buy now**, and place a **Reserve & Inspect** request.
3. Switch to **Try demo shopkeeper**, go to **Requests**, choose **Hold stock**, then open **Scan a token**.
4. Switch back to **Customer** and open **Tokens** to copy the six-digit OTP.
5. Switch to **Shopkeeper**, enter the OTP in **Scan**, and choose **Generate bill**.
6. Open **Wallet** to see the merchant balance and fee ledger.
7. Enter the same OTP again in **Scan** — it shows **Invalid token** (one-time use).

The two demo accounts use Supabase email/password authentication and the Pune catalog is seeded in the database.

## Real vs simulated

**Real:** accounts, database, stock filtering, tokens, billing, wallet, AI catalog reading.
**Simulated:** payments, delivery partners, maps, notifications.
