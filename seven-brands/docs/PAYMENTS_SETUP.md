# Payments setup (test mode)

The code supports **Lemon Squeezy** and **Paddle Billing**, both as Merchant of Record (they sell to the customer, collect sales tax/VAT and pay you out). Everything stays in **test mode / sandbox** until you decide otherwise: live credentials are refused unless `COMMERCE_LIVE_PAYMENTS=enabled` is set.

Only one provider takes new checkouts at a time (`COMMERCE_PROVIDER`), but every configured provider keeps accepting webhooks, so refunds of older orders still work after a switch.

Nothing below has been run against a real account yet: no accounts exist. The adapters follow the request and webhook formats of each provider's official SDK and are covered by tests; the first real sandbox purchase is the remaining check.

## What you need first

- A public HTTPS address for the storefront (a staging deploy or a tunnel such as `cloudflared`), because providers must reach `/api/webhooks/<provider>`.
- The storefront domain added to the brand in admin → Brands.

## Lemon Squeezy (test mode)

1. Create an account and a store. Leave **Test mode** on (toggle at the bottom-left of the dashboard).
2. Create one product, e.g. "Digital asset", with one variant at any price. Our checkout overrides the price per purchase (`custom_price`), and the name shown to the buyer comes from our catalog.
3. Settings → API: create an API key **in test mode**.
4. Settings → Webhooks: add `https://<storefront domain>/api/webhooks/lemonsqueezy`, choose a signing secret (at least 16 characters), and select the events **order_created** and **order_refunded**.
5. Find the store id and variant id (Settings → Stores, and the variant's page or the API).
6. Set:
   ```
   COMMERCE_PROVIDER=lemonsqueezy
   LEMONSQUEEZY_API_KEY=…
   LEMONSQUEEZY_STORE_ID=…
   LEMONSQUEEZY_VARIANT_ID=…
   LEMONSQUEEZY_WEBHOOK_SECRET=…
   LEMONSQUEEZY_TEST_MODE=true
   ```
7. Buy something on the storefront with a test card (Lemon Squeezy lists test cards in its docs), then check admin → Revenue → Recent webhooks shows `fulfilled`, and admin → Orders shows a test order.

Notes: Lemon Squeezy charges in the store's currency (USD by default). It does not report its fee on the order, so fees aren't booked automatically.

## Paddle Billing (sandbox)

1. Create a **sandbox** account at sandbox-vendors.paddle.com.
2. Catalog → Products: create one product, e.g. "Digital asset" (tax category: standard digital goods). Copy its id (`pro_…`). Our checkout attaches a one-off price to it per purchase.
3. Developer tools → Authentication: create an **API key** and a **client-side token** (`test_…`).
4. Checkout → Website approval: add the storefront domain. Checkout settings → default payment link: `https://<storefront domain>/checkout/paddle`. Paddle opens its checkout on that page.
5. Developer tools → Notifications: add `https://<storefront domain>/api/webhooks/paddle` with events **transaction.completed**, **adjustment.created** and **adjustment.updated**. Copy the secret key.
6. Set:
   ```
   COMMERCE_PROVIDER=paddle
   PADDLE_ENVIRONMENT=sandbox
   PADDLE_API_KEY=…
   PADDLE_PRODUCT_ID=pro_…
   PADDLE_WEBHOOK_SECRET=…
   PADDLE_CLIENT_TOKEN=test_…
   ```
7. Buy with a Paddle test card, then check Recent webhooks and Orders as above. Paddle reports its fee, which is booked under Expenses → payments for live USD orders.

Notes: Paddle reviews refunds before approving them; the order updates when the approval webhook arrives. The webhook clock tolerance is 60 seconds, so keep the server clock in sync.

## Refunds

Support (or anyone with `customer.write`) requests a refund on the order page; only an owner (`order.refund`) can approve it. Approval calls the provider; the order updates when the provider confirms. A full refund revokes the license and the download access. Refunds made directly in the provider dashboard are recorded too.

## Going live (owner decision, later)

1. Apply for live payments with your chosen provider (they need the live site, terms and a refund policy) and confirm Philippine payout options.
2. Get the license terms reviewed by a lawyer (they are marked as a draft, `2026-11-draft-1`).
3. Replace test credentials with live ones, set `COMMERCE_LIVE_PAYMENTS=enabled` and `DEPLOY_ENV=production`, and make a small real purchase and refund.
