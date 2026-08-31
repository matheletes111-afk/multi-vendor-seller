================================================================================
MEEEM DELIVERY NETWORK — MOBILE APP API DOCUMENTATION (PART 3)
================================================================================
Title: Multi-Vendor Revenue Segregation, Rider Earnings & End-to-End Delivery Flow
Version: 1.2.0
Target Audience: Mobile App Developers (Flutter / Kotlin / Swift / React Native)
Scope: Rider Mobile App, Product Seller Mobile App, Customer Mobile App
Base URL (Rider): https://<domain>/mobileapi/rider
Base URL (Product Seller): https://<domain>/mobileapi/product-seller
Base URL (Customer): https://<domain>/mobileapi/customer
Authentication: Authorization: Bearer <accessToken>

--------------------------------------------------------------------------------
TABLE OF CONTENTS
--------------------------------------------------------------------------------
1. EXECUTIVE ARCHITECTURAL SUMMARY & WEB-MOBILE SYNC STATUS
2. REVENUE & FINANCIAL SEGREGATION ENGINE
   2.1 The Multi-Vendor Revenue Formula
   2.2 Concrete Financial Example Breakdown (NLe 100 Item)
   2.3 Multi-Category Comparison Table (Product vs Service vs Hotel vs Restaurant)
3. PRODUCT SELLER MOBILE APP IMPLEMENTATION
   3.1 Overview Dashboard API (`GET /mobileapi/product-seller/overview`)
   3.2 Order Details & Financial Breakdown API (`GET /mobileapi/product-seller/orders/:id`)
   3.3 Seller Balance Transactions & Ledger (`GET /mobileapi/product-seller/balance-transactions`)
   3.4 UI Implementation Guidelines for Product Seller App
4. RIDER MOBILE APP IMPLEMENTATION
   4.1 Rider Dashboard & Earnings API (`GET /mobileapi/rider/settings`)
   4.2 Orders List with Allocated Delivery Earnings (`GET /mobileapi/rider/orders`)
   4.3 Delivery Milestone Execution & OTP + Photo Proof (`POST /mobileapi/rider/orders/:id/status`)
   4.4 UI Implementation Guidelines for Rider App
5. CUSTOMER MOBILE APP IMPLEMENTATION
   5.1 Secure 6-Digit Delivery OTP Display
   5.2 Live Rider Proximity Tracking Map
   5.3 Visual Proof of Delivery Verification
6. COMPLETE END-TO-END DELIVERY & FINANCIAL LIFECYCLE (STEP-BY-STEP)
7. MOBILE DEVELOPER CHECKLIST (FLUTTER / KOTLIN / SWIFT)

================================================================================
1. EXECUTIVE ARCHITECTURAL SUMMARY & WEB-MOBILE SYNC STATUS
================================================================================
All web dashboards (Admin, Product Seller, Rider App) and backend REST APIs
(`/mobileapi/*`) are 100% synchronized with unified database state, shared
pricing models, real-time push events, and automatic financial settlement.

KEY SYNCHRONIZED CAPABILITIES:
✓ Product Seller revenue correctly segregates platform commission AND delivery
  boy fees for physical item deliveries.
✓ Service, Hotel, and Restaurant sellers have ONLY platform commission deducted
  (no delivery boy charge is deducted from their payout).
✓ Rider delivery fee earnings are explicitly calculated and tracked per order
  and as total accumulated lifetime earnings.
✓ Customer 6-digit OTP verification is mandatory for delivery completion.
✓ Visual Proof of Delivery photo upload is supported via Base64 data strings or
  HTTPS URLs and saved to permanent storage.
✓ Marking an order as DELIVERED by a rider automatically executes wallet
  settlement for the merchant.

================================================================================
2. REVENUE & FINANCIAL SEGREGATION ENGINE
================================================================================

--------------------------------------------------------------------------------
2.1 The Multi-Vendor Revenue Formula (Product Seller)
--------------------------------------------------------------------------------
For every physical product order delivered through the MEEEM platform:

  [Net Seller Revenue] = [Item Gross Value (incl. GST)] 
                       - [Platform Commission Amount] 
                       - [Delivery Boy Delivery Fee]

