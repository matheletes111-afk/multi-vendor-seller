================================================================================
MOBILE API GUIDE: RIDER PACKAGE PICKUP PROOFS & SELLER ORDER DISPATCH
================================================================================
Document Version: 1.0
Date: September 2026
Applicable To: Rider Mobile App & Product Seller Mobile App
Platform: REST API (JSON & Multipart Form-Data)

================================================================================
OVERVIEW OF NEW FEATURES & CHANGES
================================================================================

1. RIDER APP: PACKAGE PICKUP PROOF PHOTOS (NEW)
   - When a rider arrives at the seller's store and collects the parcel, the rider 
     must now capture and upload multiple photos (parcel sealed, shipping label, 
     packaging condition).
   - Supported via POST /mobileapi/rider/orders/{id}/status using either:
     a) multipart/form-data (native binary file uploads)
     b) application/json (base64 data-URL strings or existing URLs)

2. SELLER APP: VIEWING PICKUP PHOTOS (NEW)
   - When calling GET /mobileapi/product-seller/orders/{id}, the backend now returns 
     the array of pickup proof photo URLs in:
     a) response.activeAssignment.pickupProofPhotos (array of image URLs)
     b) response.items[i].pickupProofPhotos (array of image URLs)
   - The seller can inspect these photos directly on the mobile order details screen.

3. FINANCIAL CALCULATION & NET REVENUE (CRITICAL FIX FOR SELLER APP)
   - For platform deliveries, the customer delivery fee (e.g., NLe 150.00) is paid 
     by the customer to the platform for the rider.
   - IT IS NOT DEDUCTED FROM THE SELLER'S REVENUE.
   - Seller Net Payout = Item Gross (Unit Price + Tax) - Platform Commission.
   - Do NOT deduct the delivery fee on the mobile screen.

4. STRICT BACKWARD COMPATIBILITY
   - Customer final delivery proof (deliveryProofImage) remains 100% untouched.
   - Customer delivery OTP verification remains 100% untouched.
   - If older rider apps call status without photos, the API continues to work 
     normally without errors.

================================================================================
PART 1: RIDER MOBILE APP SPECIFICATION
================================================================================

--------------------------------------------------------------------------------
1.1 Delivery Lifecycle Milestones
--------------------------------------------------------------------------------
1. OFFERED           -> Rider receives delivery request
2. ACCEPTED          -> Rider accepts the trip
3. AT_PICKUP         -> Rider arrives at the seller store/warehouse
4. PICKED_UP         -> Rider collects parcel from seller + UPLOADS PICKUP PHOTOS [NEW]
5. OUT_FOR_DELIVERY  -> Rider is en route to customer
6. DELIVERED         -> Rider delivers parcel to customer (Requires Customer OTP)

--------------------------------------------------------------------------------
1.2 Updating Status to "PICKED_UP" with Multiple Photos
--------------------------------------------------------------------------------
Endpoint:
  POST /mobileapi/rider/orders/{id}/status

URL Parameter:
  - id: The Order ID or RiderDeliveryAssignment ID.

Headers:
  - Authorization: Bearer <rider_token>

--------------------------------------------------
OPTION A: multipart/form-data (RECOMMENDED FOR MOBILE)
--------------------------------------------------
Use standard multipart form-data. You can attach multiple images under the key "pickupPhotos".

Form Fields:
  - status: "PICKED_UP" (string, required)
  - pickupPhotos: [Binary File 1] (file, image/jpeg, image/png, image/webp)
  - pickupPhotos: [Binary File 2] (file, image/jpeg, image/png, image/webp)
  - pickupPhotos: [Binary File 3] (file, image/jpeg, image/png, image/webp)

React Native / Axios Example:
```javascript
const formData = new FormData();
formData.append('status', 'PICKED_UP');

// Attach multiple photos from camera / gallery
photos.forEach((photo, index) => {
  formData.append('pickupPhotos', {
    uri: photo.uri,
    type: photo.type || 'image/jpeg',
    name: photo.fileName || `pickup_${index}.jpg`,
  });
});

const response = await axios.post(
  `https://your-domain.com/mobileapi/rider/orders/${orderId}/status`,
  formData,
  {
    headers: {
      'Authorization': `Bearer ${riderToken}`,
      'Content-Type': 'multipart/form-data',
    },
  }
);
```

Flutter / Dart (Dio) Example:
```dart
FormData formData = FormData.fromMap({
  'status': 'PICKED_UP',
  'pickupPhotos': [
    for (var file in photoFiles)
      await MultipartFile.fromFile(file.path, filename: file.path.split('/').last),
  ],
});

