# Mobile Developer Handoff — Apple In-App Purchase (StoreKit 2) Integration
## Meem Seller iOS App & Backend Contract

> **Target Audience:** Flutter / iOS Mobile App Developers  
> **Production Base URL:** `https://www.meeemsl.com`  
> **Backend Architecture:** Apple StoreKit 2 (JWS Verification) + App Store Server Notifications v2  
> **Compliance:** Apple App Store Review Guideline 3.1 & 3.1.1  

---

## 1. Quick Overview of the Flow

```
[Flutter App] ── 1. GET /mobileapi/seller/iap/products ──► [Meem Backend]
              ◄── Returns active plans & appleProductIds ──

[Flutter App] ── 2. queryProductDetails(appleProductIds) ──► [Apple StoreKit 2]
              ◄── Returns localized prices & currency ──────

[Flutter App] ── 3. buyNonConsumable(productDetails) ────► [Apple Face ID / Touch ID]
              ◄── Returns Signed JWS Token ──────────────

[Flutter App] ── 4. POST /mobileapi/seller/iap/verify-purchase ──► [Meem Backend]
              ◄── { success: true, subscription: {...} } ─────────

[Flutter App] ── 5. completePurchase(purchase) ──────────► [Apple StoreKit 2]
```

> ⚠️ **CRITICAL RULE FOR STOREKIT:**  
> Never call `completePurchase(purchase)` before Step 4 succeeds! Only acknowledge/finish the transaction after the Meem Backend confirms `success: true`.

---

## 2. API Endpoints Specification

All endpoints require the seller Bearer JWT token in the `Authorization` header. Works for all 4 seller types (**Product Seller, Service Seller, Hotel Seller, Restaurant Seller**).

---

### API 1: Fetch Plans & Apple Product Catalog

* **Endpoint:** `GET https://www.meeemsl.com/mobileapi/seller/iap/products`
* **Headers:**
  ```http
  Authorization: Bearer <SELLER_JWT_TOKEN>
  Accept: application/json
  ```
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "sellerType": "PRODUCT_SERVICE", // "PRODUCT_SERVICE" | "HOTEL" | "RESTAURANT"
    "products": [
      {
        "planId": "cm1abcdef0001",
        "name": "STANDARD",
        "displayName": "Standard",
        "description": "For growing businesses",
        "price": 29.99,
        "durationDays": 30,
        "appleProductId": "com.meeem.seller.standard.monthly",
        "maxProducts": 50,
        "maxOrders": null,
        "maxRooms": null,
        "features": {
          "products": 50,
          "orders": "unlimited",
          "analytics": "standard"
        }
      },
      {
        "planId": "cm1abcdef0002",
        "name": "PREMIUM",
        "displayName": "Premium",
        "description": "For established businesses",
        "price": 99.99,
        "durationDays": 30,
        "appleProductId": "com.meeem.seller.premium.monthly",
        "maxProducts": null,
        "maxOrders": null,
        "maxRooms": null,
        "features": {
          "products": "unlimited",
          "orders": "unlimited",
          "analytics": "advanced"
        }
      }
    ],
    "currentSubscription": {
      "id": "sub_12345",
      "planId": "cm1abcdef0001",
      "status": "ACTIVE", // "ACTIVE" | "IN_GRACE_PERIOD" | "EXPIRED" | "REVOKED"
      "provider": "apple_iap",
      "appleProductId": "com.meeem.seller.standard.monthly",
      "currentPeriodStart": "2026-09-16T12:00:00.000Z",
      "currentPeriodEnd": "2026-10-16T12:00:00.000Z"
    }
  }
  ```

---

### API 2: Verify & Activate StoreKit 2 Purchase

* **Endpoint:** `POST https://www.meeemsl.com/mobileapi/seller/iap/verify-purchase`
* **Headers:**
  ```http
  Authorization: Bearer <SELLER_JWT_TOKEN>
  Content-Type: application/json
  ```
* **Request Body:**
  ```json
  {
    "planId": "cm1abcdef0001",
    "jwsRepresentation": "eyJhbGciOiJFUzI1NiIsIng1YyI6WyJNSUlCY3pDQ0FVMmdBd0lCQWdJSU..."
  }
  ```
  *(In Flutter `in_app_purchase`, `jwsRepresentation` is retrieved from `purchaseDetails.verificationData.serverVerificationData`)*.

* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Subscription verified and activated successfully.",
    "subscription": {
      "id": "sub_12345",
      "planId": "cm1abcdef0001",
      "status": "ACTIVE",
      "provider": "apple_iap",
      "originalTransactionId": "1000000789123456",
      "currentPeriodStart": "2026-09-16T12:00:00.000Z",
      "currentPeriodEnd": "2026-10-16T12:00:00.000Z",
      "planSnapshot": { ... }
    }
  }
  ```

* **Error Responses:**
  * `400 Bad Request`: Missing token, expired token, or product mismatch.
  * `409 Conflict`: Fraud alert — this Apple Subscription is already bound to another seller account.

---

### API 3: Restore Past Purchases (Mandatory for App Review)

* **Endpoint:** `POST https://www.meeemsl.com/mobileapi/seller/iap/restore`
* **Headers:**
  ```http
  Authorization: Bearer <SELLER_JWT_TOKEN>
  Content-Type: application/json
  ```