Where:
- [Item Gross Value]: Unit Price × Quantity (+ GST if applicable).
- [Platform Commission Amount]: (Item Gross Value + Delivery Fee) × (CommissionRate / 100).
- [Delivery Boy Delivery Fee]: The delivery charge allocated to this line item based
  on distance/weight/dimensions.
- [Delivery Boy Earning]: Equals the allocated Delivery Fee.

--------------------------------------------------------------------------------
2.2 Concrete Financial Example Breakdown (NLe 100 Product Item)
--------------------------------------------------------------------------------
Suppose:
- Product Item Price: NLe 100.00
- Platform Commission Rate: 10%
- Platform Commission Amount: NLe 10.00
- Delivery Boy Charge: NLe 20.00

Settlement Distribution:
┌──────────────────────────────┬─────────────┬─────────────────────────────────┐
│ Entity                       │ Amount      │ Note                            │
├──────────────────────────────┼─────────────┼─────────────────────────────────┤
│ Customer Payment             │ NLe 120.00   │ NLe 100 (Product) + NLe 20 (Ship) │
│ Platform Fee (Commission)    │ NLe 10.00    │ Retained by MEEEM platform      │
│ Delivery Boy (Rider) Earning │ NLe 20.00    │ Credited to Rider delivery fee  │
│ Product Seller Net Revenue   │ NLe 70.00    │ Credited to Seller Net Balance  │
└──────────────────────────────┴─────────────┴─────────────────────────────────┘

--------------------------------------------------------------------------------
2.3 Multi-Category Comparison Table
--------------------------------------------------------------------------------
┌───────────────────┬───────────────────┬──────────────────────────────────────┐
│ Category          │ Delivery Boy Fee? │ Seller Net Revenue Formula           │
├───────────────────┼───────────────────┼──────────────────────────────────────┤
│ Product Seller    │ YES (Deducted)    │ Gross Item - Commission - Delivery   │
│ Service Seller    │ NO (NLe 0.00)      │ Service Price - Commission           │
│ Hotel Seller      │ NO (NLe 0.00)      │ Room Total - Commission              │
│ Restaurant Seller │ NO (NLe 0.00)      │ Food Order Total - Commission        │
└───────────────────┴───────────────────┴──────────────────────────────────────┘

================================================================================
3. PRODUCT SELLER MOBILE APP IMPLEMENTATION
================================================================================

--------------------------------------------------------------------------------
3.1 Overview Dashboard API
--------------------------------------------------------------------------------
Endpoint: GET /mobileapi/product-seller/overview
Headers:
  Authorization: Bearer <accessToken>

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "commissionRate": 10.0,
    "isGlobalRate": true,
    "stats": {
      "commissionRate": 10.0,
      "isGlobalRate": true,
      "totalProducts": 42,
      "totalOrders": 128,
      "totalRevenue": 15400.00,
      "totalRevenueFormatted": "NLe 15,400.00",
      "grossSales": 15400.00,
      "grossSalesFormatted": "NLe 15,400.00",
      "platformCommission": 1540.00,
      "platformCommissionFormatted": "NLe 1,540.00",
      "deliveryBoyCharges": 3080.00,
      "deliveryBoyChargesFormatted": "NLe 3,080.00",
      "netEarnings": 10780.00,
      "netEarningsFormatted": "NLe 10,780.00",
      "netBalance": 10780.00,
      "netBalanceFormatted": "NLe 10,780.00",
      "balanceCreditsTotal": 10780.00,
      "balanceCreditsFormatted": "NLe 10,780.00",
      "balanceDebitsTotal": 0.00,
      "balanceDebitsFormatted": "NLe 0.00",
      "totalAdClicks": 350
    },
    "subscription": {
      "id": "cuid_sub_id",
      "status": "ACTIVE",
      "plan": { "displayName": "Standard Merchant" }
    }
  }
}

--------------------------------------------------------------------------------
3.2 Order Details & Financial Breakdown API
--------------------------------------------------------------------------------
Endpoint: GET /mobileapi/product-seller/orders/:id
Headers:
  Authorization: Bearer <accessToken>

