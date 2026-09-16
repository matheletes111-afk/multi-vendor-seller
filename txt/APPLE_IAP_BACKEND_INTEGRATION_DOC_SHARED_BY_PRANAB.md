# Apple In-App Purchase (StoreKit 2) & Backend Integration Guide
## Compliance with Apple App Store Review Guideline 3.1

**App:** Meem Seller App (`meem_seller`)  
**Target Audience:** Mobile Developers (Flutter) & Backend Developers (Meem Backend)  
**Target Platforms:** iOS (Apple StoreKit 2) & Meem Backend (Node.js / Express / DB)  
**Document Version:** 1.0.0  
**Date:** September 2026  

---

## Table of Contents
1. [Important Clarification: Apple Pay vs. Apple In-App Purchase (Guideline 3.1)](#1-important-clarification-apple-pay-vs-apple-in-app-purchase-guideline-31)
2. [End-to-End Architectural Sequence Flow](#2-end-to-end-architectural-sequence-flow)
3. [App Store Connect Setup & Credentials](#3-app-store-connect-setup--credentials)
4. [Backend API Specifications & Implementation](#4-backend-api-specifications--implementation)
   - [API 1: GET `/mobileapi/seller/iap/products`](#api-1-get-mobileapiselleriapproducts)
   - [API 2: POST `/mobileapi/seller/iap/verify-purchase`](#api-2-post-mobileapiselleriapverify-purchase)
   - [API 3: POST `/api/webhooks/apple-iap` (ASSN v2 Webhook)](#api-3-post-apiwebhooksapple-iap-assn-v2-webhook)
5. [Database Schema & Plan Snapshot Management](#5-database-schema--plan-snapshot-management)
6. [Backend Code Reference (Node.js / TypeScript)](#6-backend-code-reference-nodejs--typescript)
7. [Frontend (Flutter) Integration Guide](#7-frontend-flutter-integration-guide)
   - [Dependencies & Setup](#dependencies--setup)
   - [StoreKit 2 Purchase Service](#storekit-2-purchase-service)
   - [Restore Purchases Workflow](#restore-purchases-workflow)
   - [Guideline 3.1 Paywall Compliance Checklist](#guideline-31-paywall-compliance-checklist)
8. [Testing & Sandbox Verification Strategy](#8-testing--sandbox-verification-strategy)
9. [Common Pitfalls & Apple App Review Rejection Prevention](#9-common-pitfalls--apple-app-review-rejection-prevention)

---

## 1. Important Clarification: Apple Pay vs. Apple In-App Purchase (Guideline 3.1)

Before writing any code, it is critical to distinguish between **Apple Pay** and **Apple In-App Purchase (IAP)**:

| Feature | Apple Pay (`PassKit`) | Apple In-App Purchase (`StoreKit 2`) |
| :--- | :--- | :--- |
| **Purpose** | Buying **physical** products or services consumed outside the app (e.g., physical e-commerce goods, hotel room bookings, ride-hailing). | Unlocking **digital** features, seller digital tiers, subscription plans, quotas, or app capabilities. |
| **Apple Commission** | 0% (Standard merchant processing fees via Stripe, Tabby, etc.) | 15% to 30% commission taken by Apple. |
| **Apple Guideline 3.1.1** | **PROHIBITED** for digital goods and subscriptions. | **MANDATORY** for digital goods, seller tiers, and subscriptions. |
| **Payment Mechanism** | Credit/Debit card tokenized in Apple Wallet. | Apple ID account billing (credit card, Apple balance, mobile carrier). |

> ⚠️ **CRITICAL WARNING FOR APPLE APP REVIEW (Guideline 3.1.1):**  
> If a seller upgrades their tier inside the iOS app (e.g., to upload more products, view analytics, or get priority listings), **Apple strictly mandates In-App Purchases (StoreKit 2)**. Directing the user to an external checkout link, web browser, Stripe portal, or using Apple Pay for this subscription will cause **immediate app rejection**.

---

## 2. End-to-End Architectural Sequence Flow

The following sequence diagram outlines the exact flow between the **Flutter Seller App**, **Apple StoreKit 2**, **Meem Backend**, and **Apple Server Notifications**:

```
┌────────────────────┐          ┌───────────────────┐          ┌───────────────┐          ┌───────────────────────────┐
│ Flutter Seller App │          │ Apple StoreKit 2  │          │  Meem Backend │          │ Apple Server Notifications│
└─────────┬──────────┘          └─────────┬─────────┘          └───────┬───────┘          └─────────────┬─────────────┘
          │                               │                            │                                │
          │ 1. GET /mobileapi/seller/iap/products                      │                                │
          │───────────────────────────────────────────────────────────>│                                │
          │                               │                            │                                │
          │ 2. Return Apple Product IDs mapped to Plan IDs             │                                │
          │<───────────────────────────────────────────────────────────│                                │
          │                               │                            │                                │
          │ 3. Query Product Details & Localized Pricing               │                                │
          │──────────────────────────────>│                            │                                │
          │                               │                            │                                │
          │ 4. Return SKProducts (with localized currency)             │                                │
          │<──────────────────────────────│                            │                                │
          │                               │                            │                                │
          │ 5. Buy Product (inAppPurchase.buyNonConsumable)            │                                │
          │──────────────────────────────>│                            │                                │
          │                               │                            │                                │
          │ 6. Transaction Completed (Signed JWS Token)                │                                │
          │<──────────────────────────────│                            │                                │
          │                               │                            │                                │
          │ 7. POST /mobileapi/seller/iap/verify-purchase              │                                │
          │    { jwsRepresentation, planId }                           │                                │
          │───────────────────────────────────────────────────────────>│                                │
          │                               │                            │                                │
          │                               │ 8. (Optional) Validate JWS via Apple App Store Server API   │
          │                               │<───────────────────────────│                                │
          │                               │                            │                                │
          │                               │ 9. Decode JWS, verify x5c cert chain,                       │
          │                               │    extract originalTransactionId                            │
          │                               │    (Self-verified / verified with Apple)                    │
          │                               │                            │                                │
          │                               │ 10. Update Seller Subscription & freeze planSnapshot in DB  │
          │                               │                            │                                │
          │ 11. { success: true, subscription: {...} }                 │                                │
          │<───────────────────────────────────────────────────────────│                                │
          │                               │                            │                                │
          │ 12. completePurchase(purchaseDetails)                      │                                │
          │──────────────────────────────>│                            │                                │
          │                               │                            │                                │
          │═════════════════════════════════════════════════════════════════════════════════════════════│
          │               ASYNC LIFECYCLE (Renewals, Cancellations, Refunds, Grace Periods)             │
          │═════════════════════════════════════════════════════════════════════════════════════════════│
          │                               │                            │                                │
          │                               │                            │ 13. POST /api/webhooks/apple-iap
          │                               │                            │     (Signed ASSN v2 Payload)   │
          │                               │                            │<───────────────────────────────│
          │                               │                            │                                │
          │                               │                            │ 14. Verify JWS, update         │
          │                               │                            │     subscription status in DB  │
          │                               │                            │                                │
```

---

## 3. App Store Connect Setup & Credentials

Before implementing the backend and frontend, configure the following in **App Store Connect**:

### 3.1 Create Subscription Group & In-App Purchase Products
1. Go to **App Store Connect** > **Apps** > Select your Seller App (`meem_seller`).
2. Navigate to **Monetization** > **Subscriptions**.
3. Create a **Subscription Group** (e.g., `Seller_Membership_Tiers`).
4. Under this group, create Auto-Renewable Subscriptions:
   - `com.meeem.seller.starter.monthly`
   - `com.meeem.seller.gold.monthly`
   - `com.meeem.seller.gold.yearly`
   - `com.meeem.seller.platinum.monthly`
   - `com.meeem.seller.platinum.yearly`
5. Configure subscription duration (1 Month, 1 Year) and base pricing.

### 3.2 Generate In-App Purchase Server API Key
1. Go to **Users and Access** > **Integrations** > **In-App Purchase**.
2. Click **+** to generate a new API key. Name it: `Meem-Backend-IAP-Key`.
3. Note down the following three credentials for your backend `.env`:
   - **Issuer ID** (UUID format, e.g. `57246542-96fe-1a63-e053-0824d011072a`)
   - **Key ID** (10 characters, e.g. `2X9R4HXF34`)
   - **Private Key (`.p8` file)**: Download and store securely on your backend server.

### 3.3 Configure App Store Server Notifications v2 (ASSN v2)
1. Go to **App Store Connect** > **App Information** > **App Store Server Notifications**.
2. Set **Version 2 Notifications** URL:
   - **Production URL**: `https://api.meeemsl.com/api/webhooks/apple-iap`
   - **Sandbox URL**: `https://development.meeemsl.com/api/webhooks/apple-iap`

---

## 4. Backend API Specifications & Implementation

### API 1: GET `/mobileapi/seller/iap/products`

Returns the active subscription plan catalog with corresponding Apple Product IDs.

- **Method**: `GET`
- **Headers**:
  ```http
  Authorization: Bearer <SELLER_JWT_TOKEN>
  Accept: application/json
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "products": [
      {
        "planId": "66d01a1e4f1a2b001c9d8011",
        "appleProductId": "com.meeem.seller.gold.monthly",
        "name": "GOLD",
        "displayName": "Gold Seller Plan",
        "billingCycle": "monthly",
        "durationDays": 30,
        "sellerType": "product-seller"
      },
      {
        "planId": "66d01a1e4f1a2b001c9d8012",
        "appleProductId": "com.meeem.seller.platinum.monthly",
        "name": "PLATINUM",
        "displayName": "Platinum Seller Plan",
        "billingCycle": "monthly",
        "durationDays": 30,
        "sellerType": "product-seller"
      }
    ]
  }
  ```

---

### API 2: POST `/mobileapi/seller/iap/verify-purchase`

Receives the StoreKit 2 signed JWS token from Flutter, decodes and cryptographically verifies the transaction, updates the seller's active plan, freezes the `planSnapshot`, and unlocks quotas.

- **Method**: `POST`
- **Headers**:
  ```http
  Authorization: Bearer <SELLER_JWT_TOKEN>
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "planId": "66d01a1e4f1a2b001c9d8011",
    "jwsRepresentation": "eyJhbGciOiJFUzI1NiIsIng1YyI6WyJNSUlCY3pDQ0FVMmdBd0lCQWdJSU..."
  }
  ```

- **Verification Logic**:
  1. **Verify JWS Signature**:
     - Extract `x5c` certificate chain from the JWS header.
     - Validate certificate chain to the Apple Root CA - G3.
     - Verify signature using ES256 ECDSA.
  2. **Extract Decoded Payload**:
     ```json
     {
       "transactionId": "2000000891234567",
       "originalTransactionId": "1000000789123456",
       "bundleId": "com.meeem.seller",
       "productId": "com.meeem.seller.gold.monthly",
       "purchaseDate": 1740000000000,
       "expiresDate": 1742678400000,
       "quantity": 1,
       "type": "Auto-Renewable Subscription",
       "environment": "Production"
     }
     ```
  3. **Integrity Validation**:
     - Ensure `bundleId === process.env.APPLE_BUNDLE_ID`.
     - Ensure `productId` matches the requested `planId` Apple mapping.
     - Ensure `expiresDate > Date.now()`.
     - **Anti-Account Takeover**: Check if `originalTransactionId` already belongs to a different seller account.
  4. **Database Mutation**:
     - Update seller record with `status: "ACTIVE"`, `originalTransactionId`, `provider: "apple_iap"`.
     - Freeze the `planSnapshot` JSON in the database so subsequent catalog changes do not distort this billing cycle.
     - Insert transaction audit log.

- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Subscription verified and activated successfully.",
    "subscription": {
      "id": "sub_66d01a1e4f1a2b001c9d8099",
      "planId": "66d01a1e4f1a2b001c9d8011",
      "status": "ACTIVE",
      "provider": "apple_iap",
      "originalTransactionId": "1000000789123456",
      "currentPeriodStart": "2026-09-15T13:00:00.000Z",
      "currentPeriodEnd": "2026-10-15T13:00:00.000Z",
      "planSnapshot": {
        "name": "GOLD",
        "displayName": "Gold Seller Plan",
        "maxProducts": 500,
        "maxOrders": 2000,
        "features": ["analytics_pro", "badge_gold", "priority_support"]
      }
    }
  }
  ```

---

### API 3: POST `/api/webhooks/apple-iap` (ASSN v2 Webhook)

Handles asynchronous events (monthly renewals, billing failures, revocations, refunds).

- **Method**: `POST`
- **Payload**:
  ```json
  {
    "signedPayload": "eyJhbGciOiJFUzI1NiIsIng1YyI6WyJNSUlCY..."
  }
  ```

#### Decoded Notification Structure:
```json
{
  "notificationType": "DID_RENEW",
  "subtype": "BILLING_RECOVERY",
  "notificationUUID": "8b9e9d6e-...",
  "data": {
    "appAppleId": 1234567890,
    "bundleId": "com.meeem.seller",
    "environment": "Production",
    "signedTransactionInfo": "eyJhbGciOiJFUzI1Ni...",
    "signedRenewalInfo": "eyJhbGciOiJFUzI1Ni..."
  },
  "version": "2.0",
  "signedDate": 1742678405000
}
```

#### Event Handling Matrix:

| Notification Type | Subtype | Meaning | Action on Backend DB |
| :--- | :--- | :--- | :--- |
| `SUBSCRIBED` | `INITIAL_BUY` / `RESUBSCRIBE` | New subscription purchased or re-activated. | Set status to `ACTIVE`, update `currentPeriodEnd`. |
| `DID_RENEW` | - | Successful auto-renewal charge by Apple. | Extend `currentPeriodEnd`, refresh monthly quotas, keep status `ACTIVE`. |
| `DID_FAIL_TO_RENEW` | `GRACE_PERIOD` | Card declined; in Apple grace period. | Set status to `IN_GRACE_PERIOD`. Keep seller access alive temporarily; notify seller. |
| `EXPIRED` | `VOLUNTARY` / `BILLING_RETRY` | Billing failed or cancelled and expired. | Set status to `EXPIRED`. Downgrade seller to default Free plan limits. |
| `REFUND` | - | Apple refunded the transaction. | Set status to `REVOKED`. Immediately remove premium tier limits. |
| `REVOKE` | - | Family sharing or access revoked. | Set status to `REVOKED`. Disable plan. |

> ⏱️ **Webhook Acknowledgment Rule:**  
> Apple requires an HTTP `200 OK` response within 5 seconds. If the backend returns `500` or times out, Apple retries with exponential backoff for up to 3 days. Return `200 OK` immediately after enqueuing the background worker or validating the payload.

---

## 5. Database Schema & Plan Snapshot Management

### PostgreSQL / MongoDB Schema Recommendation

```sql
-- Active Subscriptions Table
CREATE TABLE seller_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL,
    seller_type VARCHAR(50) NOT NULL, -- 'PRODUCT', 'SERVICE', 'HOTEL', 'RESTAURANT'
    plan_id UUID NOT NULL,
    provider VARCHAR(20) NOT NULL DEFAULT 'apple_iap', -- 'apple_iap', 'web_checkout', 'free'
    apple_product_id VARCHAR(100),
    original_transaction_id VARCHAR(100) UNIQUE, -- Apple persistent unique key
    latest_transaction_id VARCHAR(100),
    status VARCHAR(30) NOT NULL, -- 'ACTIVE', 'IN_GRACE_PERIOD', 'EXPIRED', 'REVOKED'
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    auto_renew BOOLEAN DEFAULT TRUE,
    environment VARCHAR(20) DEFAULT 'Production', -- 'Sandbox' or 'Production'
    paid_price NUMERIC(10, 2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'USD',
    plan_snapshot JSONB NOT NULL, -- Frozen features, limits, and quotas at purchase time
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_seller_sub_seller_id ON seller_subscriptions(seller_id);
CREATE INDEX idx_seller_sub_orig_txn ON seller_subscriptions(original_transaction_id);

-- Audit Table for Webhook & Purchase Events
CREATE TABLE apple_iap_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_uuid VARCHAR(100) UNIQUE,
    notification_type VARCHAR(50),
    subtype VARCHAR(50),
    original_transaction_id VARCHAR(100),
    transaction_id VARCHAR(100),
    raw_payload JSONB,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Backend Code Reference (Node.js / TypeScript)

You can use the official `@apple/app-store-server-library` or `jsonwebtoken` / `node-jose` to decode and verify JWS.

### 6.1 JWS Verification Service (`appleIapService.ts`)

```typescript
import { 
  AppStoreServerAPIClient, 
  Environment, 
  SignedDataVerifier, 
  ResponseBodyV2DecodedPayload 
} from '@apple/app-store-server-library';
import fs from 'fs';

const issuerId = process.env.APPLE_IAP_ISSUER_ID!;
const keyId = process.env.APPLE_IAP_KEY_ID!;
const bundleId = process.env.APPLE_BUNDLE_ID!; // e.g. com.meeem.seller
const encodedKey = fs.readFileSync(process.env.APPLE_IAP_PRIVATE_KEY_PATH!, 'utf8');
const environment = process.env.NODE_ENV === 'production' 
  ? Environment.PRODUCTION 
  : Environment.SANDBOX;

// 1. Apple API Client
export const appleApiClient = new AppStoreServerAPIClient(
  encodedKey,
  keyId,
  issuerId,
  bundleId,
  environment
);

// 2. Apple Root Certificates for offline JWS signature checking
const appleRootCAs = [
  fs.readFileSync('./certs/AppleRootCA-G3.cer') // Downloaded from Apple PKI
];

export const appleSignedVerifier = new SignedDataVerifier(
  appleRootCAs,
  true, // enableOnlineChecks (OCSP)
  environment,
  bundleId
);

/**
 * Verifies and decodes a StoreKit 2 JWS transaction string
 */
export async function verifyStoreKit2Transaction(jws: string) {
  try {
    const verifiedTransaction = await appleSignedVerifier.verifyAndDecodeTransaction(jws);
    return verifiedTransaction;
  } catch (error) {
    console.error('StoreKit 2 JWS verification failed:', error);
    throw new Error('Invalid Apple In-App Purchase signature');
  }
}
```

### 6.2 Purchase Verification Controller (`verifyPurchaseController.ts`)

```typescript
import { Request, Response } from 'express';
import { verifyStoreKit2Transaction } from './appleIapService';
import { db } from '../database';

export async function verifyPurchaseHandler(req: Request, res: Response) {
  try {
    const sellerId = req.user.id; // From Auth Middleware
    const { planId, jwsRepresentation } = req.body;

    if (!planId || !jwsRepresentation) {
      return res.status(400).json({ success: false, message: 'Missing planId or jwsRepresentation' });
    }

    // 1. Verify JWS cryptographically
    const txn = await verifyStoreKit2Transaction(jwsRepresentation);

    // 2. Validate transaction expiration & bundle
    if (txn.bundleId !== process.env.APPLE_BUNDLE_ID) {
      return res.status(403).json({ success: false, message: 'Bundle ID mismatch' });
    }

    if (!txn.expiresDate || txn.expiresDate < Date.now()) {
      return res.status(400).json({ success: false, message: 'Transaction has already expired' });
    }

    // 3. Find target plan in catalog
    const plan = await db.plans.findById(planId);
    if (!plan || plan.appleProductId !== txn.productId) {
      return res.status(400).json({ success: false, message: 'Plan does not match purchased product' });
    }

    // 4. Anti-fraud check: ensure originalTransactionId isn't linked to a different seller
    const existingConflict = await db.sellerSubscriptions.findOne({
      originalTransactionId: txn.originalTransactionId,
      sellerId: { $ne: sellerId }
    });

    if (existingConflict) {
      return res.status(409).json({
        success: false,
        message: 'This Apple Subscription is already registered to another seller account.'
      });
    }

    // 5. Freeze plan snapshot
    const planSnapshot = {
      name: plan.name,
      displayName: plan.displayName,
      price: plan.price,
      durationDays: plan.durationDays,
      maxProducts: plan.maxProducts,
      maxOrders: plan.maxOrders,
      features: plan.features,
      frozenAt: new Date().toISOString()
    };

    // 6. Upsert Seller Subscription
    const updatedSub = await db.sellerSubscriptions.findOneAndUpdate(
      { sellerId },
      {
        sellerId,
        planId: plan._id,
        provider: 'apple_iap',
        appleProductId: txn.productId,
        originalTransactionId: txn.originalTransactionId,
        latestTransactionId: txn.transactionId,
        status: 'ACTIVE',
        currentPeriodStart: new Date(txn.purchaseDate),
        currentPeriodEnd: new Date(txn.expiresDate),
        autoRenew: true,
        environment: txn.environment,
        planSnapshot
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Subscription activated successfully',
      subscription: updatedSub
    });
  } catch (err: any) {
    console.error('Error verifying purchase:', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
}
```

### 6.3 ASSN v2 Webhook Controller (`appleWebhookController.ts`)

```typescript
import { Request, Response } from 'express';
import { appleSignedVerifier } from './appleIapService';
import { db } from '../database';

export async function appleIapWebhookHandler(req: Request, res: Response) {
  // Acknowledge immediately to meet Apple 5s SLA
  res.status(200).send('OK');

  try {
    const { signedPayload } = req.body;
    if (!signedPayload) return;

    // 1. Decode main notification payload
    const notification = await appleSignedVerifier.verifyAndDecodeNotification(signedPayload);
    const { notificationType, subtype, data } = notification;

    if (!data?.signedTransactionInfo) return;

    // 2. Decode inner transaction JWS
    const txn = await appleSignedVerifier.verifyAndDecodeTransaction(data.signedTransactionInfo);
    const origTxnId = txn.originalTransactionId;

    console.log(`[Apple ASSN v2] Received ${notificationType} (${subtype}) for origTxn: ${origTxnId}`);

    // 3. Log event
    await db.appleIapEvents.create({
      notificationUuid: notification.notificationUUID,
      notificationType,
      subtype,
      originalTransactionId: origTxnId,
      transactionId: txn.transactionId,
      rawPayload: notification
    });

    // 4. Update Subscription status in DB
    switch (notificationType) {
      case 'DID_RENEW':
        await db.sellerSubscriptions.updateOne(
          { originalTransactionId: origTxnId },
          {
            status: 'ACTIVE',
            latestTransactionId: txn.transactionId,
            currentPeriodEnd: new Date(txn.expiresDate!)
          }
        );
        break;

      case 'DID_FAIL_TO_RENEW':
        if (subtype === 'GRACE_PERIOD') {
          await db.sellerSubscriptions.updateOne(
            { originalTransactionId: origTxnId },
            { status: 'IN_GRACE_PERIOD' }
          );
        }
        break;

      case 'EXPIRED':
        await db.sellerSubscriptions.updateOne(
          { originalTransactionId: origTxnId },
          { status: 'EXPIRED' }
        );
        break;

      case 'REFUND':
      case 'REVOKE':
        await db.sellerSubscriptions.updateOne(
          { originalTransactionId: origTxnId },
          { status: 'REVOKED' }
        );
        break;
    }
  } catch (error) {
    console.error('Error processing Apple Webhook:', error);
  }
}
```

---

## 7. Frontend (Flutter) Integration Guide

### Dependencies & Setup

In `pubspec.yaml`:
```yaml
dependencies:
  flutter:
    sdk: flutter
  in_app_purchase: ^3.2.0
  in_app_purchase_storekit: ^0.3.18 # StoreKit 2 implementation
```

In `ios/Runner/Info.plist`:
Ensure your bundle identifier matches `App Store Connect` exactly.

---

### StoreKit 2 Purchase Service (`lib/core/services/iap_service.dart`)

```dart
import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_storekit/in_app_purchase_storekit.dart';
import 'package:in_app_purchase_storekit/store_kit_2_addition.dart';
import '../network/api_client.dart';

class IapService extends GetxService {
  final InAppPurchase _iap = InAppPurchase.instance;
  final ApiClient _apiClient = Get.find<ApiClient>();

  late StreamSubscription<List<PurchaseDetails>> _subscription;
  final RxBool isAvailable = false.obs;
  final RxBool isPurchasing = false.obs;
  
  // Pending target planId to correlate with transaction
  String? _pendingPlanId;

  @override
  void onInit() {
    super.onInit();
    if (Platform.isIOS) {
      _initialize();
    }
  }

  Future<void> _initialize() async {
    isAvailable.value = await _iap.isAvailable();
    if (!isAvailable.value) return;

    final purchaseStream = _iap.purchaseStream;
    _subscription = purchaseStream.listen(
      _onPurchaseUpdate,
      onDone: () => _subscription.cancel(),
      onError: (err) => debugPrint('[IAP] Purchase stream error: $err'),
    );
  }

  /// 1. Fetch available products from Backend + StoreKit
  Future<List<ProductDetails>> fetchProducts() async {
    // A. Fetch mapped IDs from Backend
    final res = await _apiClient.get('/mobileapi/seller/iap/products');
    if (res.status.hasError || res.body['products'] == null) return [];

    final List productsJson = res.body['products'];
    final Set<String> productIds = productsJson
        .map<String>((e) => e['appleProductId'] as String)
        .toSet();

    // B. Query StoreKit 2 for localized pricing
    final ProductDetailsResponse response = await _iap.queryProductDetails(productIds);
    if (response.error != null) {
      debugPrint('[IAP] StoreKit query error: ${response.error}');
      return [];
    }
    return response.productDetails;
  }

  /// 2. Initiate Subscription Purchase
  Future<void> buySubscription({
    required ProductDetails productDetails,
    required String planId,
  }) async {
    _pendingPlanId = planId;
    isPurchasing.value = true;

    final PurchaseParam purchaseParam = PurchaseParam(productDetails: productDetails);
    
    // Auto-renewable subscriptions use buyNonConsumable
    await _iap.buyNonConsumable(purchaseParam: purchaseParam);
  }

  /// 3. Handle incoming StoreKit 2 transactions
  Future<void> _onPurchaseUpdate(List<PurchaseDetails> purchaseDetailsList) async {
    for (final purchase in purchaseDetailsList) {
      switch (purchase.status) {
        case PurchaseStatus.pending:
          isPurchasing.value = true;
          break;

        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          await _verifyAndCompletePurchase(purchase);
          break;

        case PurchaseStatus.error:
          isPurchasing.value = false;
          Get.snackbar('Purchase Failed', purchase.error?.message ?? 'Transaction cancelled');
          if (purchase.pendingCompletePurchase) {
            await _iap.completePurchase(purchase);
          }
          break;

        case PurchaseStatus.canceled:
          isPurchasing.value = false;
          if (purchase.pendingCompletePurchase) {
            await _iap.completePurchase(purchase);
          }
          break;
      }
    }
  }

  /// 4. Verify with Meem Backend and complete transaction
  Future<void> _verifyAndCompletePurchase(PurchaseDetails purchase) async {
    try {
      // Extract StoreKit 2 JWS token
      final String jwsToken = purchase.verificationData.serverVerificationData;

      final response = await _apiClient.post(
        '/mobileapi/seller/iap/verify-purchase',
        {
          'planId': _pendingPlanId,
          'jwsRepresentation': jwsToken,
        },
      );

      if (response.isOk && response.body['success'] == true) {
        // Step 12: Acknowledge & close transaction queue
        if (purchase.pendingCompletePurchase) {
          await _iap.completePurchase(purchase);
        }
        Get.snackbar('Success', 'Your subscription is now active!');
      } else {
        Get.snackbar('Verification Failed', response.body['message'] ?? 'Could not activate plan');
      }
    } catch (e) {
      debugPrint('[IAP] Verification exception: $e');
    } finally {
      isPurchasing.value = false;
      _pendingPlanId = null;
    }
  }

  /// 5. Restore Past Purchases (Mandatory for App Store Review)
  Future<void> restorePurchases() async {
    isPurchasing.value = true;
    try {
      await _iap.restorePurchases();
    } catch (e) {
      Get.snackbar('Restore Failed', e.toString());
      isPurchasing.value = false;
    }
  }

  @override
  void onClose() {
    if (Platform.isIOS) {
      _subscription.cancel();
    }
    super.onClose();
  }
}
```

---

### Restore Purchases Workflow

Apple requires that any app offering auto-renewable subscriptions provide a user-accessible **"Restore Purchases"** button.

1. Add a **"Restore Purchases"** button on the Subscription UI (e.g. in the AppBar or below the plans list).
2. When pressed:
   ```dart
   final iapService = Get.find<IapService>();
   await iapService.restorePurchases();
   ```
3. StoreKit restores valid past transactions, sending them to `_onPurchaseUpdate` with `PurchaseStatus.restored`.
4. Your service sends the restored JWS to `/mobileapi/seller/iap/verify-purchase`, restoring the seller's plan.

---

### Guideline 3.1 Paywall Compliance Checklist

To pass Apple App Review, the subscription screen (`subscription_plans_view.dart`) must satisfy these criteria:

- [ ] **No External Payment Buttons on iOS**: Do not render Stripe/external web checkout links (`_showPaymentUrlDialog`) when running on iOS (`if (Platform.isIOS)`).
- [ ] **Dynamic Localized Pricing**: Show price strings formatted by StoreKit (e.g., `$9.99/mo`, `SAR 39.99/mo`), never hardcoded currency.
- [ ] **Plan Title & Duration**: Clearly state the billing duration (e.g., "Gold Tier - Monthly auto-renewing subscription").
- [ ] **Links to Legal Documents**:
  - Direct clickable link to **Terms of Use (EULA)**: Apple recommends using Apple's standard EULA (`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`) or your custom terms.
  - Direct clickable link to your **Privacy Policy**.
- [ ] **Cancellation Disclosure**: Include a note explaining: *"Payment will be charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your Apple ID Settings."*

---

## 8. Testing & Sandbox Verification Strategy

### 8.1 Create App Store Connect Sandbox Testers
1. In App Store Connect, go to **Users and Access** > **Sandbox** > **Testers**.
2. Add a new sandbox tester email (must not be an existing real Apple ID).

### 8.2 Testing in iOS Simulator / Device
1. On a physical iOS device, go to **Settings** > **App Store** > **Sandbox Account**.
2. Sign in with the Sandbox tester credentials.
3. In Sandbox, subscription durations are accelerated:
   - 1 Month subscription = 5 minutes
   - 1 Year subscription = 1 hour
   - Auto-renews a maximum of 6 times before expiring.

### 8.3 StoreKit Testing in Xcode (`.storekit` Configuration File)
For local testing without connecting to App Store servers:
1. In Xcode: **File** > **New** > **File...** > **StoreKit Configuration File**.
2. Add your products and subscription groups locally.
3. Edit your Xcode Scheme > **Run** > **Options** > Set **StoreKit Configuration** to your `.storekit` file.
4. Test purchases, renewals, and refunds instantly in the Xcode Transaction Manager.

---

## 9. Common Pitfalls & Apple App Review Rejection Prevention

| Rejection Trigger | Apple Guideline | How to Prevent |
| :--- | :--- | :--- |
| **External Payment Gateway on iOS** | **3.1.1** | Always wrap external checkout URL buttons inside `if (!Platform.isIOS)`. On iOS, only trigger StoreKit. |
| **Missing "Restore Purchases" Button** | **3.1.1** | Provide a visible "Restore Purchases" button on the paywall screen. |
| **Missing Terms of Use (EULA) or Privacy Policy** | **3.1.2** | Add active hyperlinks to both Terms of Service and Privacy Policy on the paywall. |
| **Premature `completePurchase` Call** | Technical Bug | Never call `completePurchase` before backend verification succeeds. If called early and backend verification fails, the user is charged by Apple with no active subscription in DB. |
| **Hardcoded Prices** | **3.1.1** | Retrieve prices via StoreKit's `productDetails.price` string instead of hardcoding dollar amounts. |
| **Account Desynchronization** | Architecture | Store `originalTransactionId` as the unique anchor key. Even if Apple issues new `transactionId`s on renewal, `originalTransactionId` remains identical throughout the entire lifecycle. |

---

### Summary Checklist for Deployment

1. **Backend**:
   - [ ] Deployed `/mobileapi/seller/iap/products`
   - [ ] Deployed `/mobileapi/seller/iap/verify-purchase` with JWS certificate validation
   - [ ] Deployed `/api/webhooks/apple-iap` with ASSN v2 parsing
   - [ ] Stored `.p8` key, Key ID, and Issuer ID in backend environment variables
2. **Frontend (Flutter)**:
   - [ ] Integrated `in_app_purchase` & StoreKit 2 stream listener
   - [ ] Replaced web checkout dialog on iOS with native StoreKit purchase modal
   - [ ] Added "Restore Purchases" button
   - [ ] Added Terms of Use (EULA) and Privacy Policy links
3. **App Store Connect**:
   - [ ] Subscription products created and linked in a Subscription Group
   - [ ] Webhook URL registered under App Store Server Notifications v2
   - [ ] Tested end-to-end with Sandbox tester account