* **Request Body:**
  ```json
  {
    "jwsRepresentation": "eyJhbGciOiJFUzI1NiIsIng1YyI6WyJNSUlCY3pDQ0FVMmdBd0lCQWdJSU..."
  }
  ```
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Subscription successfully restored.",
    "subscription": { ... }
  }
  ```

---

## 3. Apple In-App Purchase Product IDs

The mobile app should match and query these **6 Product IDs** in App Store Connect:

| Category | Tier | Apple Product ID |
|---|---|---|
| **Product / Service Seller** | Standard | `com.meeem.seller.standard.monthly` |
| **Product / Service Seller** | Premium | `com.meeem.seller.premium.monthly` |
| **Hotel Seller** | Standard | `com.meeem.seller.hotel.standard.monthly` |
| **Hotel Seller** | Premium | `com.meeem.seller.hotel.premium.monthly` |
| **Restaurant Seller** | Standard | `com.meeem.seller.restaurant.standard.monthly` |
| **Restaurant Seller** | Premium | `com.meeem.seller.restaurant.premium.monthly` |

---

## 4. Flutter Implementation Code Example

### Recommended Packages:
In `pubspec.yaml`:
```yaml
dependencies:
  flutter:
    sdk: flutter
  in_app_purchase: ^3.2.0
  in_app_purchase_storekit: ^0.3.18
```

### Purchase Service Snippet:
```dart
import 'dart:async';
import 'dart:io';
import 'package:in_app_purchase/in_app_purchase.dart';

class AppleIapService {
  final InAppPurchase _iap = InAppPurchase.instance;
  late StreamSubscription<List<PurchaseDetails>> _subscription;
  String? _pendingPlanId;

  void initialize() {
    if (!Platform.isIOS) return;

    final purchaseStream = _iap.purchaseStream;
    _subscription = purchaseStream.listen(
      _handlePurchaseUpdates,
      onDone: () => _subscription.cancel(),
      onError: (error) => print('[IAP] Error: $error'),
    );
  }

  // 1. Buy Subscription
  Future<void> buyPlan(ProductDetails product, String planId) async {
    _pendingPlanId = planId;
    final purchaseParam = PurchaseParam(productDetails: product);
    // Auto-renewable subscriptions use buyNonConsumable
    await _iap.buyNonConsumable(purchaseParam: purchaseParam);
  }

  // 2. Handle Stream Updates
  Future<void> _handlePurchaseUpdates(List<PurchaseDetails> purchases) async {
    for (final purchase in purchases) {
      if (purchase.status == PurchaseStatus.purchased || 
          purchase.status == PurchaseStatus.restored) {
        
        final String jwsToken = purchase.verificationData.serverVerificationData;
        final bool isSuccess = await _verifyWithBackend(jwsToken, _pendingPlanId, isRestore: purchase.status == PurchaseStatus.restored);

        if (isSuccess && purchase.pendingCompletePurchase) {
          // CRITICAL: Complete transaction with Apple only after backend confirmation!
          await _iap.completePurchase(purchase);
        }
      } else if (purchase.status == PurchaseStatus.error || purchase.status == PurchaseStatus.canceled) {
        if (purchase.pendingCompletePurchase) {
          await _iap.completePurchase(purchase);
        }
      }
    }
  }

  // 3. Verify with Backend
  Future<bool> _verifyWithBackend(String jwsToken, String? planId, {bool isRestore = false}) async {
    final endpoint = isRestore ? '/mobileapi/seller/iap/restore' : '/mobileapi/seller/iap/verify-purchase';
    final body = isRestore ? {'jwsRepresentation': jwsToken} : {'planId': planId, 'jwsRepresentation': jwsToken};

    // Call your http/dio client with Bearer token
    final response = await apiClient.post(endpoint, body);
    return response.statusCode == 200 && response.data['success'] == true;
  }

  // 4. Restore Purchases Button Action
  Future<void> restorePurchases() async {
    await _iap.restorePurchases();
  }

  void dispose() {
    _subscription.cancel();
  }
}
```

---

## 5. Apple Review Rejection Checklist (Guideline 3.1 & 3.1.1)

To prevent Apple from rejecting the app during App Store Review:

- [ ] **No External Web/Stripe Links on iOS:**  
  Make sure web checkout dialogs/links are wrapped inside `if (!Platform.isIOS)`. On iOS, only trigger StoreKit.
- [ ] **"Restore Purchases" Button:**  
  Add a visible "Restore Purchases" button on the Paywall UI (e.g. in AppBar or below plans).
- [ ] **Terms of Use (EULA) & Privacy Policy:**  
  Provide active clickable links to both **Terms of Use** (e.g. Apple Standard EULA: `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`) and your **Privacy Policy** (`https://www.meeemsl.com/terms`).
- [ ] **Dynamic Localized Currency:**  
  Show the price formatted by Apple StoreKit (`productDetails.price`), never hardcode `$29.99` in text.
- [ ] **Auto-Renewal Disclosure Text:**  
  Include text below the button stating: *"Payment will be charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless cancelled at least 24 hours before the end of the current billing cycle. You can manage and cancel your subscriptions in your Apple ID Account Settings."*
