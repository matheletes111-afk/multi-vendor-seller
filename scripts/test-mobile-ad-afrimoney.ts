import { prisma } from "../src/lib/prisma"
import { generateMobileTokens } from "../src/lib/mobile-jwt"
import {
  handleMobileAdAfrimoneyGet,
  handleMobileAdAfrimoneyPost,
  getMobileUserAuth,
} from "../src/app/mobileapi/_helpers/ad-afrimoney"
import { GET as getProductSellerAd } from "../src/app/mobileapi/product-seller/ads/[id]/route"
import { NextRequest } from "next/server"
import { UserRole } from "@prisma/client"

async function runTests() {
  console.log("================================================================================")
  console.log("STARTING MOBILE SELLER AD AFRIMONEY INTEGRATION & PROTOCOL TESTS")
  console.log("================================================================================")

  let passedTests = 0
  let totalTests = 0

  function assert(condition: boolean, testName: string, detail?: any) {
    totalTests++
    if (condition) {
      console.log(`[PASS] ${testName}`)
      passedTests++
    } else {
      console.error(`[FAIL] ${testName}`, detail || "")
      throw new Error(`Assertion failed: ${testName}`)
    }
  }

  // 1. Find a real ad in the database to test with
  const realAd = await prisma.sellerAd.findUnique({
    where: { id: "cmvv40o5i0001nb5s3pabzk2o" },
    include: {
      seller: { select: { userId: true } },
      hotelSeller: { select: { userId: true } },
      restaurantSeller: { select: { userId: true } },
    },
  })

  if (!realAd) {
    throw new Error("Target ad cmvv40o5i0001nb5s3pabzk2o not found in database!")
  }

  console.log(`[Info] Target Ad found: ${realAd.id}, Title: "${realAd.title}", Status: ${realAd.paymentStatus}`)

  // Determine owner userId
  const ownerUserId =
    realAd.customerUserId ||
    realAd.seller?.userId ||
    realAd.hotelSeller?.userId ||
    realAd.restaurantSeller?.userId

  if (!ownerUserId) {
    throw new Error("Ad owner userId could not be resolved from DB relation!")
  }

  const ownerUser = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { id: true, role: true, password: true },
  })

  if (!ownerUser) {
    throw new Error("Ad owner User record not found!")
  }

  // Find another non-owner user for IDOR testing
  const nonOwnerUser = await prisma.user.findFirst({
    where: {
      id: { not: ownerUserId },
      role: { not: UserRole.ADMIN },
    },
    select: { id: true, role: true, password: true },
  })

  if (!nonOwnerUser) {
    throw new Error("Could not find a non-owner user for IDOR testing!")
  }

  // Generate tokens
  const ownerTokens = generateMobileTokens({
    userId: ownerUser.id,
    role: ownerUser.role,
    passwordHash: ownerUser.password,
  })

  const nonOwnerTokens = generateMobileTokens({
    userId: nonOwnerUser.id,
    role: nonOwnerUser.role,
    passwordHash: nonOwnerUser.password,
  })

  // ---------------------------------------------------------------------------
  // TEST 1: Negative Auth - Missing Authorization Header
  // ---------------------------------------------------------------------------
  const reqNoAuth = new NextRequest("http://localhost:3000/mobileapi/seller/ads/cmvv40o5i0001nb5s3pabzk2o/pay-afrimoney", {
    method: "GET",
  })
  const resNoAuth = await handleMobileAdAfrimoneyGet(reqNoAuth, {
    params: Promise.resolve({ id: "cmvv40o5i0001nb5s3pabzk2o" }),
  })
  assert(resNoAuth.status === 401, "Test 1: Missing Auth Header returns HTTP 401")
  const jsonNoAuth = await resNoAuth.json()
  assert(jsonNoAuth.success === false, "Test 1b: Success is false on 401")

  // ---------------------------------------------------------------------------
  // TEST 2: Negative Auth - Invalid / Forged Bearer Token
  // ---------------------------------------------------------------------------
  const reqBadToken = new NextRequest("http://localhost:3000/mobileapi/seller/ads/cmvv40o5i0001nb5s3pabzk2o/pay-afrimoney", {
    method: "GET",
    headers: { Authorization: "Bearer forged_invalid_token_xyz" },
  })
  const resBadToken = await handleMobileAdAfrimoneyGet(reqBadToken, {
    params: Promise.resolve({ id: "cmvv40o5i0001nb5s3pabzk2o" }),
  })
  assert(resBadToken.status === 401, "Test 2: Forged Token returns HTTP 401")

  // ---------------------------------------------------------------------------
  // TEST 3: Negative IDOR - Cross-Tenant Access Prohibited (Non-Owner accessing Owner Ad)
  // ---------------------------------------------------------------------------
  const reqIdorGet = new NextRequest("http://localhost:3000/mobileapi/seller/ads/cmvv40o5i0001nb5s3pabzk2o/pay-afrimoney", {
    method: "GET",
    headers: { Authorization: `Bearer ${nonOwnerTokens.accessToken}` },
  })
  const resIdorGet = await handleMobileAdAfrimoneyGet(reqIdorGet, {
    params: Promise.resolve({ id: "cmvv40o5i0001nb5s3pabzk2o" }),
  })
  assert(resIdorGet.status === 403, "Test 3: IDOR prevention on GET returns HTTP 403 Forbidden")
  const jsonIdorGet = await resIdorGet.json()
  assert(jsonIdorGet.error.includes("Forbidden"), "Test 3b: Explicit Forbidden error message")

  const reqIdorPost = new NextRequest("http://localhost:3000/mobileapi/seller/ads/cmvv40o5i0001nb5s3pabzk2o/pay-afrimoney", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${nonOwnerTokens.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone: "080612072" }),
  })
  const resIdorPost = await handleMobileAdAfrimoneyPost(reqIdorPost, {
    params: Promise.resolve({ id: "cmvv40o5i0001nb5s3pabzk2o" }),
  })
  assert(resIdorPost.status === 403, "Test 3c: IDOR prevention on POST returns HTTP 403 Forbidden")

  // ---------------------------------------------------------------------------
  // TEST 4: Negative Resource - Non-Existent Ad ID
  // ---------------------------------------------------------------------------
  const req404 = new NextRequest("http://localhost:3000/mobileapi/seller/ads/non_existent_ad_id_99999/pay-afrimoney", {
    method: "GET",
    headers: { Authorization: `Bearer ${ownerTokens.accessToken}` },
  })
  const res404 = await handleMobileAdAfrimoneyGet(req404, {
    params: Promise.resolve({ id: "non_existent_ad_id_99999" }),
  })
  assert(res404.status === 404, "Test 4: Non-existent ad returns HTTP 404 Not Found")

  // ---------------------------------------------------------------------------
  // TEST 5: Positive Status Check (GET) - Valid Owner
  // ---------------------------------------------------------------------------
  const reqGetSuccess = new NextRequest("http://localhost:3000/mobileapi/seller/ads/cmvv40o5i0001nb5s3pabzk2o/pay-afrimoney", {
    method: "GET",
    headers: { Authorization: `Bearer ${ownerTokens.accessToken}` },
  })
  const resGetSuccess = await handleMobileAdAfrimoneyGet(reqGetSuccess, {
    params: Promise.resolve({ id: "cmvv40o5i0001nb5s3pabzk2o" }),
  })
  assert(resGetSuccess.status === 200, "Test 5: Valid Owner GET returns HTTP 200 OK")
  const jsonGetSuccess = await resGetSuccess.json()
  assert(jsonGetSuccess.success === true, "Test 5b: success is true")
  assert(jsonGetSuccess.paid === true, "Test 5c: paid is true for completed ad")
  assert(jsonGetSuccess.paymentStatus === "COMPLETED", "Test 5d: paymentStatus is COMPLETED")
  assert(jsonGetSuccess.afriTxnId === "MP261030.1511.90074", "Test 5e: afriTxnId matches Friday transaction")
  assert(jsonGetSuccess.afriMsisdn === "080612072", "Test 5f: afriMsisdn matches Friday payer")
  assert(jsonGetSuccess.data.id === "cmvv40o5i0001nb5s3pabzk2o", "Test 5g: data.id matches ad id")

  // ---------------------------------------------------------------------------
  // TEST 6: Idempotency POST - Ad is already COMPLETED (No double billing)
  // ---------------------------------------------------------------------------
  const reqPostIdempotent = new NextRequest("http://localhost:3000/mobileapi/seller/ads/cmvv40o5i0001nb5s3pabzk2o/pay-afrimoney", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerTokens.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone: "080612072" }),
  })
  const resPostIdempotent = await handleMobileAdAfrimoneyPost(reqPostIdempotent, {
    params: Promise.resolve({ id: "cmvv40o5i0001nb5s3pabzk2o" }),
  })
  assert(resPostIdempotent.status === 200, "Test 6: Idempotent POST returns HTTP 200 OK")
  const jsonPostIdempotent = await resPostIdempotent.json()
  assert(jsonPostIdempotent.success === true, "Test 6b: success is true")
  assert(jsonPostIdempotent.paymentStatus === "COMPLETED", "Test 6c: paymentStatus is COMPLETED")
  assert(jsonPostIdempotent.payableAmount === 0, "Test 6d: payableAmount is 0 (no duplicate billing)")
  assert(jsonPostIdempotent.message === "Ad is already paid", "Test 6e: message explains ad is already paid")

  // ---------------------------------------------------------------------------
  // TEST 7: Ad Details API includes Full Payment Information (100% Web Parity)
  // ---------------------------------------------------------------------------
  const reqDetails = new NextRequest("http://localhost:3000/mobileapi/product-seller/ads/cmvv40o5i0001nb5s3pabzk2o", {
    method: "GET",
    headers: { Authorization: `Bearer ${ownerTokens.accessToken}` },
  })
  const resDetails = await getProductSellerAd(reqDetails, {
    params: Promise.resolve({ id: "cmvv40o5i0001nb5s3pabzk2o" }),
  })
  assert(resDetails.status === 200, "Test 7: Ad Details API returns HTTP 200 OK")
  const jsonDetails = await resDetails.json()
  assert(jsonDetails.success === true, "Test 7b: Ad details success is true")
  assert(jsonDetails.data.paymentStatus === "COMPLETED", "Test 7c: Ad details has paymentStatus COMPLETED")
  assert(jsonDetails.data.paymentMethod === "AFRIMONEY", "Test 7d: Ad details has paymentMethod AFRIMONEY")
  assert(jsonDetails.data.payableAmount === 10, "Test 7e: Ad details payableAmount is numeric 10")
  assert(jsonDetails.data.afriTxnId === "MP261030.1511.90074", "Test 7f: Ad details has afriTxnId")
  assert(jsonDetails.data.afriMsisdn === "080612072", "Test 7g: Ad details has afriMsisdn")
  assert(jsonDetails.data.paidAt !== null, "Test 7h: Ad details has paidAt timestamp")

  console.log("================================================================================")
  console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests} tests successful)`)
  console.log("================================================================================")
}

runTests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Test execution failed:", e)
    process.exit(1)
  })