SUCCESS RESPONSE (200 OK):
{
  "id": "cuid_order_id",
  "orderNumber": "meeem00000125",
  "status": "DELIVERED",
  "totalAmount": 120.00,
  "subtotal": 100.00,
  "tax": 0.00,
  "shipping": 20.00,
  "commission": 10.00,
  "commissionRate": 10.0,
  "paymentMethod": "COD",
  "paymentStatus": "COMPLETED",
  "items": [
    {
      "id": "cuid_item_id",
      "productId": "cuid_product_id",
      "productName": "Wireless Bluetooth Headphones",
      "quantity": 1,
      "price": 100.00,
      "subtotal": 100.00,
      "subtotalInclGst": 100.00,
      "hasGst": false,
      "gstAmount": 0.00,
      "shippingAmount": 20.00,
      "commissionAmount": 10.00,
      "commissionRateSnapshot": 10.0,
      "itemStatus": "DELIVERED",
      "deliveredAt": "2026-08-28T10:45:00.000Z",
      "deliveryProofImage": "https://.../delivery-proofs/proof-123.jpg",
      "sellerNetPayout": 70.00
    }
  ],
  "deliveryAssignments": [
    {
      "id": "cuid_assignment_id",
      "status": "DELIVERED",
      "dispatchMode": "AUTO_CASCADE",
      "rider": {
        "id": "cuid_rider_id",
        "vehicleNumber": "SL-3829-B",
        "user": {
          "name": "Ibrahim Koroma",
          "phone": "76123456",
          "image": "https://.../rider-pfp.jpg"
        }
      }
    }
  ]
}

--------------------------------------------------------------------------------
3.3 Seller Balance Transactions & Ledger
--------------------------------------------------------------------------------
Endpoint: GET /mobileapi/product-seller/finances/transactions
Headers:
  Authorization: Bearer <accessToken>

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "transactions": [
    {
      "id": "cuid_txn_id",
      "amount": 70.00,
      "kind": "CREDIT",
      "reason": "ORDER_LINE_DELIVERED",
      "note": "Seller net credit: Item incl. GST (100.00) − platform commission (10.00) − delivery boy charge (20.00)",
      "orderId": "cuid_order_id",
      "createdAt": "2026-08-28T10:45:00.000Z"
    }
  ],
  "summary": {
    "netBalance": 10780.00,
    "totalCredits": 10780.00,
    "totalDebits": 0.00
  }
}

--------------------------------------------------------------------------------
3.4 UI Implementation Guidelines for Product Seller Mobile App
--------------------------------------------------------------------------------
On the Seller Order Details Screen:
- Display a dedicated "Earnings & Payout Breakdown" Card:
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 🧾 SELLER EARNINGS & PAYOUT BREAKDOWN (Commission: 10%)               │
  ├──────────────────┬──────────────────┬─────────────────┬────────────────┤
  │ Item Gross Value │ Platform Fee     │ Delivery Charge │ Net Revenue    │
  │ NLe 100.00        │ -NLe 10.00        │ -NLe 20.00       │ NLe 70.00       │
  │ (Slate Card)     │ (Rose Badge)     │ (Amber Badge)   │ (Green Bold)   │
  └──────────────────┴──────────────────┴─────────────────┴────────────────┘
- If `deliveryProofImage` is present on the order item, render a clickable thumbnail
  preview titled "Visual Delivery Proof".

================================================================================
4. RIDER MOBILE APP IMPLEMENTATION
================================================================================

--------------------------------------------------------------------------------
4.1 Rider Dashboard & Earnings API
--------------------------------------------------------------------------------
Endpoint: GET /mobileapi/rider/settings
Headers:
  Authorization: Bearer <accessToken>

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "user": {
    "id": "cuid_user_id",
    "name": "Ibrahim Koroma",
    "email": "rider.ibrahim@example.com",
    "phone": "76123456",
    "phoneCountryCode": "+232",
    "image": "https://.../rider-pfp.jpg"
  },
  "rider": {
    "id": "cuid_rider_id",
    "status": "APPROVED",
    "isOnline": true,
    "vehicleTypes": ["2_WHEELER"],
    "vehicleNumber": "SL-3829-B",
    "selectedZones": ["ZONE 1", "ZONE 2"],
    "selectedLocations": ["LUMLEY", "ABERDEEN"]
  },
  "stats": {
    "totalEarnings": 640.00,
    "completedDeliveriesCount": 32,
    "activeDeliveriesCount": 1
  }
}

