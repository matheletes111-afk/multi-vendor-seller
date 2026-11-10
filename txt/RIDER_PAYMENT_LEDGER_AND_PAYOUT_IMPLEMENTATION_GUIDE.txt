================================================================================
MEEEM PLATFORM — RIDER PAYMENT LEDGER, WALLET & PAYOUT IMPLEMENTATION GUIDE
(WEB & MOBILE APIs — AFRIMONEY PREPAID VS COD DELIVERY SETTLEMENT & PAYOUTS)
================================================================================

Last Updated: November 2026
Target Audience: Frontend Web Developers, Mobile App (Flutter/React Native) Developers, Backend Engineers

--------------------------------------------------------------------------------
1. OVERVIEW & CORE FINANCIAL ARCHITECTURE
--------------------------------------------------------------------------------
The Rider Payment Ledger tracks every delivery completed by a rider across
two distinct payment channels:
1. AFRIMONEY (Prepaid Online):
   - The customer already paid the platform online (Items Subtotal + Delivery Fee).
   - When the rider completes the delivery (verifies Customer Delivery OTP -> `status: "DELIVERED"`),
     the platform owes the rider their `deliveryFee`.
   - `Rider.netBalance` is INCREMENTED by `deliveryFee`.
   - `RiderDeliveryAssignment.settlementStatus` transitions from `PENDING` -> `YET_TO_PAY`.
   - A `RiderBalanceTransaction` ledger entry is created with:
     `kind = "CREDIT"`, `reason = "DELIVERY_FULFILLED"`, `amount = deliveryFee`.

2. CASH ON DELIVERY (COD):
   - The customer pays cash at the doorstep to the rider (`codAmountCollected = itemsSubtotal + deliveryFee`).
   - Because the rider collects the cash directly at the doorstep (including their own delivery fee),
     the platform does NOT owe the rider a wallet payout for this delivery (`Rider.netBalance` is NOT incremented).
   - `RiderDeliveryAssignment.settlementStatus` transitions from `PENDING` -> `COD_COLLECTED_BY_RIDER`.
   - A `RiderBalanceTransaction` ledger entry is still recorded for full revenue & audit visibility with:
     `kind = "CREDIT"`, `reason = "COD_DELIVERY_COLLECTED"`, `amount = deliveryFee`.

3. ADMIN PAYOUT DISBURSEMENT:
   - Riders can request a payout of their `netBalance` (or Admin can directly disburse from Central Admin Payouts).
   - Upon disbursement:
     - `Rider.netBalance` is DECREMENTED by the disbursed amount.
     - All `YET_TO_PAY` delivery assignments for that rider are marked `PAID_OUT` with `payoutReference`,
       `payoutMethod`, `payoutAccountSnapshot`, `payoutDisbursedAt`, and `payoutNote`.
     - A `RiderBalanceTransaction` ledger entry is created with:
       `kind = "DEBIT"`, `reason = "PAYOUT_DISBURSED"`, `amount = disbursedAmount`.

--------------------------------------------------------------------------------
2. DATABASE SCHEMA REFERENCE (PRISMA)
--------------------------------------------------------------------------------

A. `Rider` Model (Wallet & Payout Account Fields):
   - `netBalance`: Decimal(12, 2) @default(0.00)
     -> Withdrawable wallet balance owed by the platform for prepaid (AfriMoney) deliveries.
   - `paymentOption`: String?
   - `preferredPayoutMethod`: String?
   - `bankName`: String?
   - `accountHolderName`: String?
   - `accountNumber`: String?
   - `mobileNumber`: String?
   - `mobileMoneyOption`: String?

