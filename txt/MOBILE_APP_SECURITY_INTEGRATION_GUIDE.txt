================================================================================
MEEEM MOBILE APP SECURITY & API INTEGRATION GUIDE FOR MOBILE DEVELOPERS
Document Version: 1.0
Target Platforms: Android (Kotlin/Java), iOS (Swift), Flutter, React Native
Date: 05 November 2026
================================================================================

1. OVERVIEW & OBJECTIVE
--------------------------------------------------------------------------------
To protect the Meeem ecosystem against automated script attacks, fake account 
creation bursts, and Twilio SMS toll fraud, multi-layer security protections 
have been implemented across all `/mobileapi/...` endpoints.

This guide outlines the exact headers, error response structures, cooldown 
timers, and rate-limiting behaviors the mobile app must handle.


2. REQUIRED CLIENT AUTHENTICATION HEADER
--------------------------------------------------------------------------------
All requests originating from the official mobile app to any `/mobileapi/...` 
endpoint MUST include the following HTTP header:

  Header Name:  x-meeem-app-token
  Header Value: meeem_mobile_token_9e7a4b2c1d8f3056

--------------------------------------------------------------------------------
EXACT CODE EXAMPLES FOR MOBILE DEVELOPER:
--------------------------------------------------------------------------------

A. Flutter / Dart (Dio / http):
   dio.options.headers["x-meeem-app-token"] = "meeem_mobile_token_9e7a4b2c1d8f3056";

B. React Native / Axios / Fetch:
   axios.defaults.headers.common["x-meeem-app-token"] = "meeem_mobile_token_9e7a4b2c1d8f3056";
   // or in fetch:
   headers: {
     "Content-Type": "application/json",
     "x-meeem-app-token": "meeem_mobile_token_9e7a4b2c1d8f3056"
   }

C. Android (OkHttp / Retrofit in Kotlin):
   val request = originalRequest.newBuilder()
       .header("x-meeem-app-token", "meeem_mobile_token_9e7a4b2c1d8f3056")
       .build()

D. iOS (Swift / URLSession):
   request.setValue("meeem_mobile_token_9e7a4b2c1d8f3056", forHTTPHeaderField: "x-meeem-app-token")

--------------------------------------------------------------------------------

* Developer Note:
  - Store <MOBILE_APP_SECRET> securely inside native code / BuildConfig / 
    encrypted keystore / secure environment variables. Do NOT hardcode in 
    publicly exposed repositories.
  - If the secret token is missing or invalid when enforcement is turned on, 
    the backend responds with HTTP 401 Unauthorized:
    {
      "success": false,
      "error": "Missing or invalid mobile client authentication token."
    }


3. RATE LIMITING & COOLDOWN BEHAVIORS (HTTP 429)
--------------------------------------------------------------------------------
The backend tracks rate limits in PostgreSQL. If a limit is exceeded, the server 
returns HTTP Status 429 (Too Many Requests).

The mobile app must parse the `retryAfter` field and show appropriate UI timers.

A. IP RATE LIMITING (Sliding-window: Max 3 requests / minute per IP)
   - Scope: Any registration, send-otp, or forgot-password request.
   - Response when exceeded:
     HTTP/1.1 429 Too Many Requests
     Retry-After: 48
     Content-Type: application/json

     {
       "success": false,
       "error": "Too many requests from your IP. Please wait 48 seconds before trying again.",
       "retryAfter": 48
     }

B. PHONE OTP COOLDOWN (60 Seconds per phone number)
   - Scope: Requesting an SMS OTP to the same phone number.
   - Behavior: Users must wait 60 seconds between consecutive OTP dispatches.
   - Response when in cooldown:
     HTTP/1.1 429 Too Many Requests
     Retry-After: 35
     Content-Type: application/json

     {
       "success": false,
       "error": "Please wait 35 seconds before requesting another OTP.",
       "retryAfter": 35
     }
   - Mobile UI Best Practice:
     Disable the "Resend OTP" button and display a live countdown timer:
     "Resend OTP in 35s".

C. DAILY PHONE OTP LIMIT (Maximum 9 SMS per 24 hours per phone number)
   - Scope: Total SMS OTPs sent to a single phone number across all flows.
   - Response when exceeded:
     HTTP/1.1 429 Too Many Requests
     Content-Type: application/json

     {
       "success": false,
       "error": "Daily OTP verification limit (9/day) reached for this phone number. Please try again tomorrow."
     }
   - Mobile UI Best Practice:
     Show a dialog informing the user: "Daily limit reached for this phone number. 
     Please try again tomorrow or contact customer support."

D. BRUTE-FORCE OTP GUESSING LOCKOUT (5 Failed OTP attempts -> 15 min block)
   - Scope: /mobileapi/.../verify-otp endpoints.
   - Behavior: If an incorrect 6-digit OTP is entered 5 times consecutively, 
     the account is locked against verification attempts for 15 minutes.
   - Response when locked:
     HTTP/1.1 429 Too Many Requests
     Content-Type: application/json

     {
       "success": false,
       "error": "Too many failed attempts. Try again in 15 minute(s)."
     }

