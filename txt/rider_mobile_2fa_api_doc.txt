================================================================================
RIDER MOBILE APP - 2FA OTP LOGIN API INTEGRATION GUIDE
================================================================================

1. FLOW OVERVIEW
--------------------------------------------------------------------------------
When a Rider logs in using Email or Phone Number and Password:
1. The server verifies the credentials, role (RIDER), and rider account status (suspension/approval).
2. The server generates a secure 6-digit OTP code and dispatches it:
   - To BOTH Phone SMS and Email (if both are present on rider profile).
   - To Phone SMS only (if email is not present).
   - To Email only (if phone is not present).
3. The server responds with HTTP 200, requiresOtp: true, and a temporary preAuthToken.
4. The Rider Mobile App displays the 6-digit OTP Verification Screen.
5. Rider enters the 6-digit code -> App calls /mobileapi/rider/auth/verify-2fa (optionally sending FCM token and device ID).
6. Server validates the OTP -> Automatically registers/updates the rider's device token, and returns the final Bearer tokens (accessToken, refreshToken) along with the complete Rider Profile data.


2. API ENDPOINTS
--------------------------------------------------------------------------------
- Step 1 (Login & Trigger 2FA):
  POST /mobileapi/rider/auth/login

- Step 2 (Verify OTP & Complete Login):
  POST /mobileapi/rider/auth/verify-2fa

- Step 3 (Resend OTP):
  POST /mobileapi/rider/auth/resend-2fa


3. DETAILED API SPECIFICATIONS
--------------------------------------------------------------------------------

--------------------------------------------------------------------------------
STEP 1: PASSWORD LOGIN (INITIATES 2FA OTP)
--------------------------------------------------------------------------------
URL: /mobileapi/rider/auth/login
Method: POST
Headers:
  Content-Type: application/json

Request Body:
{
  "email": "rider@example.com",     // OR "phone": "9876543210" or "identifier"
  "password": "riderpassword123"
}

[SUCCESS RESPONSE - HTTP 200 OK]
{
  "success": true,
  "requiresOtp": true,
  "message": "Verification code sent to your registered mobile number and email.",
  "data": {
    "preAuthToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "maskedPhone": "+91 *******3210",
    "maskedEmail": "r***@example.com",
    "channels": ["SMS", "EMAIL"],
    "expiresIn": 300,
    "resendCooldown": 60
  }
}

Mobile Developer Action:
- Store "preAuthToken" in screen state or memory.
- Display message to user: e.g. "OTP sent to +91 *******3210 and r***@example.com".
- Navigate to 6-digit OTP Verification Screen.
- Start 60-second timer for Resend button.

[ERROR RESPONSES]
- Invalid credentials (HTTP 401):
  { "success": false, "error": "Invalid email/phone or password" }

- Account suspended (HTTP 403):
  { "success": false, "error": "Your rider account has been suspended. Please contact support.", "isSuspended": true }


--------------------------------------------------------------------------------
STEP 2: VERIFY 2FA OTP (COMPLETES LOGIN)
--------------------------------------------------------------------------------
URL: /mobileapi/rider/auth/verify-2fa
Method: POST
Headers:
  Content-Type: application/json

Request Body:
{
  "preAuthToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "otp": "123456",
  "deviceId": "device_uuid_98765",         // Optional: Device Hardware UUID
  "platform": "android",                   // Optional: "android" | "ios"
  "deviceToken": "fcm_push_token_xyz...",  // Optional: FCM Push notification token
  "userAgent": "MeeemRiderApp/1.0"         // Optional: Client User Agent
}

[SUCCESS RESPONSE - HTTP 200 OK]
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "usr_rider_999",
      "name": "Alex Rider",
      "email": "rider@example.com",
      "phone": "9876543210",
      "role": "RIDER"
    },
    "rider": {
      "id": "rider_profile_01",
      "isApproved": true,
      "isSuspended": false,
      "status": "APPROVED",
      "onboardingCompleted": true,
      "isFirstLogin": false,
      "vehicleTypes": ["BIKE"],
      "vehicleNumber": "DL 01 AB 1234",
      "drivingLicenseNo": "DL-1234567890",
      "profileImage": "https://example.com/profiles/rider.jpg",
      "selectedZones": ["North Zone"],
      "selectedLocations": []
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 604800
    },
    "sessionInfo": {
      "expiresIn": 604800,
      "tokenType": "Bearer"
    }
  }
}

Mobile Developer Action:
- Save accessToken and refreshToken securely (Keychain / EncryptedSharedPreferences).
- Clear preAuthToken from memory.
- Check rider.onboardingCompleted / rider.isApproved to route to Onboarding or Rider Duty Dashboard.

[ERROR RESPONSES]
- Invalid OTP (HTTP 400):
  { "success": false, "error": "Invalid verification code. 4 attempts remaining." }

- Max attempts exceeded (HTTP 400):
  { "success": false, "error": "Too many invalid attempts. This verification code has expired. Please request a new code.", "codeExpired": true }

- Code expired after 5 minutes (HTTP 400):
  { "success": false, "error": "Verification code has expired. Please request a new one.", "codeExpired": true }

- Pre-auth session expired after 10 minutes (HTTP 400):
  { "success": false, "error": "Verification session has expired. Please log in again.", "sessionExpired": true }
  (Action: Navigate user back to Login screen)

- Rider suspended (HTTP 403):
  { "success": false, "error": "Your rider account has been suspended. Please contact support.", "isSuspended": true }


--------------------------------------------------------------------------------
STEP 3: RESEND 2FA OTP
--------------------------------------------------------------------------------
URL: /mobileapi/rider/auth/resend-2fa
Method: POST
Headers:
  Content-Type: application/json

Request Body:
{
  "preAuthToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

[SUCCESS RESPONSE - HTTP 200 OK]
{
  "success": true,
  "message": "Verification code resent successfully.",
  "data": {
    "preAuthToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "resendCooldown": 60
  }
}

Mobile Developer Action:
- Update stored preAuthToken with data.preAuthToken.
- Reset the 60-second cooldown timer on the UI.

[ERROR RESPONSES]
- Cooldown still active (HTTP 400):
  { "success": false, "error": "Please wait 45 seconds before requesting another code.", "cooldownRemaining": 45 }


4. CLIENT CONFIGURATION & UI GUIDELINES
--------------------------------------------------------------------------------
- OTP Length: 6 Digits
- OTP Code Expiry: 5 Minutes (300 seconds)
- Resend Cooldown: 60 Seconds
- Pre-Auth Session Expiry: 10 Minutes (600 seconds)
- Keyboard Type: Numeric / Number Pad
- iOS AutoFill: textContentType="oneTimeCode"
- Auto-Submit: Trigger verify-2fa automatically as soon as the 6th digit is typed.
- FCM Push Registration: Passing deviceId, platform, and deviceToken in verify-2fa automatically stores the push token for order delivery notifications.
================================================================================
