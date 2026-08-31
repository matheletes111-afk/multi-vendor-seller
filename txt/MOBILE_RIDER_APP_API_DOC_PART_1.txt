================================================================================
MEEEM DELIVERY NETWORK — RIDER MOBILE APP API DOCUMENTATION
================================================================================
Version: 1.0.0
Base URL: https://<domain>/mobileapi/rider
Authentication Scheme: Bearer Token (JWT)
Header: Authorization: Bearer <accessToken>
Token Validity: Access Token (2 Days), Refresh Token (30 Days)
Target Platforms: Android (Kotlin / Flutter / React Native), iOS (Swift / Flutter / React Native)

--------------------------------------------------------------------------------
TABLE OF CONTENTS
--------------------------------------------------------------------------------
1. GLOBAL AUTHENTICATION ARCHITECTURE
2. RIDER REGISTRATION & OTP VERIFICATION
   2.1 Self-Registration
   2.2 Verify Registration OTP
   2.3 Resend Registration OTP
3. RIDER LOGIN & SESSION LIFECYCLE
   3.1 Email & Password Login (With Auto Device-Token Registration)
   3.2 Mobile SMS Phone OTP Login (Send OTP & Verify OTP)
   3.3 Refresh JWT Tokens
4. FORGOT & RESET PASSWORD FLOW
   4.1 Send Reset OTP
   4.2 Reset Password
5. FIRST-TIME ONBOARDING FLOW
   5.1 Submit Onboarding (Multipart/Form-Data & JSON)
6. RIDER PROFILE MANAGEMENT
   6.1 Get Profile
   6.2 Update Profile
7. RIDER SETTINGS & PREFERENCES
   7.1 Get Full Settings
   7.2 Update Settings & Password
8. DELIVERY ZONES & HIERARCHICAL LOCATIONS
   8.1 Get All Delivery Zones & Internal Regions
9. MULTI-DEVICE PUSH TOKEN MANAGEMENT (FCM / APNS)
   9.1 Register / Update Device Token
   9.2 Unregister Token on Logout
10. GLOBAL ERROR & STATUS CODE DICTIONARY

================================================================================
1. GLOBAL AUTHENTICATION ARCHITECTURE
================================================================================
- All protected endpoints require standard HTTP Authorization header:
  `Authorization: Bearer <accessToken>`
- Passwords must be at least 6 characters.
- Phone numbers must include country code (e.g., `+232` for Sierra Leone or `+91` for India).
- Suspended riders receive HTTP 403 Forbidden with `{ "isSuspended": true, "authStatus": "SUSPENDED" }`.

================================================================================
2. RIDER REGISTRATION & OTP VERIFICATION
================================================================================

--------------------------------------------------------------------------------
2.1 Rider Self-Registration
--------------------------------------------------------------------------------
Endpoint: POST /mobileapi/rider/auth/register
Content-Type: application/json
Auth Required: No

REQUEST PAYLOAD:
{
  "name": "Ibrahim Koroma",
  "email": "rider.ibrahim@example.com",
  "password": "SecurePassword123!",
  "phone": "76123456",
  "phoneCountryCode": "+232"
}

SUCCESS RESPONSE (201 Created):
{
  "success": true,
  "message": "Registration successful. Please verify your email with the 6-digit OTP sent.",
  "data": {
    "userId": "cuid_string_here",
    "email": "rider.ibrahim@example.com",
    "name": "Ibrahim Koroma",
    "role": "RIDER",
    "requiresVerification": true,
    "verificationDetails": {
      "method": "OTP",
      "expiresIn": 600,
      "resendCooldown": 60
    },
    "verifyUrl": "/mobileapi/rider/auth/verify-otp"
  }
}

ERROR RESPONSES:
- 400 Bad Request (Duplicate Email/Phone):
  { "success": false, "error": "Email or phone number is already registered" }
- 400 Bad Request (Weak Password):
  { "success": false, "error": "Password must be at least 6 characters" }

--------------------------------------------------------------------------------
2.2 Verify Registration OTP
--------------------------------------------------------------------------------
Endpoint: POST /mobileapi/rider/auth/verify-otp
Content-Type: application/json
Auth Required: No

REQUEST PAYLOAD:
{
  "email": "rider.ibrahim@example.com",
  "otp": "482910"
}

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "message": "Email verified successfully! You can now log in to complete your rider onboarding.",
  "data": {
    "email": "rider.ibrahim@example.com",
    "isEmailVerified": true,
    "loginAvailable": true,
    "onboardingCompleted": false
  }
}