var response = await dio.post(
  'https://your-domain.com/mobileapi/rider/orders/$orderId/status',
  data: formData,
  options: Options(headers: {'Authorization': 'Bearer $riderToken'}),
);
```

--------------------------------------------------
OPTION B: application/json (Base64)
--------------------------------------------------
Headers:
  - Content-Type: application/json
  - Authorization: Bearer <rider_token>

Request Body:
```json
{
  "status": "PICKED_UP",
  "pickupPhotos": [
    "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  ]
}
```

--------------------------------------------------------------------------------
1.3 Successful Response (HTTP 200)
--------------------------------------------------------------------------------
```json
{
  "success": true,
  "message": "Assignment status updated to PICKED_UP",
  "data": {
    "id": "cmtwol9oa000h145zhs2aftv9",
    "orderId": "cmtwognce00048grf3xuko4bu",
    "riderId": "rider_12345",
    "status": "PICKED_UP",
    "pickedUpAt": "2026-09-11T14:30:00.000Z",
    "pickupProofPhotos": [
      "https://storage.googleapis.com/.../pickup-proofs/pickup-cmtwol9o-1.jpg",
      "https://storage.googleapis.com/.../pickup-proofs/pickup-cmtwol9o-2.jpg"
    ]
  }
}
```

--------------------------------------------------------------------------------
1.4 Note on Final Customer Delivery (DELIVERED Milestone)
--------------------------------------------------------------------------------
When the rider completes final delivery to the customer:
- Endpoint: POST /mobileapi/rider/orders/{id}/status
- Body:
  {
    "status": "DELIVERED",
    "otp": "482910",            // 6-digit OTP obtained from customer (MANDATORY)
    "proofImage": "data:image/jpeg;base64,..." // Optional single photo proof
  }
- This flow remains COMPLETELY UNCHANGED.


================================================================================
PART 2: PRODUCT SELLER MOBILE APP SPECIFICATION
================================================================================

--------------------------------------------------------------------------------
2.1 Order Details API
--------------------------------------------------------------------------------
Endpoint:
  GET /mobileapi/product-seller/orders/{id}

Headers:
  - Authorization: Bearer <seller_token>

--------------------------------------------------------------------------------
2.2 New Fields in Response Payload
--------------------------------------------------------------------------------
Inside `activeAssignment`:
```json
{
  "activeAssignment": {
    "id": "cmtwol9oa000h145zhs2aftv9",
    "status": "PICKED_UP",
    "dispatchMode": "AUTO_BROADCAST",
    "pickedUpAt": "2026-09-11T14:30:00.000Z",
    "rider": {
      "id": "rider_12345",
      "name": "John Kamara",
      "phone": "+23277123456",
      "vehicleType": "BIKE",
      "vehicleNumber": "SL-AA-102"
    },
    "pickupProofPhotos": [
      "https://storage.googleapis.com/.../pickup-proofs/pickup-cmtwol9o-1.jpg",
      "https://storage.googleapis.com/.../pickup-proofs/pickup-cmtwol9o-2.jpg"
    ]
  }
}
```

Inside each item in `items`:
```json
{
  "items": [
    {
      "id": "cmtwognce00058grfyuiop12",
      "itemStatus": "SHIPPED",
      "productNameSnapshot": "Men Classic Cotton T-Shirt",
      "quantity": 1,
      "price": 324.99,
      "gstAmount": 48.75,
      "itemGross": 373.74,
      "shippingAmount": 150.00,
      "commissionAmount": 37.37,
      "commissionRateSnapshot": 10,
      "deliveryFeeDeducted": 0,
      "deliveryFeeEarned": 0,
      "isSelfDelivery": false,
      "sellerNet": 336.37,
      "netRevenue": 336.37,
      "netPayout": 336.37,
      "pickupProofPhotos": [
        "https://storage.googleapis.com/.../pickup-proofs/pickup-cmtwol9o-1.jpg",
        "https://storage.googleapis.com/.../pickup-proofs/pickup-cmtwol9o-2.jpg"
      ]
    }
  ]
}
```

--------------------------------------------------------------------------------
2.3 Mobile UI Implementation: Package Pickup Proof Section
--------------------------------------------------------------------------------
Display this section whenever `activeAssignment.pickupProofPhotos.length > 0` or
`item.pickupProofPhotos.length > 0`:

Card Structure:
  - Header:
    - Icon: Camera or PackageCheck
    - Title: "Package Pickup Proof"
    - Subtitle: "Captured by rider during parcel collection from store"
    - Badge: "Verified at Store" (Green or Amber pill)
    - Photo Count: "{count} Photos"
  - Content:
    - Horizontal scroll view or 3-column grid of thumbnail cards.
    - Each thumbnail has rounded corners and subtle border.
    - Tapping a thumbnail opens the full-screen photo viewer (Lightbox) with zoom.

--------------------------------------------------------------------------------
2.4 Critical Seller Financial Breakdown Correction
--------------------------------------------------------------------------------
DO NOT SUBTRACT DELIVERY FEE FROM SELLER REVENUE ON PLATFORM DELIVERIES!

Check `order.isSelfDelivery`:

Case A: Platform Delivery (`isSelfDelivery === false`)
  - The customer paid the delivery fee (NLe 150.00) directly for rider dispatch.
  - Delivery Fee Deducted from Seller: NLe 0.00
  - Calculation to display on Mobile Order Details:
    --------------------------------------------------
    Item Gross (Price + Tax):      NLe 373.74
    Platform Commission (10%):    -NLe  37.37
    Delivery Fee (Platform Rider): NLe   0.00 (Paid by customer)
    --------------------------------------------------
    Net Revenue (Seller Payout):   NLe 336.37 (Credited to Wallet)
    --------------------------------------------------

Case B: Self-Delivery (`isSelfDelivery === true`)
  - The seller delivers the order themselves.
  - The seller earns the customer delivery fee.
  - Calculation:
    --------------------------------------------------
    Item Gross (Price + Tax):      NLe 373.74
    Delivery Fee Earned:          +NLe 150.00
    Platform Commission (10%):    -NLe  37.37
    --------------------------------------------------
    Net Revenue (Seller Payout):   NLe 486.37
    --------------------------------------------------

Always use the backend pre-calculated values directly:
  - `item.sellerNet` or `item.netRevenue`
  - `item.commissionAmount`
  - `item.deliveryFeeDeducted` (will always be 0 on platform deliveries)

--------------------------------------------------------------------------------
2.5 Informational Note for "Mark as Shipped"
--------------------------------------------------------------------------------
Under the "Mark as Shipped" button or status change sheet in the Seller app, display:
  "🚚 When marked as Shipped, the system automatically finds and assigns a 
   nearby delivery rider with the right vehicle for this package."


================================================================================
PART 3: DEVELOPER CHECKLIST & INTEGRATION TEST CASES
================================================================================

Test Case 1: Rider Photo Upload during Pickup
  1. Rider arrives at store (status = AT_PICKUP).
  2. Rider taps "Collect Package".
  3. App prompts camera/gallery to take 1 to 5 photos.
  4. App posts to /mobileapi/rider/orders/{id}/status with status: "PICKED_UP".
  5. Verify: Response contains success: true and pickupProofPhotos array.

Test Case 2: Seller Views Pickup Photos
  1. Seller opens order details (GET /mobileapi/product-seller/orders/{id}).
  2. Verify: activeAssignment.pickupProofPhotos contains the photo URLs.
  3. Verify: Tapping photos opens high-resolution preview.

Test Case 3: Seller Financial Math Verification
  1. For an order with item gross NLe 373.74 and shipping NLe 150.00:
  2. Verify: Mobile screen shows Net Revenue as NLe 336.37 (NOT NLe 186.36).
  3. Verify: Delivery fee is labeled as "Platform Rider (NLe 0.00 deducted)".

Test Case 4: Final Customer Delivery
  1. Rider reaches customer (status = OUT_FOR_DELIVERY).
  2. Rider enters 6-digit customer OTP.
  3. App posts status: "DELIVERED" with otp: "xxxxxx".
  4. Verify: Delivery completes successfully and rider earnings are credited.

================================================================================
END OF DOCUMENT
================================================================================