--------------------------------------------------------------------------------
4.2 Orders List with Allocated Delivery Earnings
--------------------------------------------------------------------------------
Endpoint: GET /mobileapi/rider/orders?tab=active
Query Parameters:
- `tab`: `active` | `offered` | `completed` | `all`
Headers:
  Authorization: Bearer <accessToken>

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "tab": "active",
  "count": 1,
  "data": [
    {
      "id": "cuid_assignment_id",
      "orderId": "cuid_order_id",
      "status": "OUT_FOR_DELIVERY",
      "dispatchMode": "AUTO_CASCADE",
      "distanceKm": 2.4,
      "order": {
        "orderNumber": "meeem00000125",
        "totalAmount": 120.00,
        "shipping": 20.00,
        "shippingFullName": "John Doe",
        "shippingPhone": "78999111",
        "shippingAddressLine1": "14 Lumley Beach Road",
        "shippingCity": "Freetown",
        "seller": {
          "store": { "name": "Apex Electronics" },
          "businessInfo": {
            "street": "25 Siaka Stevens St",
            "city": "Freetown",
            "latitude": 8.4842,
            "longitude": -13.2341
          }
        },
        "items": [
          {
            "id": "cuid_item_id",
            "productNameSnapshot": "Wireless Bluetooth Headphones",
            "quantity": 1,
            "price": 100.00,
            "shippingAmount": 20.00
          }
        ]
      }
    }
  ]
}

--------------------------------------------------------------------------------
4.3 Delivery Milestone Execution & OTP + Photo Proof
--------------------------------------------------------------------------------
Endpoint: POST /mobileapi/rider/orders/:id/status
Headers:
  Authorization: Bearer <accessToken>
  Content-Type: application/json

A. Arrived at Merchant Store:
{
  "status": "AT_PICKUP"
}

B. Packages Collected:
{
  "status": "PICKED_UP"
}

C. Heading to Customer (Triggers Customer OTP Dispatch):
{
  "status": "OUT_FOR_DELIVERY"
}

D. Complete Delivery (OTP Verification & Visual Proof Photo):
{
  "status": "DELIVERED",
  "otp": "582910",
  "proofImage": "data:image/jpeg;base64,/9j/4AAQSkZJRg..." 
}

NOTE ON `proofImage`:
- Mobile apps can send either:
  1. Base64 Data URI: `"data:image/jpeg;base64,..."` (Camera capture)
  2. Public HTTPS URL: `"https://.../photo.jpg"`
- The backend automatically detects Base64, uploads it to secure storage, and
  persists the public URL.

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "message": "Delivery status updated to DELIVERED",
  "data": {
    "id": "cuid_assignment_id",
    "status": "DELIVERED",
    "deliveredAt": "2026-08-28T10:45:00.000Z",
    "deliveryProofImage": "https://.../delivery-proofs/proof-123.jpg"
  }
}

--------------------------------------------------------------------------------
4.4 UI Implementation Guidelines for Rider Mobile App
--------------------------------------------------------------------------------
1. Order Card Badge:
   Display: `Delivery Earning: NLe 20.00` in emerald green on every delivery card.
2. Stepper Component:
   [1. Accept Offer] -> [2. Arrive at Store] -> [3. Collect Package] -> [4. Out for Delivery] -> [5. Verify OTP & Complete]
3. OTP Modal:
   - 6-digit numeric input with auto-focus.
   - Camera button allowing rider to capture a photo of the package handover.

================================================================================
5. CUSTOMER MOBILE APP IMPLEMENTATION
================================================================================

--------------------------------------------------------------------------------
5.1 Secure 6-Digit Delivery OTP Display
--------------------------------------------------------------------------------
When `order.status === "OUT_FOR_DELIVERY"`:
- The Customer Order Details screen (`GET /mobileapi/customer/orders/:id`)
  returns the active delivery state.