ERROR RESPONSE:
- 400 Bad Request:
  { "success": false, "error": "Invalid or expired OTP code." }

--------------------------------------------------------------------------------
2.3 Resend Registration OTP
--------------------------------------------------------------------------------
Endpoint: POST /mobileapi/rider/auth/resend-otp
Content-Type: application/json
Auth Required: No

REQUEST PAYLOAD:
{
  "email": "rider.ibrahim@example.com"
}

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "message": "New verification code has been sent.",
  "data": {
    "email": "rider.ibrahim@example.com",
    "expiresIn": 600,
    "resendCooldown": 60
  }
}

================================================================================
3. RIDER LOGIN & SESSION LIFECYCLE
================================================================================

--------------------------------------------------------------------------------
3.1 Rider Login (With Auto Device Token Registration)
--------------------------------------------------------------------------------
Endpoint: POST /mobileapi/rider/auth/login
Content-Type: application/json
Auth Required: No

REQUEST PAYLOAD:
{
  "email": "rider.ibrahim@example.com",
  "password": "SecurePassword123!",
  "deviceId": "android-uuid-12345",
  "platform": "android",
  "deviceToken": "fcm_or_apns_token_string_here",
  "userAgent": "MEEEM-Rider-Android/1.0.0 (Samsung Galaxy S22)"
}

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "cm7abc123000",
      "email": "rider.ibrahim@example.com",
      "name": "Ibrahim Koroma",
      "role": "RIDER",
      "phone": "76123456",
      "phoneCountryCode": "+232",
      "image": "https://s3.amazonaws.com/meeem/riders/profiles/...",
      "isEmailVerified": true,
      "createdAt": "2026-08-26T10:00:00.000Z"
    },
    "rider": {
      "id": "cm7rider0001",
      "isApproved": true,
      "isSuspended": false,
      "status": "APPROVED",
      "onboardingCompleted": true,
      "isFirstLogin": false,
      "vehicleTypes": ["2_WHEELER"],
      "vehicleNumber": "SL-AA-9988",
      "drivingLicenseNo": "DL-10928374",
      "profileImage": "https://s3.amazonaws.com/meeem/riders/profiles/...",
      "selectedZones": ["ZONE 1", "ZONE 2"],
      "selectedLocations": ["NO 2 RIVER", "BAW BAW", "HAMILTON", "LAKKA"]
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 172800
    },
    "sessionInfo": {
      "expiresIn": 172800,
      "tokenType": "Bearer"
    }
  }
}

NAVIGATION LOGIC FOR MOBILE CLIENTS:
1. If `isEmailVerified === false`: Redirect user to OTP verification screen.
2. If `onboardingCompleted === false` OR `isFirstLogin === true`: Redirect user to Onboarding wizard.
3. If `isSuspended === true` OR `status === "SUSPENDED"`: Block access and show "Account Suspended" view.
4. Otherwise: Navigate directly to Rider Dashboard / Orders view.

--------------------------------------------------------------------------------
3.2 Mobile SMS Phone OTP Login
--------------------------------------------------------------------------------

A) Send Login OTP via SMS
Endpoint: POST /mobileapi/rider/auth/phone-otp/send-otp
Content-Type: application/json
Auth Required: No

REQUEST PAYLOAD:
{
  "phone": "+23276123456"
}
Note: Accepts E.164 format with country code (e.g. "+23276123456" or "+919876543210").

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "message": "Login OTP sent to your phone.",
  "data": {
    "phone": "+23276123456",
    "expiresIn": 600,
    "resendCooldown": 60
  }
}

ERROR RESPONSES:
- 400 Bad Request: { "success": false, "error": "Enter a valid phone number with country code. Example: +23276123456" }
- 404 Not Found: { "success": false, "error": "No rider account found with this phone number." }
- 403 Forbidden: { "success": false, "error": "Your rider account has been suspended. Please contact support.", "isSuspended": true }
- 429 Too Many Requests: { "success": false, "error": "Please wait 45 seconds before requesting another OTP." }

B) Verify Login OTP & Obtain Session Tokens
Endpoint: POST /mobileapi/rider/auth/phone-otp/verify-otp
Content-Type: application/json
Auth Required: No