B. `RiderDeliveryAssignment` Model (Per-Delivery Settlement Fields):
   - `id`: String
   - `orderId`: String
   - `sellerId`: String?
   - `orderItemId`: String?
   - `riderId`: String
   - `status`: DeliveryAssignmentStatus (`OFFERED` | `ACCEPTED` | `AT_PICKUP` | `PICKED_UP` | `OUT_FOR_DELIVERY` | `DELIVERED` | `CANCELLED_BY_RIDER` | `REJECTED` | `TIMED_OUT`)
   - `deliveryFee`: Decimal(12, 2)?
   - `codAmountCollected`: Decimal(12, 2)?
   - `settlementStatus`: String @default("PENDING")
     -> Values:
        * `PENDING`: Delivery not yet completed.
        * `YET_TO_PAY`: AfriMoney prepaid delivery completed; platform owes rider `deliveryFee`.
        * `PAID_OUT`: Admin has disbursed the prepaid `deliveryFee` to the rider.
        * `COD_COLLECTED_BY_RIDER`: COD delivery completed; rider collected cash on doorstep.
   - `payoutRequestedAt`: DateTime?
   - `payoutDisbursedAt`: DateTime?
   - `payoutReference`: String?
   - `payoutMethod`: String?
   - `payoutAccountSnapshot`: String?
   - `payoutNote`: String?

C. `RiderBalanceTransaction` Model (Immutable Ledger Audit Trail):
   - `id`: String
   - `riderId`: String
   - `assignmentId`: String?
   - `orderId`: String?
   - `amount`: Decimal(12, 2)
   - `kind`: String (`CREDIT` | `DEBIT`)
   - `reason`: String
     -> Values:
        * `DELIVERY_FULFILLED`: Prepaid (AfriMoney) delivery completed (+ adds to `netBalance`).
        * `COD_DELIVERY_COLLECTED`: COD delivery completed (tracked in ledger; 0 change to `netBalance`).
        * `PAYOUT_DISBURSED`: Admin paid out wallet balance to rider (- deducts from `netBalance`).
   - `note`: String?
   - `createdAt`: DateTime

--------------------------------------------------------------------------------
3. DELIVERY COMPLETION HOOK (HOW EARNINGS ARE CREDITED)
--------------------------------------------------------------------------------
Core File: `src/lib/delivery-dispatch.ts` -> `handleRiderStatusUpdate()`

Endpoints that trigger delivery completion:
- Web API:    `POST /api/riderapp/orders/[id]/status`
- Mobile API: `POST /mobileapi/rider/orders/[id]/status` (supports both `application/json` and `multipart/form-data`)

Request Payload to Complete Delivery:
```json
{
  "status": "DELIVERED",
  "otp": "123456",
  "proofImage": "data:image/jpeg;base64,..."
}
```
What happens atomically inside `prisma.$transaction` when `status === "DELIVERED"`:
1. Verifies the Customer Delivery OTP (`options.otp.trim() === assignment.deliveryOtp.trim()`).
2. Updates `RiderDeliveryAssignment`:
   - `status = "DELIVERED"`
   - `deliveredAt = new Date()`
   - `deliveryFee = deliveryFee`
   - `settlementStatus = isPrepaid ? "YET_TO_PAY" : "COD_COLLECTED_BY_RIDER"`
   - `codAmountCollected = isPrepaid ? null : (itemsSubtotalSum + deliveryFee)`
3. Idempotency check (`tx.riderBalanceTransaction.findFirst({ where: { assignmentId: assignment.id } })`):
   - If `isPrepaid` (`order.paymentMethod === "AFRIMONEY"`):
     * Increments `Rider.netBalance` by `deliveryFee`.
     * Creates `RiderBalanceTransaction` (`kind: "CREDIT"`, `reason: "DELIVERY_FULFILLED"`).
   - If `COD` (`order.paymentMethod !== "AFRIMONEY"`):
     * Creates `RiderBalanceTransaction` (`kind: "CREDIT"`, `reason: "COD_DELIVERY_COLLECTED"`).
     * `Rider.netBalance` is NOT incremented (0 platform payout liability).
4. Settles Seller Net Earnings for each delivered order line via `applySellerCreditForOrderLineDelivered(tx, line.id)`.
5. If all items in the parent `Order` are delivered/closed, updates parent `Order.status = "DELIVERED"` and `Order.paymentStatus = "COMPLETED"`.