E. LOGIN RATE LIMITING (Max 5 password login attempts / minute per IP)
   - Scope: /mobileapi/.../login endpoints.
   - Prevents automated credential-stuffing and password brute-force attacks.
   - Response when exceeded:
     HTTP/1.1 429 Too Many Requests
     Content-Type: application/json

     {
       "success": false,
       "error": "Too many login attempts. Please wait 1 minute."
     }


4. PHONE NUMBER FORMATTING BEST PRACTICES
--------------------------------------------------------------------------------
When sending phone numbers to the API:
- Preferred: Standard E.164 format (e.g., "+23279494127").
- If splitting country code and number:
  - phone: "079494127" or "79494127"
  - phoneCountryCode: "+232"
- Ensure user input is stripped of alphabetic characters or symbols before dispatch.


5. LIST OF PROTECTED MOBILE API ENDPOINTS
--------------------------------------------------------------------------------
The following endpoints are guarded by the security layers:

A. Registration (Guarded against bot flood & pre-DB phone limit):
   - POST /mobileapi/customer/auth/register
   - POST /mobileapi/product-seller/auth/register
   - POST /mobileapi/service-seller/auth/register
   - POST /mobileapi/hotel-seller/auth/register
   - POST /mobileapi/restaurant-seller/auth/register
   - POST /mobileapi/rider/auth/register

B. Phone OTP Dispatch (Cooldown 60s & Daily Cap 9 SMS):
   - POST /mobileapi/customer/auth/phone-otp/send-otp
   - POST /mobileapi/product-seller/auth/phone-otp/send-otp
   - POST /mobileapi/service-seller/auth/phone-otp/send-otp
   - POST /mobileapi/hotel-seller/auth/phone-otp/send-otp
   - POST /mobileapi/restaurant-seller/auth/phone-otp/send-otp
   - POST /mobileapi/rider/auth/phone-otp/send-otp

C. Phone OTP Verification (5 failed attempts lockout):
   - POST /mobileapi/customer/auth/phone-otp/verify-otp
   - POST /mobileapi/product-seller/auth/phone-otp/verify-otp
   - POST /mobileapi/service-seller/auth/phone-otp/verify-otp
   - POST /mobileapi/hotel-seller/auth/phone-otp/verify-otp
   - POST /mobileapi/restaurant-seller/auth/phone-otp/verify-otp
   - POST /mobileapi/rider/auth/phone-otp/verify-otp

D. Email OTP Dispatch:
   - POST /mobileapi/customer/auth/email-otp/send-otp
   - POST /mobileapi/product-seller/auth/email-otp/send-otp
   - POST /mobileapi/service-seller/auth/email-otp/send-otp
   - POST /mobileapi/hotel-seller/auth/email-otp/send-otp
   - POST /mobileapi/restaurant-seller/auth/email-otp/send-otp

E. Forgot Password:
   - POST /mobileapi/customer/auth/forgot-password/send-otp
   - POST /mobileapi/product-seller/auth/forgot-password/send-otp
   - POST /mobileapi/service-seller/auth/forgot-password/send-otp
   - POST /mobileapi/hotel-seller/auth/forgot-password/send-otp
   - POST /mobileapi/restaurant-seller/auth/forgot-password/send-otp
   - POST /mobileapi/rider/auth/forgot-password/send-otp

F. Resend OTP & 2FA:
   - POST /mobileapi/customer/auth/resend-otp
   - POST /mobileapi/product-seller/auth/resend-otp
   - POST /mobileapi/product-seller/auth/resend-2fa
   - POST /mobileapi/service-seller/auth/resend-otp
   - POST /mobileapi/service-seller/auth/resend-2fa
   - POST /mobileapi/hotel-seller/auth/resend-otp
   - POST /mobileapi/hotel-seller/auth/resend-2fa
   - POST /mobileapi/restaurant-seller/auth/resend-otp
   - POST /mobileapi/restaurant-seller/auth/resend-2fa
   - POST /mobileapi/rider/auth/resend-otp
   - POST /mobileapi/rider/auth/resend-2fa

G. Password Login (Credential stuffing protection):
   - POST /mobileapi/customer/auth/login
   - POST /mobileapi/product-seller/auth/login
   - POST /mobileapi/service-seller/auth/login
   - POST /mobileapi/hotel-seller/auth/login
   - POST /mobileapi/restaurant-seller/auth/login
   - POST /mobileapi/rider/auth/login


6. CHECKLIST FOR MOBILE APP DEVELOPER
--------------------------------------------------------------------------------
[ ] 1. Add `x-meeem-app-token` header to HTTP client (Retrofit / Dio / Axios / Fetch).
[ ] 2. Handle HTTP 429 responses globally:
       - Read `retryAfter` integer and start a UI countdown timer.
       - Display friendly error messages from `response.error`.
[ ] 3. On OTP screens:
       - Disable resend button for 60 seconds after sending.
       - Show clear error when the 15-minute lockout or daily 9-SMS cap is triggered.
[ ] 4. Test all auth flows in staging/local development against the updated backend.
================================================================================