REQUEST PAYLOAD:
{
  "phone": "+23276123456",
  "otp": "492018",
  "deviceId": "android-uuid-12345",
  "platform": "android",
  "deviceToken": "fcm_token_here",
  "userAgent": "MEEEM-Rider-Android/1.0.0 (Samsung Galaxy S22)"
}

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "cm7abc123000",
      "email": "rider.ibrahim@example.com",
      "name": "Ibrahim Koroma",
      "role": "RIDER",
      "phone": "+23276123456",
      "phoneCountryCode": "+232",
      "image": "https://...",
      "isEmailVerified": true,
      "createdAt": "2026-08-26T10:00:00.000Z"
    },
    "rider": {
      "id": "cm7rider0001",
      "isApproved": true,
      "isSuspended": false,
      "status": "APPROVED",
      "onboardingCompleted": true,
      "isFirstLogin": false,
      "vehicleTypes": ["2_WHEELER"],
      "vehicleNumber": "SL-AA-9988",
      "drivingLicenseNo": "DL-10928374",
      "profileImage": "https://...",
      "selectedZones": ["ZONE 1", "ZONE 2"],
      "selectedLocations": ["NO 2 RIVER", "BAW BAW", "HAMILTON", "LAKKA"]
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 172800
    },
    "sessionInfo": {
      "expiresIn": 172800,
      "tokenType": "Bearer"
    }
  }
}

ERROR RESPONSES:
- 400 Bad Request: { "success": false, "error": "Invalid OTP." }
- 400 Bad Request: { "success": false, "error": "OTP has expired. Please request a new one." }
- 429 Too Many Requests: { "success": false, "error": "Too many failed attempts. Try again in 5 minute(s)." }

--------------------------------------------------------------------------------
3.3 Refresh JWT Tokens
--------------------------------------------------------------------------------
Endpoint: POST /mobileapi/rider/auth/refresh
Content-Type: application/json
Auth Required: No

REQUEST PAYLOAD:
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 172800,
    "tokenType": "Bearer"
  }
}

================================================================================
4. FORGOT & RESET PASSWORD FLOW
================================================================================

--------------------------------------------------------------------------------
4.1 Send Reset OTP (via Email or Mobile SMS)
--------------------------------------------------------------------------------
Endpoint: POST /mobileapi/rider/auth/forgot-password/send-otp
Content-Type: application/json
Auth Required: No

REQUEST PAYLOAD (Email OR Phone):
Option A (By Email):
{
  "email": "rider.ibrahim@example.com"
}

Option B (By Phone):
{
  "phone": "+23276123456"
}

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "message": "If an active rider account exists, a reset OTP has been sent.",
  "data": {
    "email": "rider.ibrahim@example.com",
    "expiresIn": 600,
    "resendCooldown": 60
  }
}

--------------------------------------------------------------------------------
4.2 Reset Password
--------------------------------------------------------------------------------
Endpoint: POST /mobileapi/rider/auth/forgot-password/reset
Content-Type: application/json
Auth Required: No

REQUEST PAYLOAD (Email OR Phone + OTP + New Password):
Option A (With Email):
{
  "email": "rider.ibrahim@example.com",
  "otp": "839201",
  "newPassword": "MyNewSecurePassword999!"
}

Option B (With Phone):
{
  "phone": "+23276123456",
  "otp": "839201",
  "newPassword": "MyNewSecurePassword999!"
}

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "message": "Password reset successful. You can now log in with your new password.",
  "data": {
    "email": "rider.ibrahim@example.com",
    "loginAvailable": true
  }
}

================================================================================
5. FIRST-TIME ONBOARDING FLOW
================================================================================

Endpoint: POST /mobileapi/rider/onboarding
Content-Type: multipart/form-data  (OR application/json)
Auth Required: Yes (`Authorization: Bearer <accessToken>`)