--------------------------------------------------------------------------------
4. RIDER REVENUE & SETTLEMENT SUMMARY API (WEB & MOBILE)
--------------------------------------------------------------------------------
Endpoints:
- Web API:    `GET /api/riderapp/revenue`
- Mobile API: `GET /mobileapi/rider/revenue`

Supported Query Parameters (Optional):
- `status`: `all` (default) | `delivered` | `inprogress`
- `period`: `all` (default) | `today` | `week` | `month`
- `search`: Search by Order Number, Customer Name, or Seller Store Name

Authentication:
- Web: Session cookie (`next-auth`) with `role === "RIDER"`
- Mobile: `Authorization: Bearer <rider_jwt_token>`

Note on Wrapper Structure:
- Web (`GET /api/riderapp/revenue`) returns `{ success: true, summary, recentTransactions, riderBankDetails, filters, count, deliveries }` at the top level.
- Mobile (`GET /mobileapi/rider/revenue`) wraps the payload inside `data`: `{ success: true, data: { summary, riderBankDetails, filters, count, deliveries } }`.

Response Structure (`200 OK`):
```json
{
  "success": true,
  "data": {
    "summary": {
      "netBalance": 450.00,
      "availablePayoutBalance": 450.00,
      "totalDeliveredRevenue": 1200.00,
      "prepaidDeliveredRevenue": 750.00,
      "codDeliveredRevenue": 450.00,
      "codCashCollectedTotal": 6850.00,
      "pendingInProgressRevenue": 200.00,
      "deliveredCount": 12,
      "inProgressCount": 2,
      "totalDeliveriesCount": 14,
      "currency": "NLe",
      "hasPendingPayoutRequest": false,
      "pendingPayoutRequest": null
    },
    "riderBankDetails": {
      "paymentOption": "Mobile Money",
      "preferredPayoutMethod": "AfriMoney",
      "bankName": null,
      "accountHolderName": "John Kamara",
      "accountNumber": null,
      "mobileNumber": "077123456",
      "mobileMoneyOption": "AfriMoney"
    },
    "filters": {
      "status": "all",
      "period": "all",
      "search": ""
    },
    "count": 1,
    "deliveries": [
      {
        "id": "assign-uuid-1",
        "assignmentId": "assign-uuid-1",
        "orderId": "ord-uuid-1",
        "orderNumber": "ORD-20261110-001",
        "status": "DELIVERED",
        "statusCategory": "DELIVERED",
        "isDelivered": true,
        "paymentMethod": "AFRIMONEY",
        "settlementStatus": "YET_TO_PAY",
        "codAmountCollected": null,
        "payoutDisbursedAt": null,
        "payoutReference": null,
        "payoutMethod": null,
        "offeredAt": "2026-11-10T13:40:00.000Z",
        "acceptedAt": "2026-11-10T13:41:00.000Z",
        "pickedUpAt": "2026-11-10T13:55:00.000Z",
        "deliveredAt": "2026-11-10T14:22:00.000Z",
        "deliveryOtp": "482910",
        "deliveryProofImage": "https://...",
        "distanceKm": 4.2,
        "deliveryCharge": 75.00,
        "totalAmount": 75.00,
        "store": {
          "id": "seller-uuid-1",
          "name": "Freetown Electronics",
          "phone": "+23277000111",
          "address": "14 Wilkinson Road, Freetown"
        },
        "customer": {
          "id": "cust-uuid-1",
          "name": "Mariama Sesay",
          "phone": "+23277123456",
          "dropAddress": "22 Lumley Beach Road, Freetown"
        },
        "items": [
          {
            "id": "item-uuid-1",
            "productId": "prod-uuid-1",
            "name": "Wireless Headphones",
            "variantName": "Black",
            "quantity": 1,
            "price": 750,
            "shippingAmount": 75,
            "image": "https://..."
          }
        ],
        "totalItemsCount": 1
      }
    ]
  }
}
```

