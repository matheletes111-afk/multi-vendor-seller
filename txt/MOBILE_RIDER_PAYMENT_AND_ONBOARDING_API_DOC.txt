================================================================================
RIDER MOBILE APP: ONBOARDING & SETTINGS PAYMENT / PAYOUT INTEGRATION SPECIFICATION
================================================================================
Document Version: 2.0
Date: September 2026
Audience: Mobile App Developers (Flutter / React Native / Android Kotlin / iOS Swift)
Scope: Rider Onboarding Flow (Document & Payment Step), Rider Profile & Settings Management,
       and Web Admin Alignment.

--------------------------------------------------------------------------------
TABLE OF CONTENTS
--------------------------------------------------------------------------------
1. Architecture Overview & Core Rules
2. Rider Onboarding Step 2: "Documents & Payout" UI / UX Specification
3. Payment Method Dropdown Options & Conditional Input Fields
4. Data Contract & Field Validation Rules
5. Mobile API Endpoints:
   5.1 POST /mobileapi/rider/onboarding (Submit Step 2 with Payment Details)
   5.2 GET  /mobileapi/rider/settings (Fetch Rider Settings & Current Payout Info)
   5.3 POST /mobileapi/rider/settings (Update Rider Settings & Payout Info)
   5.4 GET  /mobileapi/rider/profile (Get Profile with Payment Data)
   5.5 PATCH /mobileapi/rider/profile (Update Profile Payment Details)
6. Admin Web Sync & Verification
7. Code Snippets & Implementation Examples (Dart / Flutter & JavaScript / Fetch)
8. Frequently Asked Questions & Edge Cases

================================================================================
1. ARCHITECTURE OVERVIEW & CORE RULES
================================================================================
- ZERO CASH ON DELIVERY (COD):
  All platform orders are prepaid online via escrow. Delivery riders receive their
  delivery earnings and tips directly transferred to their registered payout account
  (either Bank Transfer or Mobile Money wallet).
- SINGLE ACTIVE PAYOUT CHANNEL:
  A rider selects ONE primary payout channel at any given time. Selecting "Bank"
  preserves bank credentials and automatically clears mobile wallet details.
  Selecting "Orange Money" or "AfriMoney" preserves wallet details and clears bank credentials.
- IDENTICAL TO SELLER ONBOARDING:
  The payment option dropdown and validation logic are identical to the Seller Onboarding
  system. Mobile developers can reuse the exact same dropdown logic and input forms.

================================================================================
2. RIDER ONBOARDING STEP 2: "DOCUMENTS & PAYOUT" UI / UX SPECIFICATION
================================================================================
In the Rider Onboarding Flow, Step 2 is titled "Documents & Payout Information".

Visual Flow on Mobile Screen:
+-------------------------------------------------------------+
| Step 2 of 4: Documents & Payout Information                 |
+-------------------------------------------------------------+
| [Section A: Document Uploads]                               |
|   - Driver's License (Front & Back)                         |
|   - National ID / Passport                                  |
|   - Vehicle Registration / Insurance                        |
+-------------------------------------------------------------+
| [Section B: Payout & Payment Method]                        |
|                                                             |
|   Dropdown: Choose Payout Option *                          |
|   [  ▼ Bank  |  Orange Money  |  AfriMoney  ]               |
|                                                             |
|   --- IF "Bank" SELECTED ---                                |
|   • Bank Name * (e.g. Sierra Leone Commercial Bank)         |
|   • Branch Name (e.g. Head Office / Siaka Stevens)          |
|   • Account Holder Name * (e.g. Johnathan Doe)              |
|   • Account Number * (e.g. 003001002345678)                 |
|   • BBAN Number (Optional/Recommended)                      |
|   • Bank Address (e.g. 15 Siaka Stevens St, Freetown)       |
|                                                             |
|   --- IF "Orange Money" SELECTED ---                        |
|   • Mobile Number * (e.g. +232 76 000000)                   |
|   • Agent / Outlet Number (Optional)                        |
|   (Notice: "Preferred method set to Mobile Wallet - Orange")|
|                                                             |
|   --- IF "AfriMoney" SELECTED ---                           |
|   • Mobile Number * (e.g. +232 77 000000)                   |
|   • Agent / Outlet Number (Optional)                        |
|   (Notice: "Preferred method set to Mobile Wallet - Afri")  |
+-------------------------------------------------------------+
| [Back]                                   [Save & Continue ->]
+-------------------------------------------------------------+

