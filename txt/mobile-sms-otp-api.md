# Mobile API — SMS (phone) OTP login

SMS OTP login for native apps mirrors the **web** phone OTP behaviour (`/api/.../auth/phone-otp/*`) but uses the **mobile JSON envelope** (`success`, `message`, `data`) like `.../auth/email-otp/*` under `mobileapi`.

**Panels:** customer, product seller, service seller (admin has no phone OTP on web).

**Twilio:** Same as web — `sendSmsViaTwilio` with E.164 numbers. Requires env/config used by `src/lib/twilio-sms.ts`.

**OTP storage:** Same fields as web (`verifyEmailOtp`, `emailVerificationExpires`, `emailOtpSentAt`). OTP is 6 digits; expiry **600** seconds; resend cooldown **60** seconds.

---

## 1. Customer

### `POST /mobileapi/customer/auth/phone-otp/send-otp`

**Request body**

```json
{
  "phone": "+919876543210"
}
```

`phone` must normalize to valid E.164 (see web error message for format).

**Success — 200**

```json
{
  "success": true,
  "message": "Login OTP sent successfully",
  "data": {
    "phone": "+919876543210",
    "expiresIn": 600,
    "resendCooldown": 60
  }
}
```

**Errors**

| Status | Example body |
|--------|----------------|
| 400 | `{ "success": false, "error": "Enter a valid phone number with country code. Example: +919876543210" }` |
| 404 | `{ "success": false, "error": "No customer account found with this phone number." }` |
| 429 | `{ "success": false, "error": "Please wait N seconds before requesting a new OTP", "waitTime": N }` |
| 500 | `{ "success": false, "error": "Internal server error" }` |

*Same business rules as web customer phone send: no requirement that email be verified before SMS login.*

---

### `POST /mobileapi/customer/auth/phone-otp/verify-otp`

**Request body**

```json
{
  "phone": "+919876543210",
  "otp": "123456"
}
```

**Success — 200**

```json
{
  "success": true,
  "message": "OTP login successful",
  "data": {
    "user": {
      "id": "…",
      "name": "…",
      "email": "…",
      "image": null,
      "phone": "…",
      "phoneCountryCode": "…",
      "role": "CUSTOMER",
      "isEmailVerified": true,
      "createdAt": "…",
      "updatedAt": "…"
    },
    "tokens": {
      "accessToken": "…",
      "refreshToken": "…",
      "expiresIn": 3600
    },
    "sessionInfo": {
      "expiresIn": 3600,
      "tokenType": "Bearer"
    }
  }
}
```

(`expiresIn` matches your `generateMobileTokens` implementation.)

**Errors**

| Status | Example |
|--------|---------|
| 400 | Missing/invalid phone or OTP, wrong OTP, or `{ "success": false, "error": "OTP has expired...", "expired": true }` |
| 500 | Internal error |

---

## 2. Product seller

### `POST /mobileapi/product-seller/auth/phone-otp/send-otp`

Same request shape as customer (`{ "phone": "+..." }`).

**Success — 200** — same `data` shape as customer (`phone`, `expiresIn`, `resendCooldown`).

**Extra errors (vs customer)**

| Status | Body |
|--------|------|
| 400 | `{ "success": false, "error": "Please verify your email first before OTP login." }` |
| 404 | `{ "success": false, "error": "No product seller account found with this phone number." }` |

---

### `POST /mobileapi/product-seller/auth/phone-otp/verify-otp`

**Request:** `{ "phone": "+...", "otp": "123456" }`

**Success — 200**

```json
{
  "success": true,
  "message": "OTP login successful",
  "data": {
    "user": {
      "id": "…",
      "email": "…",
      "name": "…",
      "role": "SELLER_PRODUCT",
      "phone": "…",
      "phoneCountryCode": "…",
      "isEmailVerified": true,
      "createdAt": "…",
      "updatedAt": "…",
      "sellerInfo": {
        "isApproved": true,
        "isSuspended": false,
        "type": "…"
      }
    },
    "tokens": { "accessToken": "…", "refreshToken": "…", "expiresIn": 3600 },
    "sessionInfo": { "expiresIn": 3600, "tokenType": "Bearer" }
  }
}
```

**403** (same as `mobileapi/.../email-otp/verify-otp`)

- Pending approval: `needsApproval`, `approvalStatus: "PENDING"`
- Suspended: `isSuspended: true`
- Missing seller row: seller not configured message

---

## 3. Service seller

### `POST /mobileapi/service-seller/auth/phone-otp/send-otp`

Same as product seller, with messages referring to **service seller** where applicable (`No service seller account found with this phone number.`).

### `POST /mobileapi/service-seller/auth/phone-otp/verify-otp`

Same response shape as product seller; `role` is `SELLER_SERVICE`.

---

## Web parity reference

| Web (session / cookie flow) | Mobile (JWT) |
|-----------------------------|--------------|
| `POST /api/customer/auth/phone-otp/send-otp` | `POST /mobileapi/customer/auth/phone-otp/send-otp` |
| `POST /api/customer/auth/phone-otp/verify-otp` → `otpLoginToken` | verify returns `tokens` + `user` |
| `POST /api/product-seller/auth/phone-otp/*` | `POST /mobileapi/product-seller/auth/phone-otp/*` |
| `POST /api/service-seller/auth/phone-otp/*` | `POST /mobileapi/service-seller/auth/phone-otp/*` |

---

*Last updated: mobile SMS OTP routes and payload reference.*