- Render a highlighted security card:
  ┌────────────────────────────────────────────────────────────┐
  │ 🔐 YOUR DELIVERY OTP CODE: [ 5 8 2 9 1 0 ]                 │
  │ Share this code with the rider when receiving your parcel. │
  └────────────────────────────────────────────────────────────┘

--------------------------------------------------------------------------------
5.2 Live Rider Proximity Tracking Map & WebSocket Endpoints
--------------------------------------------------------------------------------
- WebSocket URL: `https://<domain>:3001` (or `wss://<domain>/socket.io`)
- Socket Health Check: `GET https://<domain>:3001/health`
  Returns: `{"status": "ok", "service": "meeem-socket-server"}`
  Use for Docker, PM2, and load balancer uptime monitoring.
- Internal Location Relay: `POST https://<domain>:3001/internal/location`
  Body: `{"riderId": "...", "orderId": "...", "latitude": 12.34, "longitude": 56.78, "heading": 90, "speed": 25}`
  Returns: `{"success": true}`
- Direct WebSocket Room: Join `order:<orderId>`, listen for `order:rider_moved` events.
- Display live moving motorcycle icon showing the rider navigating towards the customer's
  destination address.

--------------------------------------------------------------------------------
5.3 Visual Proof of Delivery Verification
--------------------------------------------------------------------------------
When `order.status === "DELIVERED"`:
- The Customer Order Details screen displays the photo captured by the rider under
  "Delivery Verification Proof".

================================================================================
6. COMPLETE END-TO-END DELIVERY & FINANCIAL LIFECYCLE (STEP-BY-STEP)
================================================================================

Step 1: Customer Places Product Order
  - Item Price: NLe 100, Shipping: NLe 20, Total: NLe 120.
  - Item `shippingAmount` recorded as NLe 20.00.
  - Item `commissionAmount` recorded as NLe 10.00.

Step 2: Proximity Waterfall Dispatch
  - Backend queries approved, online, idle riders in seller's zone.
  - High-priority Push Notification sent to closest rider (60s timer).

Step 3: Rider Accepts & Collects
  - Rider clicks "Accept".
  - Rider navigates to store (`AT_PICKUP`) and collects items (`PICKED_UP`).

Step 4: Out for Delivery & OTP Dispatch
  - Rider starts transit (`OUT_FOR_DELIVERY`).
  - System generates 6-digit OTP and notifies customer.

Step 5: Handover, OTP Verification & Photo Upload
  - Rider asks customer for 6-digit OTP and snaps handover photo.
  - Rider submits `POST /mobileapi/rider/orders/:id/status` (`DELIVERED`).
  - Backend verifies OTP, stores proof image, and marks order `DELIVERED`.

Step 6: Instant Automated Financial Settlement
  - Backend immediately calls `applySellerCreditForOrderLineDelivered`.
  - Seller net balance is credited with: NLe 100 - NLe 10 - NLe 20 = NLe 70.00.
  - Delivery boy retains their NLe 20.00 delivery earning.
  - Platform retains NLe 10.00 commission.
  - Real-time balances update on all mobile apps and web dashboards.

================================================================================
7. MOBILE DEVELOPER CHECKLIST (FLUTTER / KOTLIN / SWIFT)
================================================================================
[ ] Rider App: Display `Delivery Earning: NLe XX.XX` on all order cards.
[ ] Rider App: Display `Total Earnings` and `Completed Deliveries` on Dashboard.
[ ] Rider App: In delivery modal, allow camera capture / upload for `proofImage`.
[ ] Product Seller App: On Order Details, display the 4-column financial breakdown:
    Gross Value (NLe 100) | Platform Fee (-NLe 10) | Delivery Charge (-NLe 20) | Net Payout (NLe 70).
[ ] Product Seller App: On Overview screen, display `deliveryBoyCharges` and `netEarnings`.
[ ] Customer App: Display 6-digit OTP when order is Out for Delivery.
[ ] Customer App: Display Rider's proof of delivery image upon completion.
================================================================================