================================================================================
3. PAYMENT METHOD DROPDOWN OPTIONS & CONDITIONAL INPUT FIELDS
================================================================================
Dropdown Label: "Payment Option" / "Payout Method"
Parameter Key: `paymentOption`
Allowed Values (Exact String Match):
  1. "Bank"
  2. "Orange Money"
  3. "AfriMoney"

FIELD MAPPING RULES:
--------------------------------------------------------------------------------
OPTION 1: "Bank"
- Displays:
  - bankName (Text field, Required if Bank chosen)
  - bankAddress (Text field, Optional)
  - accountHolderName (Text field, Required if Bank chosen)
  - accountNumber (Text field, Required if Bank chosen)
  - bbanNumber (Text field, Optional)
  - branchName (Text field, Optional)
- Backend Mapping:
  - preferredPayoutMethod = "Bank Transfer"
  - mobileMoneyOption = null
  - mobileNumber = null
  - agentNumber = null

--------------------------------------------------------------------------------
OPTION 2: "Orange Money"
- Displays:
  - mobileNumber (Phone field, Required, e.g. +232 76 xxx xxx)
  - agentNumber (Text field, Optional)
- Backend Mapping:
  - preferredPayoutMethod = "Mobile Wallet"
  - mobileMoneyOption = "Orange Money"
  - bankName = null, bankAddress = null, accountHolderName = null,
    accountNumber = null, bbanNumber = null, branchName = null

--------------------------------------------------------------------------------
OPTION 3: "AfriMoney"
- Displays:
  - mobileNumber (Phone field, Required, e.g. +232 77 xxx xxx)
  - agentNumber (Text field, Optional)
- Backend Mapping:
  - preferredPayoutMethod = "Mobile Wallet"
  - mobileMoneyOption = "AfriMoney"
  - bankName = null, bankAddress = null, accountHolderName = null,
    accountNumber = null, bbanNumber = null, branchName = null

================================================================================
4. DATA CONTRACT & FIELD VALIDATION RULES
================================================================================
Field Name           | Type    | Nullable | Description / Validation
---------------------|---------|----------|-------------------------------------
paymentOption        | String  | Yes      | "Bank" | "Orange Money" | "AfriMoney"
preferredPayoutMethod| String  | Yes      | "Bank Transfer" | "Mobile Wallet"
bankName             | String  | Yes      | Required if paymentOption == "Bank"
bankAddress          | String  | Yes      | Bank street / city location
accountHolderName    | String  | Yes      | Name as registered on bank account
accountNumber        | String  | Yes      | Bank account digits
bbanNumber           | String  | Yes      | Basic Bank Account Number
branchName           | String  | Yes      | Specific branch name
mobileMoneyOption    | String  | Yes      | "Orange Money" | "AfriMoney"
mobileNumber         | String  | Yes      | Required if Orange/AfriMoney chosen
agentNumber          | String  | Yes      | Optional merchant / agent ID

================================================================================
5. MOBILE API ENDPOINTS
================================================================================

--------------------------------------------------------------------------------
5.1 POST /mobileapi/rider/onboarding
--------------------------------------------------------------------------------
Purpose: Submits rider onboarding data (e.g. step 2 document & payment info).
Authentication: Bearer Token or Rider Session Cookie
Content-Type: multipart/form-data OR application/json

Request Payload Example (JSON):
```json
{
  "step": 2,
  "paymentOption": "Orange Money",
  "mobileMoneyOption": "Orange Money",
  "mobileNumber": "+23276123456",
  "agentNumber": ""
}
```

Request Payload Example for Bank (JSON):
```json
{
  "step": 2,
  "paymentOption": "Bank",
  "bankName": "Rokel Commercial Bank",
  "bankAddress": "Siaka Stevens Street, Freetown",
  "accountHolderName": "Mohamed Kamara",
  "accountNumber": "012345678901",
  "bbanNumber": "SL0010001000123456789",
  "branchName": "Freetown Main"
}
```

Request Payload Example (Multipart / Form-Data):
If the mobile app is uploading files simultaneously:
  - `step`: "2"
  - `paymentOption`: "Orange Money"
  - `mobileNumber`: "+23276123456"
  - `licenseImage`: (binary file)
  - `nationalIdImage`: (binary file)

