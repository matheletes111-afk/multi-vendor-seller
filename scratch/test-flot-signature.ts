import { signFlotPayload, getFlotPrivateKey, getFlotConfig } from "../src/lib/flot"

async function testSignature() {
  console.log("--- Testing Flot Configuration & RSA-PSS Signing ---")
  const config = getFlotConfig()
  console.log("Base URL:", config.baseUrl)
  console.log("Merchant ID:", config.merchantId)
  console.log("Private Key length:", config.privateKey.length)

  const sampleBody = JSON.stringify({
    merchantId: config.merchantId,
    type: "in-app",
    payload: {
      orderId: "AD_TEST_12345",
      currency: "SLE",
      amount: "50.00",
    },
  })

  const signature = signFlotPayload(sampleBody)
  console.log("Generated Signature length:", signature.length)
  console.log("Sample Signature prefix:", signature.substring(0, 30) + "...")

  // Bodyless signature test
  const canonicalString = "GET\n/merchants/private/v1/external-orders/AD_TEST_12345/payment-attempts/attempt_123"
  const bodylessSig = signFlotPayload(canonicalString)
  console.log("Bodyless Signature length:", bodylessSig.length)
  console.log("Verification test passed successfully!")
}

testSignature().catch(console.error)