FORM-DATA / JSON PARAMETERS:
- `newPassword` (String, optional): Permanent password if rider was invited by Admin with temp password.
- `name` (String, optional): Full name.
- `phone` (String, optional): Mobile phone number.
- `phoneCountryCode` (String, optional): e.g., "+232".
- `vehicleType` (String, required): Single vehicle type operated by rider. Allowed values: `"2_WHEELER"`, `"3_WHEELER"`, `"4_WHEELER"`, `"BICYCLE"`. (Note: Riders select 1 primary vehicle).
- `vehicleTypes` (JSON String array, optional for backwards compatibility): e.g., `["2_WHEELER"]`.
- `vehicleName` (String, optional): Vehicle Brand / Model / Name (e.g. "Honda CB Shine 125", "TVS King Tricycle", "Toyota Corolla", "Trek Mountain Bike").
- `vehicleNumber` (String, optional): Registration / license plate number (e.g. "SL-AA-9988").
- `drivingLicenseNo` (String, optional): Driver's license ID number (e.g. "DL-10928374").
- `selectedZones` (JSON String array): e.g., `["ZONE 1", "ZONE 2"]`.
- `selectedLocations` (JSON String array): e.g., `["NO 2 RIVER", "BAW BAW", "LAKKA"]`.
- `profileImage` (File binary): Rider portrait photo (JPEG / PNG / WEBP).
- `drivingLicenseDoc` (File binary): License document (PDF / JPEG / PNG).
- `nationalIdDoc` (File binary): ID Card / Passport (PDF / JPEG / PNG).
- `vehicleInsuranceDoc` (File binary): Insurance certificate (PDF / JPEG / PNG).

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "message": "Rider onboarding completed successfully!",
  "data": {
    "onboardingCompleted": true,
    "rider": {
      "id": "cm7rider0001",
      "isApproved": true,
      "status": "APPROVED",
      "onboardingCompleted": true,
      "isFirstLogin": false,
      "vehicleType": "2_WHEELER",
      "vehicleTypes": ["2_WHEELER"],
      "vehicleName": "Honda CB Shine 125",
      "vehicleNumber": "SL-AA-9988",
      "drivingLicenseNo": "DL-10928374",
      "profileImage": "https://...",
      "drivingLicenseDoc": "https://...",
      "nationalIdDoc": "https://...",
      "vehicleInsuranceDoc": "https://...",
      "selectedZones": ["ZONE 1", "ZONE 2"],
      "selectedLocations": ["NO 2 RIVER", "BAW BAW"]
    }
  }
}

================================================================================
6. RIDER PROFILE MANAGEMENT
================================================================================

--------------------------------------------------------------------------------
6.1 Get Profile
--------------------------------------------------------------------------------
Endpoint: GET /mobileapi/rider/profile
Auth Required: Yes (`Authorization: Bearer <accessToken>`)

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "user": {
      "id": "cm7abc123000",
      "email": "rider.ibrahim@example.com",
      "name": "Ibrahim Koroma",
      "phone": "76123456",
      "phoneCountryCode": "+232",
      "image": "https://...",
      "isEmailVerified": true
    },
    "rider": {
      "id": "cm7rider0001",
      "isApproved": true,
      "isSuspended": false,
      "status": "APPROVED",
      "vehicleType": "2_WHEELER",
      "vehicleTypes": ["2_WHEELER"],
      "vehicleName": "Honda CB Shine 125",
      "vehicleNumber": "SL-AA-9988",
      "drivingLicenseNo": "DL-10928374",
      "profileImage": "https://...",
      "selectedZones": ["ZONE 1"],
      "selectedLocations": ["NO 2 RIVER", "BAW BAW"]
    }
  }
}

--------------------------------------------------------------------------------
6.2 Update Profile
--------------------------------------------------------------------------------
Endpoint: PATCH /mobileapi/rider/profile
Content-Type: application/json
Auth Required: Yes (`Authorization: Bearer <accessToken>`)

REQUEST PAYLOAD:
{
  "name": "Ibrahim S. Koroma",
  "phone": "76999999",
  "vehicleType": "2_WHEELER",
  "vehicleName": "Honda CB Shine 125 Super",
  "vehicleNumber": "SL-AA-9988-NEW"
}

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "message": "Profile updated successfully.",
  "data": {
    "rider": {
      "id": "cm7rider0001",
      "isApproved": true,
      "isSuspended": false,
      "status": "APPROVED",
      "vehicleTypes": ["2_WHEELER"],
      "vehicleName": "Honda CB Shine 125 Super",
      "vehicleNumber": "SL-AA-9988-NEW",
      "drivingLicenseNo": "DL-10928374"
    }
  }
}

================================================================================
7. RIDER SETTINGS & PREFERENCES
================================================================================

--------------------------------------------------------------------------------
7.1 Get Full Settings
--------------------------------------------------------------------------------
Endpoint: GET /mobileapi/rider/settings
Auth Required: Yes (`Authorization: Bearer <accessToken>`)

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "user": { ... },
    "rider": { ... },
    "registeredDevices": [
      {
        "token": "fcm_token_123",
        "deviceId": "android-uuid-1",
        "platform": "android",
        "deviceModel": "Samsung Galaxy S22",
        "lastActiveAt": "2026-08-26T12:00:00.000Z"
      }
    ]
  }
}