Success Response (200 OK):
```json
{
  "success": true,
  "message": "Rider onboarding completed successfully!",
  "data": {
    "rider": {
      "id": "rider_cm123abc...",
      "vehicleType": "2_WHEELER",
      "paymentOption": "Orange Money",
      "preferredPayoutMethod": "Mobile Wallet",
      "mobileMoneyOption": "Orange Money",
      "mobileNumber": "+23276123456",
      "agentNumber": null
    },
    "onboardingCompleted": true,
    "tokens": {
      "accessToken": "eyJhbGci...",
      "refreshToken": "eyJhbGci..."
    }
  }
}
```

--------------------------------------------------------------------------------
5.2 GET /mobileapi/rider/settings
--------------------------------------------------------------------------------
Purpose: Retrieve current profile, stats, vehicle info, and payout account details.
Authentication: Bearer Token (Header: `Authorization: Bearer <accessToken>`)
Method: GET

Success Response (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_cm123abc...",
      "name": "Mohamed Kamara",
      "email": "rider@example.com",
      "phone": "+23276123456",
      "phoneCountryCode": "+232",
      "image": null
    },
    "rider": {
      "id": "rider_cm123abc...",
      "vehicleType": "2_WHEELER",
      "vehicleTypes": ["2_WHEELER"],
      "vehicleNumber": "SL-AA-1234",
      "vehicleName": "Honda CB Shine",
      "paymentOption": "Bank",
      "preferredPayoutMethod": "Bank Transfer",
      "bankName": "Rokel Commercial Bank",
      "bankAddress": "Freetown Central",
      "accountHolderName": "Mohamed Kamara",
      "accountNumber": "012345678901",
      "bbanNumber": "SL0010001000123456789",
      "branchName": "Freetown Main",
      "mobileMoneyOption": null,
      "mobileNumber": null,
      "agentNumber": null
    },
    "stats": {
      "completedDeliveriesCount": 38,
      "totalEarnings": 1450.0,
      "activeDeliveriesCount": 1
    },
    "registeredDevices": []
  }
}
```

--------------------------------------------------------------------------------
5.3 POST /mobileapi/rider/settings
--------------------------------------------------------------------------------
Purpose: Update rider settings, including changing payout method from Bank to
         Orange Money / AfriMoney or vice versa.
Authentication: Bearer Token
Content-Type: application/json or multipart/form-data
Method: POST

Request Body Example (Updating to AfriMoney via JSON):
```json
{
  "name": "Mohamed Kamara",
  "phone": "+23277998877",
  "paymentOption": "AfriMoney",
  "mobileMoneyOption": "AfriMoney",
  "mobileNumber": "+23277998877",
  "agentNumber": "AG-9081"
}
```

Success Response (200 OK):
```json
{
  "success": true,
  "message": "Settings updated successfully!",
  "data": {
    "rider": {
      "id": "rider_cm123abc...",
      "vehicleType": "2_WHEELER",
      "paymentOption": "AfriMoney",
      "preferredPayoutMethod": "Mobile Wallet",
      "mobileMoneyOption": "AfriMoney",
      "mobileNumber": "+23277998877",
      "agentNumber": "AG-9081",
      "bankName": null,
      "bankAddress": null,
      "accountHolderName": null,
      "accountNumber": null,
      "bbanNumber": null,
      "branchName": null
    }
  }
}
```

--------------------------------------------------------------------------------
5.4 GET /mobileapi/rider/profile & 5.5 PATCH /mobileapi/rider/profile
--------------------------------------------------------------------------------
Endpoint: /mobileapi/rider/profile
Authentication: Bearer Token

- GET: Returns the full rider object including all payout fields.
  Response:
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "...", "name": "...", "phone": "..." },
      "rider": {
        "id": "rider_cm123abc...",
        "vehicleType": "2_WHEELER",
        "paymentOption": "Orange Money",
        "preferredPayoutMethod": "Mobile Wallet",
        "mobileMoneyOption": "Orange Money",
        "mobileNumber": "+23276123456",
        "agentNumber": null
      }
    }
  }
  ```

