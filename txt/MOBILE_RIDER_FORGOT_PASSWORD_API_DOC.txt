================================================================================
RIDER MOBILE APP - FORGOT PASSWORD & RESET PASSWORD API DOCUMENTATION
================================================================================

1. FLOW OVERVIEW
--------------------------------------------------------------------------------
1. Rider taps "Forgot Password?" on the Rider Mobile App Login screen.
2. Rider enters their registered Email or Phone number.
3. Mobile App calls:
   POST /mobileapi/rider/auth/forgot-password/send-otp
4. Server validates:
   - Account exists with role: RIDER.
   - Rider account is not suspended (status is active).
5. Server generates a 6-digit OTP code (valid for 10 minutes):
   - Dispatches SMS instantly to the rider's phone (clean transactional text, no link, delivers in 1-2 seconds).
   - Dispatches Email with the 6-digit reset code and instructions.
6. Server responds with HTTP 200, resendCooldown: 60 (seconds), and expiresIn: 600.
7. Mobile App opens the Reset Password screen:
   - Starts a 60-second countdown for the "Resend OTP" button.
   - Rider enters: 6-digit OTP, New Password, Confirm New Password.
8. Mobile App calls:
   POST /mobileapi/rider/auth/forgot-password/reset
9. Server verifies OTP, checks rate limits, hashes new password with bcrypt, clears OTP from DB, and updates rider state.
10. Mobile App displays success toast ("Password reset successfully. You can now log in.") and redirects rider to Rider Login screen.


================================================================================
2. API ENDPOINTS
================================================================================
Base URL: https://your-domain.com (or local dev URL)

1. Send / Resend OTP:
   POST /mobileapi/rider/auth/forgot-password/send-otp

2. Verify OTP & Reset Password:
   POST /mobileapi/rider/auth/forgot-password/reset


================================================================================
3. DETAILED API SPECIFICATIONS
================================================================================

--------------------------------------------------------------------------------
STEP 1: SEND OTP (FORGOT PASSWORD INITIATION)
--------------------------------------------------------------------------------
URL: /mobileapi/rider/auth/forgot-password/send-otp
Method: POST
Headers:
  Content-Type: application/json

Request Body Option A (Recommended - single input field):
{
  "identifier": "rider@example.com"      // OR mobile number: "+23276123456" or "076123456"
}

Request Body Option B (Explicit email):
{
  "email": "rider@example.com"
}

Request Body Option C (Explicit phone):
{
  "phone": "+23276123456"                // With or without country code
}

[SUCCESS RESPONSE - HTTP 200 OK]
{
  "success": true,
  "message": "Password reset OTP has been sent to your email and phone.",
  "data": {
    "email": "rider@example.com",
    "phone": "+23276123456",
    "expiresIn": 600,                    // 600 seconds = 10 minutes
    "resendCooldown": 60                 // 60 seconds countdown for Resend button
  }
}

[COOLDOWN ERROR RESPONSE - HTTP 429 Too Many Requests]
{
  "success": false,
  "error": "Please wait 45 seconds before requesting another OTP."
}

[VALIDATION ERROR - HTTP 400 Bad Request]
{
  "success": false,
  "error": "Email or phone number is required."
}


--------------------------------------------------------------------------------
STEP 2: RESET PASSWORD (VERIFY OTP & SET NEW PASSWORD)
--------------------------------------------------------------------------------
URL: /mobileapi/rider/auth/forgot-password/reset
Method: POST
Headers:
  Content-Type: application/json

Request Body:
{
  "identifier": "rider@example.com",     // OR email / phone used in Step 1
  "otp": "123456",                       // 6-digit numeric OTP code
  "newPassword": "newRiderPassword123"   // Minimum 6 characters
}

Or with separate fields:
{
  "email": "rider@example.com",          // OR "phone": "+23276123456"
  "otp": "123456",
  "newPassword": "newRiderPassword123"
}

[SUCCESS RESPONSE - HTTP 200 OK]
{
  "success": true,
  "message": "Password reset successful. You can now log in with your new password.",
  "data": {
    "email": "rider@example.com",
    "loginAvailable": true
  }
}

[INVALID OR EXPIRED OTP - HTTP 400 Bad Request]
{
  "success": false,
  "error": "Invalid or expired OTP code."
}

[VALIDATION ERROR - HTTP 400 Bad Request]
{
  "success": false,
  "error": "Password must be at least 6 characters."
}

[RATE LIMIT EXCEEDED - HTTP 429 Too Many Requests]
{
  "success": false,
  "error": "Too many failed attempts. Try again in 15 minute(s)."
}


================================================================================
4. MOBILE APP IMPLEMENTATION CHECKLIST FOR DEVELOPERS
================================================================================
1. [Screen 1: Forgot Password]:
   - Input: Single text field accepting Email or Phone number ("identifier").
   - Button: "Send 6-Digit OTP".
   - When clicked, call /send-otp. On HTTP 200, navigate to Screen 2.

2. [Screen 2: Reset Password]:
   - Input 1: 6-digit OTP code box (numeric keypad, autofocus, maxLength=6).
   - Input 2: New Password (with eye toggle icon).
   - Input 3: Confirm New Password (validate client-side match).
   - "Resend OTP" button: Start 60-second timer from `data.resendCooldown`.
     Keep disabled until timer reaches 0. Tapping it calls /send-otp again.
   - Button: "Reset Password & Sign In".
   - When clicked, call /reset. On HTTP 200, show success message and navigate to Rider Login screen.
================================================================================