Key Field Definitions for Frontend / Mobile UI:
- `summary.netBalance` / `summary.availablePayoutBalance`: Amount rider can withdraw right now (from AfriMoney deliveries).
- `summary.totalDeliveredRevenue`: Total delivery fees earned across ALL completed deliveries (`prepaidDeliveredRevenue + codDeliveredRevenue`).
- `summary.prepaidDeliveredRevenue`: Delivery fees earned from AfriMoney orders.
- `summary.codDeliveredRevenue`: Delivery fees earned from COD orders (already collected in cash by rider).
- `summary.codCashCollectedTotal`: Total cash (Items + Delivery Fee) collected by rider from customers on COD orders.

--------------------------------------------------------------------------------
5. RIDER BALANCE TRANSACTIONS LEDGER API (WEB & MOBILE)
--------------------------------------------------------------------------------
Endpoints:
- Web API:    `GET /api/riderapp/balance-transactions`
- Mobile API: `GET /mobileapi/rider/balance-transactions`

Response Structure (`200 OK`):
```json
{
  "success": true,
  "data": {
    "netBalance": 450.00,
    "balanceCreditsTotal": 1200.00,
    "balanceDebitsTotal": 300.00,
    "transactions": [
      {
        "id": "tx-uuid-1",
        "amount": 75.00,
        "kind": "CREDIT",
        "reason": "DELIVERY_FULFILLED",
        "note": "Prepaid AfriMoney delivery fee credited for Order #ORD-20261110-001",
        "createdAt": "2026-11-10T14:22:00.000Z",
        "orderId": "ord-uuid-1",
        "orderNumber": "ORD-20261110-001",
        "paymentMethod": "AFRIMONEY",
        "settlementStatus": "YET_TO_PAY"
      },
      {
        "id": "tx-uuid-2",
        "amount": 50.00,
        "kind": "CREDIT",
        "reason": "COD_DELIVERY_COLLECTED",
        "note": "COD delivery completed. Delivery fee SLE 50.00 collected in cash from customer for Order #ORD-20261110-002 (Cash in Hand)",
        "createdAt": "2026-11-10T12:10:00.000Z",
        "orderId": "ord-uuid-2",
        "orderNumber": "ORD-20261110-002",
        "paymentMethod": "COD",
        "settlementStatus": "COD_COLLECTED_BY_RIDER"
      },
      {
        "id": "tx-uuid-3",
        "amount": 300.00,
        "kind": "DEBIT",
        "reason": "PAYOUT_DISBURSED",
        "note": "Disbursed SLE 300.00 via AfriMoney. Ref: AFRI-PAY-99881",
        "createdAt": "2026-11-09T17:00:00.000Z",
        "orderId": null,
        "orderNumber": null,
        "paymentMethod": null,
        "settlementStatus": null
      }
    ]
  }
}
```

--------------------------------------------------------------------------------
6. RIDER PAYOUT REQUESTS API (WEB & MOBILE)
--------------------------------------------------------------------------------
Riders can submit a withdrawal request for their available `netBalance` and view
their historical payout requests. Internally, rider payout requests use the
unified `SellerPayoutRequest` table with `sellerSector = "RIDER"` and `sellerId = rider.id`
via `src/lib/seller-payout-service.ts`.

Endpoints:
- Web API:
  * `GET  /api/riderapp/payout-requests`
  * `POST /api/riderapp/payout-requests`
- Mobile API:
  * `GET  /mobileapi/rider/payout-requests`
  * `POST /mobileapi/rider/payout-requests`