- PATCH: Accepts JSON body to update rider details, including payout details.
  Body:
  ```json
  {
    "paymentOption": "Bank",
    "bankName": "Rokel Commercial Bank",
    "accountHolderName": "Mohamed Kamara",
    "accountNumber": "012345678901",
    "bbanNumber": "SL0010001000123456789",
    "branchName": "Freetown Main",
    "bankAddress": "Freetown Central"
  }
  ```
  Response:
  ```json
  {
    "success": true,
    "message": "Profile updated successfully.",
    "data": {
      "rider": {
        "id": "rider_cm123abc...",
        "vehicleType": "2_WHEELER",
        "paymentOption": "Bank",
        "preferredPayoutMethod": "Bank Transfer",
        "bankName": "Rokel Commercial Bank",
        "accountHolderName": "Mohamed Kamara",
        "accountNumber": "012345678901",
        "bbanNumber": "SL0010001000123456789",
        "branchName": "Freetown Main",
        "bankAddress": "Freetown Central",
        "mobileMoneyOption": null,
        "mobileNumber": null,
        "agentNumber": null
      }
    }
  }
  ```

================================================================================
6. ADMIN WEB SYNC & VERIFICATION
================================================================================
Delivery managers and admins can inspect and update rider payout credentials:
- Route: `/admin/riders`
- When creating a rider via "Add Delivery Rider" modal:
  Admin can select "Bank", "Orange Money", or "AfriMoney" and fill in payment info.
- When managing an existing rider via "Edit Rider" modal:
  A dedicated tab "Payout & Bank" allows modifying payment credentials, viewing
  the active payout method, and fixing any incorrect account numbers.
- Both mobile app submissions and admin updates are instantly synchronized
  in the central PostgreSQL database.

================================================================================
7. CODE SNIPPETS & IMPLEMENTATION EXAMPLES
================================================================================

### A. Flutter / Dart Dropdown & Form State Implementation
```dart
enum PaymentOption { bank, orangeMoney, afriMoney }

class RiderPayoutFormState {
  String selectedOption = "Orange Money"; // Default or loaded value
  
  // Bank fields
  TextEditingController bankNameController = TextEditingController();
  TextEditingController bankAddressController = TextEditingController();
  TextEditingController accountHolderController = TextEditingController();
  TextEditingController accountNumberController = TextEditingController();
  TextEditingController bbanController = TextEditingController();
  TextEditingController branchNameController = TextEditingController();
  
  // Mobile money fields
  TextEditingController mobileNumberController = TextEditingController();
  TextEditingController agentNumberController = TextEditingController();

  Map<String, dynamic> toPayload() {
    if (selectedOption == "Bank") {
      return {
        "paymentOption": "Bank",
        "bankName": bankNameController.text.trim(),
        "bankAddress": bankAddressController.text.trim(),
        "accountHolderName": accountHolderController.text.trim(),
        "accountNumber": accountNumberController.text.trim(),
        "bbanNumber": bbanController.text.trim(),
        "branchName": branchNameController.text.trim(),
      };
    } else {
      return {
        "paymentOption": selectedOption, // "Orange Money" or "AfriMoney"
        "mobileMoneyOption": selectedOption,
        "mobileNumber": mobileNumberController.text.trim(),
        "agentNumber": agentNumberController.text.trim(),
      };
    }
  }
}
```

### B. JavaScript / Fetch API Call (React Native or Capacitor)
```javascript
async function submitRiderOnboardingStep2(token, payoutData) {
  const response = await fetch("https://api.yourdomain.com/mobileapi/rider/onboarding", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      step: 2,
      ...payoutData
    })
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to update onboarding payout details");
  }
  return result;
}
```

================================================================================
8. FREQUENTLY ASKED QUESTIONS & EDGE CASES
================================================================================
Q1: Can a rider register both Bank and Orange Money simultaneously?
A1: No. In accordance with the single payout channel rule, only one method
    is active. If a rider switches from Bank to Orange Money, their bank details
    are safely cleared to avoid ambiguous multi-destination payouts.

Q2: Is BBAN Number required for Bank payout?
A2: No, it is optional. `bankName`, `accountHolderName`, and `accountNumber`
    are the core required fields when Bank is chosen.

Q3: Is the mobile money number required to match the rider's login phone number?
A3: Not necessarily. The rider may use one phone number for app login and a
    different dedicated SIM card for their Orange Money or AfriMoney account.
    Always submit `mobileNumber` with the payout payload.

Q4: What if a rider skips payment details during step 2?
A4: During onboarding, payment details can be saved in draft mode. However,
    the rider cannot be approved for active delivery orders by Admin until
    a valid payout method has been configured.

================================================================================
END OF SPECIFICATION DOCUMENT
================================================================================
