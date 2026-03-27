# Working flows — chat session completion log

This file summarizes features and flows tied to the recent implementation work (order cancellation rules, customer wallet UX/APIs, and related backend). Use it as a quick checklist when testing or onboarding.

---

## 1. No cancellation after any line is delivered

**Rule:** If **any** order line (product or service) has status `DELIVERED`, the order **must not** be cancellable (no bulk cancel to `CANCELLED`, no per-line cancel to `CANCELLED`) from **admin**, **product seller**, **service seller**, or **customer**.

**Server**

- Shared helper: `src/lib/order-cancel-guard.ts`
  - `getOrderHasDeliveredLine(prisma, orderId)` — `true` if any `OrderItem` for that order has `itemStatus === "DELIVERED"`.
  - `ORDER_CANCEL_BLOCKED_DELIVERED` — user-facing error string.
- **Admin** `PATCH /api/admin/orders/[id]`
  - Bulk update (no `itemId` / `itemIds`): blocks `CANCELLED` when any line delivered.
  - Per-item update: blocks `CANCELLED` when any line on the **order** is delivered (even if the selected line is still `PENDING`).
- **Product seller** `PATCH /api/product-seller/orders/[id]` — same block when setting `CANCELLED`.
- **Service seller** `PATCH /api/service-seller/orders/[id]` — same block when setting `CANCELLED`.
- **Customer** `POST /api/customer/orders/[id]/cancel`
  - Rejects if any item is `DELIVERED` (specific message), then still requires **all** items `PENDING` for a full cancel (existing behaviour).

**GET payloads (UI support)**

- `orderHasDeliveredLine: boolean` on order detail responses so sellers/admin can hide/disable cancel when another seller already delivered:
  - `GET /api/admin/orders/[id]`
  - `GET /api/product-seller/orders/[id]` (uses `getOrderHasDeliveredLine` on full order, not only this seller’s lines)
  - `GET /api/service-seller/orders/[id]` (same)

**UI**

- Admin, product-seller, and service-seller order detail clients: `CANCELLED` option disabled when `order.orderHasDeliveredLine`; submit handler shows the same error message if triggered anyway.

**How to test**

1. Create a multi-line order; mark **one** line `DELIVERED`; try to cancel another line or use admin bulk cancel → expect **400** with the delivered message.
2. All lines non-delivered, target line `PENDING` → cancel still subject to existing rules (e.g. seller only cancels own `PENDING` lines).

---

## 2. Customer wallet — list, sources, orders, details

**List — `/customer/wallet`**

- Data: `GET /api/customer/wallet` — balance + up to 100 transactions.
- Each row includes: amount, `reason`, `note`, dates, linked **order** (`orderId`, `orderNumber`), line label (`orderItemProductName`), `returnRequestId`, `resolutionType` (`REFUND` / `EXCHANGE`).
- UI shows:
  - **Source** column: short **Return** vs **Exchange** (from `reason` / `resolutionType`).
  - **Description**: human labels for `RETURN_REFUND` and `EXCHANGE_PRICE_DIFFERENCE`, plus optional **note** line.
  - **Order** link to `/customer/orders/[orderId]`.
  - **Details** link to `/customer/wallet/[transactionId]`.

**Detail — `/customer/wallet/[id]`**

- Data: `GET /api/customer/wallet/transactions/[id]` — one wallet transaction for the logged-in customer only.
- Shows: amount, date, `sourceLabel`, `note`, linked **order**, and when a return exists: resolution type, return/pickup/refund statuses, customer return reason, original line, replacement line (with order link when applicable).

**Backend credit types (reference)**

- `RETURN_REFUND` — wallet credit after pickup confirmation (`src/lib/return-refund-wallet.ts` pattern).
- `EXCHANGE_PRICE_DIFFERENCE` — cheaper replacement credit when replacement is delivered (`src/lib/exchange-completion.ts` pattern).

---

## 3. Related flows already in the codebase (not re-verified in this pass)

These were part of the broader product direction; files exist for wallet/seller mirroring and exchange completion. Re-run `npx prisma generate` and migrations if your local Prisma client is out of date before relying on seller balance APIs.

- Return refund → customer wallet + seller ledger patterns: see `src/lib/return-refund-wallet.ts`, `src/lib/seller-customer-wallet-mirror.ts`, `src/lib/exchange-completion.ts`.
- Longer written flow: `txt/order-flow-full.txt`.

---

## 4. Verification notes (this session)

- IDE **lints** on the touched wallet and order API/client files report **no issues**.
- **ESLint** via CLI failed with a project config error (`Converting circular structure to JSON` from `.eslintrc.json`) — environment/config issue, not specific to these files.
- **TypeScript** `tsc` may still report errors in other routes (e.g. product-seller balance) if Prisma schema and generated client are not in sync — fix with `npx prisma generate` after schema changes.

---

## 5. Quick file index (session-related)

| Area | Files |
|------|--------|
| Cancel guard | `src/lib/order-cancel-guard.ts` |
| Admin orders API | `src/app/api/admin/orders/[id]/route.ts`, `src/app/api/admin/orders/types.ts` |
| Product seller orders API | `src/app/api/product-seller/orders/[id]/route.ts`, types under `.../orders/types.ts` |
| Service seller orders API | `src/app/api/service-seller/orders/[id]/route.ts`, types under `.../orders/types.ts` |
| Customer cancel | `src/app/api/customer/orders/[id]/cancel/route.ts` |
| Order detail UIs | `src/app/admin/(dashboard)/orders/[id]/order-detail-client.tsx`, `src/app/product-seller/(dashboard)/orders/[id]/order-detail-client.tsx`, `src/app/service-seller/(dashboard)/orders/[id]/order-detail-client.tsx` |
| Wallet list API | `src/app/api/customer/wallet/route.ts` |
| Wallet transaction API | `src/app/api/customer/wallet/transactions/[id]/route.ts` |
| Wallet UI | `src/app/customer/(dashboard)/wallet/wallet-client.tsx`, `src/app/customer/(dashboard)/wallet/[id]/wallet-transaction-detail-client.tsx`, `src/app/customer/(dashboard)/wallet/[id]/page.tsx` |

---

*Last updated: session recap — working flows and verification notes.*