A. `GET` Response Structure (`200 OK`):
```json
{
  "success": true,
  "netBalance": 450.00,
  "payoutMethod": "AfriMoney",
  "payoutAccountSnapshot": "Method: Mobile Money • Holder: John Kamara • Mobile: 077123456 • Wallet: AfriMoney",
  "pendingRequest": null,
  "history": [
    {
      "id": "req-uuid-1",
      "sellerSector": "RIDER",
      "sellerId": "rider-uuid-1",
      "requestedAmount": 300.00,
      "status": "DISBURSED",
      "sellerNote": "Weekly delivery fee withdrawal",
      "payoutMethod": "AfriMoney",
      "payoutAccountSnapshot": "Method: Mobile Money • Holder: John Kamara • Mobile: 077123456 • Wallet: AfriMoney",
      "payoutReference": "AFRI-PAY-99881",
      "adminNote": "Sent to AfriMoney 077123456",
      "requestedAt": "2026-11-09T15:00:00.000Z",
      "disbursedAt": "2026-11-09T17:00:00.000Z"
    }
  ]
}
```

B. `POST` Request Body (Submit Payout Request):
```json
{
  "sellerNote": "Please send to my AfriMoney wallet 077123456"
}
```
`POST` Response (`200 OK`):
```json
{
  "success": true,
  "payoutRequest": {
    "id": "req-uuid-2",
    "sellerSector": "RIDER",
    "sellerId": "rider-uuid-1",
    "requestedAmount": 450.00,
    "status": "PENDING",
    "sellerNote": "Please send to my AfriMoney wallet 077123456",
    "payoutMethod": "AfriMoney",
    "payoutAccountSnapshot": "Method: Mobile Money • Holder: John Kamara • Mobile: 077123456 • Wallet: AfriMoney",
    "requestedAt": "2026-11-10T16:30:00.000Z"
  }
}
```
Validation Rules on `POST`:
1. Rider must have `netBalance > 0`. If `netBalance <= 0`, returns `400 Bad Request`
   (`"Insufficient balance. Your current net balance must be greater than SLE 0.00."`).
2. Rider cannot have an existing `PENDING` payout request. If one exists, returns `400 Bad Request`
   (`"A payout request is already pending disbursement by Admin."`).
3. Marks all current `YET_TO_PAY` `RiderDeliveryAssignment` rows for this rider with `payoutRequestedAt = new Date()`.

--------------------------------------------------------------------------------
7. ADMIN CENTRAL PAYOUTS & RIDER DISBURSEMENT (WEB & ADMIN API)
--------------------------------------------------------------------------------
Admin manages all Seller and Rider payouts from a single unified console:
- Admin UI Page: `/admin/payouts` (`src/app/admin/payouts/page.tsx`)
- Admin GET API: `GET /api/admin/payouts`
- Admin POST Disburse API: `POST /api/admin/payouts/disburse`

How Admin Disburses a Rider Payout (`POST /api/admin/payouts/disburse`):
Request Body:
```json
{
  "payoutRequestId": "req-uuid-2",
  "sellerSector": "RIDER",
  "sellerId": "rider-uuid-1",
  "amount": 450.00,
  "payoutMethod": "AfriMoney",
  "payoutAccountSnapshot": "Method: Mobile Money • Holder: John Kamara • Mobile: 077123456 • Wallet: AfriMoney",
  "payoutReference": "AFRI-TXN-884920",
  "adminNote": "Disbursed prepaid delivery fees for week 45"
}
```
What happens atomically inside `prisma.$transaction` when Admin disburses to `sellerSector: "RIDER"`:
1. Verifies `Rider.netBalance >= disburseAmount`.
2. Decrements `Rider.netBalance` by `disburseAmount`.
3. Creates a `RiderBalanceTransaction` row:
   - `kind = "DEBIT"`
   - `reason = "PAYOUT_DISBURSED"`
   - `amount = disburseAmount`
   - `note = "Disbursed SLE 450.00 via AfriMoney. Ref: AFRI-TXN-884920 | Note: ..."`
4. Updates all `RiderDeliveryAssignment` rows for that rider where `settlementStatus === "YET_TO_PAY"`:
   - `settlementStatus = "PAID_OUT"`
   - `payoutDisbursedAt = new Date()`
   - `payoutReference = "AFRI-TXN-884920"`
   - `payoutMethod = "AfriMoney"`
   - `payoutAccountSnapshot = ...`
   - `payoutNote = ...`
