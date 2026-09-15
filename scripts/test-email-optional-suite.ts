/**
 * Comprehensive Automated Test Suite for Email-Optional & Phone-First Architecture
 * Tests:
 * 1. Phone validation and equivalence variant generation (cross-matching +232, +91, local vs E.164, leading zeroes)
 * 2. Country-code phone pair candidate extraction
 * 3. Twilio SMS phone normalization & E.164 validation
 * 4. Dual-credential identifier resolution (email vs phone)
 * 5. Web OTP login token creation and verification (phone-only, email-only, dual, tampered)
 * 6. Auth / NextAuth OTP credentials verification simulation (userId, email, phone variants)
 */

process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "test-secret-suite-key-32-chars-long-abc"

import assert from "assert"
import {
  validatePhoneAndCountryCode,
  getEquivalentPhoneVariants,
} from "../src/lib/phone-validation"
import { getCandidateCountryCodePhonePairs } from "../src/lib/phone-otp-lookup"
import { normalizePhoneNumber, isValidE164 } from "../src/lib/twilio-sms"
import { UserRole } from "@prisma/client"

let totalPassed = 0
let totalFailed = 0

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn()
    if (res instanceof Promise) {
      return res
        .then(() => {
          console.log(`  ✅ PASS: ${name}`)
          totalPassed++
        })
        .catch((err: any) => {
          console.error(`  ❌ FAIL: ${name}`)
          console.error(`     Error: ${err.message}`)
          totalFailed++
        })
    } else {
      console.log(`  ✅ PASS: ${name}`)
      totalPassed++
    }
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name}`)
    console.error(`     Error: ${err.message}`)
    totalFailed++
  }
}

async function runAllTests() {
  console.log("================================================================")
  console.log("🧪 RUNNING EMAIL-OPTIONAL & PHONE-FIRST TEST SUITE")
  console.log("================================================================\n")

  // Dynamically load web-otp-login after NEXTAUTH_SECRET is set
  const { createOtpLoginToken, verifyOtpLoginToken } = await import("../src/lib/web-otp-login")

  // -------------------------------------------------------------
  // 1. Phone Equivalence & Cross-Matching Tests
  // -------------------------------------------------------------
  console.log("▶ 1. Testing Phone Equivalence & Cross-Matching Variants...")

  test("Sierra Leone (+232) E.164 to local variant extraction", () => {
    const variants = getEquivalentPhoneVariants("+23276123456")
    assert(variants.includes("+23276123456"), "Should contain +23276123456")
    assert(variants.includes("23276123456"), "Should contain 23276123456")
    assert(variants.includes("76123456"), "Should contain local 76123456")
  })

  test("Sierra Leone local number with explicit country code (+232)", () => {
    const variants = getEquivalentPhoneVariants("76123456", "+232")
    assert(variants.includes("76123456"), "Should contain local 76123456")
    assert(variants.includes("+23276123456"), "Should contain +23276123456")
    assert(variants.includes("23276123456"), "Should contain 23276123456")
  })

  test("Cross-matching intersection: search by +232 matches DB stored local 76123456", () => {
    const dbStoredPhone = "76123456"
    const searchVariants = getEquivalentPhoneVariants("+23276123456")
    assert(searchVariants.includes(dbStoredPhone), "Search variants for +23276123456 must match DB stored '76123456'")
  })

  test("Cross-matching intersection: search by local 76123456 matches DB stored +23276123456", () => {
    const dbStoredPhone = "+23276123456"
    const searchVariants = getEquivalentPhoneVariants("76123456", "+232")
    assert(searchVariants.includes(dbStoredPhone), "Search variants for local 76123456 with +232 must match DB stored '+23276123456'")
  })

  test("India (+91) phone equivalence: local vs international format", () => {
    const variantsWithCC = getEquivalentPhoneVariants("+919876543210")
    assert(variantsWithCC.includes("+919876543210"), "Should contain +919876543210")
    assert(variantsWithCC.includes("9876543210"), "Should extract 10-digit local 9876543210")

    const variantsFromLocal = getEquivalentPhoneVariants("9876543210", "+91")
    assert(variantsFromLocal.includes("+919876543210"), "Should contain +919876543210")
    assert(variantsFromLocal.includes("9876543210"), "Should contain 9876543210")
  })

  test("Local phone with leading zero stripping (e.g. 076123456 -> 76123456, +23276123456)", () => {
    const variants = getEquivalentPhoneVariants("076123456", "+232")
    assert(variants.includes("076123456"), "Should contain raw 076123456")
    assert(variants.includes("76123456"), "Should contain stripped 76123456")
    assert(variants.includes("+23276123456"), "Should contain +23276123456")
  })

  test("Phone and country code validation rules (validatePhoneAndCountryCode)", () => {
    const validSL = validatePhoneAndCountryCode("76123456", "+232")
    assert.strictEqual(validSL.isValid, true, "SL valid local phone should pass")
    assert.strictEqual(validSL.fullE164, "+23276123456")

    const validSLZero = validatePhoneAndCountryCode("088994462", "+232")
    assert.strictEqual(validSLZero.isValid, true, "SL phone with leading zero should pass")
    assert.strictEqual(validSLZero.fullE164, "+23288994462")

    const invalidCC = validatePhoneAndCountryCode("76123456", "invalid")
    assert.strictEqual(invalidCC.isValid, false, "Invalid country code must fail")

    const invalidLen = validatePhoneAndCountryCode("123", "+232")
    assert.strictEqual(invalidLen.isValid, false, "3-digit phone must fail length check")
  })

  // -------------------------------------------------------------
  // 2. Candidate Country Code Phone Pairs Tests
  // -------------------------------------------------------------
  console.log("\n▶ 2. Testing Candidate Country Code & Phone Split Pairs...")

  test("Split candidate pairs for Sierra Leone E.164 (+23276123456)", () => {
    const pairs = getCandidateCountryCodePhonePairs("+23276123456")
    const match = pairs.find((p) => p.countryCode === "+232" && p.phone === "76123456")
    assert(Boolean(match), "Should detect countryCode: +232 and phone: 76123456")
  })

  test("Split candidate pairs for India E.164 (+919876543210)", () => {
    const pairs = getCandidateCountryCodePhonePairs("+919876543210")
    const match = pairs.find((p) => p.countryCode === "+91" && p.phone === "9876543210")
    assert(Boolean(match), "Should detect countryCode: +91 and phone: 9876543210")
  })

  // -------------------------------------------------------------
  // 3. Twilio SMS Utilities Tests
  // -------------------------------------------------------------
  console.log("\n▶ 3. Testing Twilio SMS Utilities...")

  test("Normalize international phone numbers with spaces, dashes, parentheses", () => {
    const normalized = normalizePhoneNumber("+1 (555) 234-5678")
    assert.strictEqual(normalized, "+15552345678")
  })

  test("Normalize local number with leading zero into Sierra Leone E.164", () => {
    const normalized = normalizePhoneNumber("088994462")
    assert.strictEqual(normalized, "+23288994462")
  })

  test("Validate E.164 formatted numbers", () => {
    assert.strictEqual(isValidE164("+23276123456"), true)
    assert.strictEqual(isValidE164("+919876543210"), true)
    assert.strictEqual(isValidE164("76123456"), false, "Missing plus and country code is not E.164")
    assert.strictEqual(isValidE164("invalid"), false)
  })

  // -------------------------------------------------------------
  // 4. Dual-Credential Identifier Resolution Tests
  // -------------------------------------------------------------
  console.log("\n▶ 4. Testing Dual-Credential Identifier Resolution...")

  function resolveIdentifier(identifier: string) {
    const raw = identifier.trim()
    let email = ""
    let phone = ""
    if (raw.includes("@")) {
      email = raw.toLowerCase()
    } else {
      phone = raw
    }
    return { email, phone }
  }

  test("Identifier with email address (mixed case & whitespace)", () => {
    const resolved = resolveIdentifier("  Customer.Alex@Example.COM  ")
    assert.strictEqual(resolved.email, "customer.alex@example.com")
    assert.strictEqual(resolved.phone, "")
  })

  test("Identifier with E.164 phone number", () => {
    const resolved = resolveIdentifier("+23276123456")
    assert.strictEqual(resolved.email, "")
    assert.strictEqual(resolved.phone, "+23276123456")
  })

  test("Identifier with local phone number", () => {
    const resolved = resolveIdentifier("76123456")
    assert.strictEqual(resolved.email, "")
    assert.strictEqual(resolved.phone, "76123456")
  })

  // -------------------------------------------------------------
  // 5. Web OTP Login Token Creation & Verification Tests
  // -------------------------------------------------------------
  console.log("\n▶ 5. Testing Web OTP Login Token Lifecycle...")

  test("Create & verify OTP login token with phone only (Email is null)", () => {
    const token = createOtpLoginToken("+23276123456", UserRole.CUSTOMER, {
      userId: "user_phone_only_1",
      phone: "+23276123456",
      email: null,
    })
    assert(typeof token === "string" && token.length > 20, "Token should be non-empty string")

    const payload = verifyOtpLoginToken(token)
    assert(payload !== null, "Token must be valid")
    assert.strictEqual(payload?.type, "web-login-otp")
    assert.strictEqual(payload?.userId, "user_phone_only_1")
    assert.strictEqual(payload?.phone, "+23276123456")
    assert.strictEqual(payload?.email, null)
    assert.strictEqual(payload?.role, UserRole.CUSTOMER)
  })

  test("Create & verify OTP login token with email only", () => {
    const token = createOtpLoginToken("seller@example.com", UserRole.SELLER_PRODUCT, {
      userId: "user_email_only_1",
      email: "seller@example.com",
    })
    const payload = verifyOtpLoginToken(token)
    assert(payload !== null, "Token must be valid")
    assert.strictEqual(payload?.userId, "user_email_only_1")
    assert.strictEqual(payload?.email, "seller@example.com")
    assert.strictEqual(payload?.phone, null)
    assert.strictEqual(payload?.role, UserRole.SELLER_PRODUCT)
  })

  test("Create & verify OTP login token with both email and phone", () => {
    const token = createOtpLoginToken("rider@example.com", UserRole.RIDER, {
      userId: "user_dual_1",
      email: "rider@example.com",
      phone: "+919876543210",
    })
    const payload = verifyOtpLoginToken(token)
    assert(payload !== null, "Token must be valid")
    assert.strictEqual(payload?.email, "rider@example.com")
    assert.strictEqual(payload?.phone, "+919876543210")
    assert.strictEqual(payload?.role, UserRole.RIDER)
  })

  test("Tampered token verification returns null", () => {
    const token = createOtpLoginToken("+23276123456", UserRole.CUSTOMER)
    const tampered = token.slice(0, -5) + "abcde"
    const payload = verifyOtpLoginToken(tampered)
    assert.strictEqual(payload, null, "Tampered token must return null")
  })

  test("Empty or invalid token returns null", () => {
    assert.strictEqual(verifyOtpLoginToken(""), null)
    assert.strictEqual(verifyOtpLoginToken("invalid.token.structure"), null)
  })

  // -------------------------------------------------------------
  // 6. NextAuth OTP Credentials Verification Simulation
  // -------------------------------------------------------------
  console.log("\n▶ 6. Testing NextAuth OTP Credentials Verification Simulation...")

  function simulateNextAuthOtpAuthorize(
    user: { id: string; email: string | null; phone: string | null; role: UserRole },
    otpLoginToken: string
  ) {
    const payload = verifyOtpLoginToken(otpLoginToken)
    if (!payload) return { success: false, reason: "invalid_token" }

    if (payload.userId) {
      if (payload.userId !== user.id) return { success: false, reason: "userId_mismatch" }
    } else if (payload.email) {
      if (!user.email || payload.email !== user.email.toLowerCase().trim()) {
        return { success: false, reason: "email_mismatch" }
      }
    } else if (payload.phone) {
      const variants = getEquivalentPhoneVariants(payload.phone)
      if (!user.phone || (!variants.includes(user.phone) && user.phone !== payload.phone)) {
        return { success: false, reason: "phone_mismatch" }
      }
    } else {
      return { success: false, reason: "missing_identifier" }
    }

    if (payload.role !== user.role) return { success: false, reason: "role_mismatch" }
    return { success: true }
  }

  test("Authorize phone-only user with matching phone variant", () => {
    const user = {
      id: "u1",
      email: null,
      phone: "+23276123456",
      role: UserRole.CUSTOMER,
    }
    // Token created with local format 76123456
    const token = createOtpLoginToken("76123456", UserRole.CUSTOMER, { phone: "76123456" })
    const result = simulateNextAuthOtpAuthorize(user, token)
    assert.strictEqual(result.success, true, "Should authorize phone-only user via phone variant equivalence")
  })

  test("Reject phone-only user if token phone belongs to different user", () => {
    const user = {
      id: "u1",
      email: null,
      phone: "+23276123456",
      role: UserRole.CUSTOMER,
    }
    const token = createOtpLoginToken("+23276999999", UserRole.CUSTOMER, { phone: "+23276999999" })
    const result = simulateNextAuthOtpAuthorize(user, token)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.reason, "phone_mismatch")
  })

  test("Reject if role in OTP token does not match user role", () => {
    const user = {
      id: "u1",
      email: null,
      phone: "+23276123456",
      role: UserRole.CUSTOMER,
    }
    const token = createOtpLoginToken("+23276123456", UserRole.SELLER_PRODUCT, { phone: "+23276123456" })
    const result = simulateNextAuthOtpAuthorize(user, token)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.reason, "role_mismatch")
  })

  // -------------------------------------------------------------
  // 7. Notification & Delivery OTP Fallback Tests (Email Optional)
  // -------------------------------------------------------------
  console.log("\n▶ 7. Testing Notification & Delivery OTP Fallback (Email Optional)...")

  const { sendEmail } = await import("../src/lib/email")
  const { sendDeliveryOtp } = await import("../src/lib/delivery-otp")

  await test("sendEmail gracefully returns error object instead of throwing when email is empty", async () => {
    const resEmpty = await sendEmail({ to: "", subject: "Test", text: "Test content" })
    assert.strictEqual(resEmpty.success, false, "Should return success: false for empty recipient")
    assert(resEmpty.error instanceof Error, "Should return an Error object")
    assert(resEmpty.error.message.includes("No recipient email"), "Should mention no recipient email")
  })

  await test("sendDeliveryOtp executes safely when toEmail is null (phone-only customer)", async () => {
    const result = await sendDeliveryOtp({
      toEmail: null,
      toPhone: "+23276123456",
      orderNumber: "TEST-ORD-001",
      customerName: "Alex Buyer",
      otp: "123456",
      sellerStoreName: "Alex Shop",
    })
    assert.strictEqual(result.otp, "123456")
    assert(result.expiry instanceof Date, "Should return valid expiry Date")
  })

  await test("sendDeliveryOtp executes safely when toEmail is undefined", async () => {
    const result = await sendDeliveryOtp({
      toPhone: "+23276123456",
      orderNumber: "TEST-ORD-002",
      customerName: "Alex Buyer",
    })
    assert.strictEqual(typeof result.otp, "string")
    assert.strictEqual(result.otp.length, 6)
  })

  console.log("\n================================================================")
  console.log(`🏁 TEST SUITE COMPLETE: ${totalPassed} Passed, ${totalFailed} Failed`)
  console.log("================================================================\n")

  if (totalFailed > 0) {
    process.exit(1)
  }
}

runAllTests().catch((err) => {
  console.error("Test runner encountered an unhandled error:", err)
  process.exit(1)
})
