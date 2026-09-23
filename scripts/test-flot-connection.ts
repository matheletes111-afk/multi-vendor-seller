import { getFlotConfig, createFlotPaymentLink } from "../src/lib/flot"

async function testFlotConnection() {
  console.log("\n=======================================================")
  console.log("       FLOAT PAYMENT GATEWAY DIAGNOSTICS & DEBUG       ")
  console.log("=======================================================\n")

  // 1. Check configuration
  try {
    const config = getFlotConfig()
    console.log("[1] Configuration Loaded:")
    console.log("    • Base URL:      ", config.baseUrl)
    console.log("    • Merchant ID:   ", config.merchantId)
    console.log("    • Private Key:   ", config.privateKey ? `Present (${config.privateKey.length} characters)` : "Missing ❌")
  } catch (err: any) {
    console.error("❌ Configuration Error:", err?.message)
    return
  }

  // 2. Test making a live test payment link request to Float Staging
  const testOrderId = `TEST_DIAG_${Date.now()}`
  console.log(`\n[2] Sending Test Request to Float Staging for orderId: ${testOrderId}...`)

  try {
    const result = await createFlotPaymentLink({
      orderId: testOrderId,
      amount: 10, // 10 SLE test
      currency: "SLE",
      type: "in-app",
    })

    console.log("\n✅ SUCCESS! Float API responded with 200 OK:")
    console.log("    • Attempt ID:    ", result.id)
    console.log("    • Checkout URL:  ", result.link)
    console.log("    • USSD Code:     ", result.code || "None (Card/In-app link)")
    console.log("\n🎉 Your Float Gateway integration is 100% working and ready to accept payments!")
  } catch (error: any) {
    console.log("\n❌ FLOAT ERROR DETAILS:")
    console.log("    • Error Message: ", error?.message)
    
    if (error?.message?.includes("403")) {
      console.log("\n💡 HOW TO FIX 403 FORBIDDEN:")
      console.log("   Float rejected the signature. This means the FLOT_PRIVATE_KEY in your .env")
      console.log("   does not match the Public Key registered on Float's server for Merchant ID:")
      console.log("   40bd76d6-de05-4ca3-9e32-47eed6e657b1")
      console.log("   -> Please paste the exact private key that Float provided to you into .env.")
    } else if (error?.message?.includes("400")) {
      console.log("\n💡 HOW TO FIX 400 BAD REQUEST:")
      console.log("   One of the fields (amount, currency, merchantId) was rejected by Float.")
    }
  }

  console.log("\n=======================================================\n")
}

testFlotConnection()