5. Updates the matching `SellerPayoutRequest` (`sellerSector: "RIDER"`) to `status = "DISBURSED"`, recording `disbursedAt` and `disbursedByAdminId`.

--------------------------------------------------------------------------------
8. WEB & MOBILE UI IMPLEMENTATION CHECKLIST FOR RIDER APP
--------------------------------------------------------------------------------
1. Rider Revenue & Wallet Screen (`/riderapp/revenue` on Web, Rider Earnings screen on Mobile):
   - Display 4 top-level KPI cards:
     a) **Withdrawable Wallet (`summary.netBalance`)**: Prepaid (AfriMoney) delivery fees ready for payout, with a "Request Payout" CTA button.
     b) **Total Delivery Earnings (`summary.totalDeliveredRevenue`)**: Combined AfriMoney + COD delivery fees earned.
     c) **Prepaid (AfriMoney) Earnings (`summary.prepaidDeliveredRevenue`)**: Credited to Rider Wallet for Admin payout.
     d) **COD Earnings & Cash Collected (`summary.codDeliveredRevenue` / `summary.codCashCollectedTotal`)**: Clearly labeled as "Collected in Cash at Doorstep".
2. Tabs / Sections for Complete Transparency:
   - **Delivery Settlement Breakdown** (`deliveries` array from `/revenue`):
     Show Order #, Customer, Store, Payment Method badge (`AFRIMONEY` vs `COD`), Delivery Fee (`deliveryCharge`), COD Cash Collected (`codAmountCollected`), and Settlement Status badge (`YET_TO_PAY`, `PAID_OUT`, `COD_COLLECTED_BY_RIDER`).
   - **Balance Ledger (`transactions` array from `/balance-transactions`)**:
     Show chronological `CREDIT` (`DELIVERY_FULFILLED`, `COD_DELIVERY_COLLECTED`) and `DEBIT` (`PAYOUT_DISBURSED`) ledger rows.
   - **Payout Requests (`history` array from `/payout-requests`)**:
     Show status (`PENDING`, `DISBURSED`), `requestedAmount`, `payoutMethod`, `payoutReference`, and timestamps.
3. Payout Request Button State:
   - Disable "Request Payout" if `netBalance <= 0` or `hasPendingPayoutRequest === true`.
   - When `hasPendingPayoutRequest === true`, display an amber banner showing the pending request amount and date.

--------------------------------------------------------------------------------
9. KEY SOURCE FILES REFERENCE
--------------------------------------------------------------------------------
- `prisma/schema.prisma` (`Rider`, `RiderDeliveryAssignment`, `RiderBalanceTransaction`, `SellerPayoutRequest`)
- `src/lib/delivery-dispatch.ts` (`handleRiderStatusUpdate` — Delivery OTP verification & atomic AfriMoney/COD rider + seller settlement)
- `src/lib/seller-payout-service.ts` (`requestSellerPayout`, `getSellerPayoutStatus` supporting `RIDER` sector)
- `src/app/api/riderapp/revenue/route.ts` (Web Rider Revenue & Deliveries API)
- `src/app/api/riderapp/balance-transactions/route.ts` (Web Rider Balance Ledger API)
- `src/app/api/riderapp/payout-requests/route.ts` (Web Rider Payout Requests API)
- `src/app/mobileapi/rider/revenue/route.ts` (Mobile Rider Revenue & Deliveries API)
- `src/app/mobileapi/rider/balance-transactions/route.ts` (Mobile Rider Balance Ledger API)
- `src/app/mobileapi/rider/payout-requests/route.ts` (Mobile Rider Payout Requests API)
- `src/app/riderapp/revenue/page.tsx` (Rider Web Revenue, Ledger & Payout UI)
- `src/app/api/admin/payouts/route.ts` (Admin Central Payouts Overview API — includes `RIDER`)
- `src/app/api/admin/payouts/disburse/route.ts` (Admin Central Disbursement API — includes `RIDER`)
- `src/app/admin/payouts/page.tsx` (Admin Central Payouts Console UI — includes `RIDER` filter & table)
================================================================================