--------------------------------------------------------------------------------
7.2 Update Settings (Password Change / Coverage Areas / Documents)
--------------------------------------------------------------------------------
Endpoint: POST /mobileapi/rider/settings
Content-Type: multipart/form-data OR application/json
Auth Required: Yes (`Authorization: Bearer <accessToken>`)

REQUEST PAYLOAD (JSON Example for Password Change + Zones):
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword456!",
  "selectedZones": ["ZONE 1", "ZONE 2", "ZONE 3"],
  "selectedLocations": ["NO 2 RIVER", "BAW BAW", "LAKKA", "GODERICH"]
}

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "message": "Settings updated successfully!",
  "data": {
    "rider": { ... }
  }
}

================================================================================
8. DELIVERY ZONES & HIERARCHICAL LOCATIONS
================================================================================

Endpoint: GET /mobileapi/rider/zones
Auth Required: No (Public / Cacheable)

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "totalZones": 10,
    "totalLocations": 142,
    "zones": [
      {
        "id": "ZONE 1",
        "name": "ZONE 1",
        "regions": [
          { "name": "NO 2 RIVER" },
          { "name": "BAW BAW" },
          { "name": "BIG WATER" },
          { "name": "JOHN OBEY" },
          { "name": "MAMA BEACH" },
          { "name": "TOKEH" },
          { "name": "YORK" }
        ]
      },
      {
        "id": "ZONE 2",
        "name": "ZONE 2",
        "regions": [
          { "name": "HAMILTON" },
          { "name": "LAKKA" },
          { "name": "SUSSEX" },
          { "name": "KIMBO VILLAGE" }
        ]
      }
    ]
  }
}

================================================================================
9. MULTI-DEVICE PUSH TOKEN MANAGEMENT (FCM / APNS)
================================================================================

--------------------------------------------------------------------------------
9.1 Register or Update Push Token
--------------------------------------------------------------------------------
Endpoint: POST /mobileapi/rider/device-token
Content-Type: application/json
Auth Required: Yes (`Authorization: Bearer <accessToken>`)

REQUEST PAYLOAD:
{
  "token": "dK_38js02-fcm-device-token-string",
  "platform": "android",  // "android" | "ios" | "web"
  "deviceId": "unique-device-hardware-uuid",
  "deviceModel": "Google Pixel 7 Pro",
  "userAgent": "MEEEM-Rider-Android/1.0"
}

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "message": "Device token registered successfully for push notifications.",
  "data": {
    "registeredTokensCount": 2,
    "devices": [
      {
        "token": "dK_38js02-fcm-device-token-string",
        "deviceId": "unique-device-hardware-uuid",
        "platform": "android",
        "deviceModel": "Google Pixel 7 Pro",
        "lastActiveAt": "2026-08-26T14:20:00.000Z",
        "createdAt": "2026-08-26T14:20:00.000Z"
      }
    ]
  }
}

--------------------------------------------------------------------------------
9.2 Unregister Push Token (On App Logout)
--------------------------------------------------------------------------------
Endpoint: DELETE /mobileapi/rider/device-token
Content-Type: application/json
Auth Required: Yes (`Authorization: Bearer <accessToken>`)

REQUEST PAYLOAD:
{
  "token": "dK_38js02-fcm-device-token-string",
  "deviceId": "unique-device-hardware-uuid"
}

SUCCESS RESPONSE (200 OK):
{
  "success": true,
  "message": "Device token unregistered successfully.",
  "data": {
    "remainingDevicesCount": 1
  }
}

================================================================================
10. GLOBAL ERROR & STATUS CODE DICTIONARY
================================================================================
| HTTP Status | Error Scenario | Resolution |
|-------------|----------------|------------|
| 200 OK      | Operation successful | Process returned payload. |
| 201 Created | Resource created (Registration, Upload) | Proceed to next onboarding/verification step. |
| 400 Bad Req | Missing payload fields, invalid email format, invalid OTP | Prompt user with returned error message. |
| 401 Unauth  | Missing, invalid, or expired Bearer Token | Redirect to Rider Login screen. |
| 403 Forbid  | Email unverified OR Rider account suspended | Check `authStatus` field and display appropriate screen. |
| 404 Not Fnd | User/Rider profile not found | Contact platform support. |
| 429 Limit   | OTP cooldown active (wait 60s) or too many attempts | Disable resend button for remaining countdown seconds. |
| 500 Error   | Server/Database internal error | Show "Please try again in a moment". |
================================================================================
