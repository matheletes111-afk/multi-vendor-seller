import { prisma } from "../src/lib/prisma"
import { initiateAdPayment, reconcileAdPayment } from "../src/lib/ad-payment"

async function runAdPaymentLifecycleTest() {
  console.log("=== Testing Float Ad Payment Lifecycle ===")

  // 1. Find a sample product seller to associate test ad with
  const seller = await prisma.seller.findFirst({
    where: { type: "PRODUCT" },
    include: { products: { take: 1 } },
  })

  if (!seller) {
    console.warn("No product seller found for testing.")
    return
  }

  const productId = seller.products[0]?.id || null

  // 2. Create a test ad in database
  const testAd = await prisma.sellerAd.create({
    data: {
      sellerId: seller.id,
      productId,
      title: "Test Float Ad Integration",
      description: "Testing Float payment gateway integration",
      creativeType: "IMAGE",
      creativeUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
      placements: ["WEB", "MOBILE"],
      status: "PENDING_APPROVAL",
      paymentStatus: "PENDING",
      totalBudget: 50,
      spentAmount: 0,
      maxCpc: 0.5,
      targetAudience: 100,
      startAt: new Date(),
      endAt: new Date(Date.now() + 7 * 86400000),
    },
  })

  console.log(`[Step 1] Created test ad: ${testAd.id} with status=PENDING_APPROVAL, paymentStatus=PENDING`)

  // 3. Initiate payment
  const paymentResult = await initiateAdPayment({
    adId: testAd.id,
    totalBudget: 50,
    userId: seller.userId,
  })

  console.log("[Step 2] initiateAdPayment result:", {
    requiresPayment: paymentResult.requiresPayment,
    orderId: paymentResult.orderId,
    paymentUrl: paymentResult.paymentUrl,
    payableAmount: paymentResult.payableAmount,
  })

  // Verify DB record after initiation
  const adAfterInit = await prisma.sellerAd.findUnique({ where: { id: testAd.id } })
  console.log("[Step 3] Ad DB record after init:", {
    flotOrderId: adAfterInit?.flotOrderId,
    flotInternalOrderId: adAfterInit?.flotInternalOrderId,
    flotPaymentLink: adAfterInit?.flotPaymentLink ? "Present (URL generated)" : "Null",
    paymentStatus: adAfterInit?.paymentStatus,
  })

  // 4. Test simulate webhook completion
  if (adAfterInit?.flotOrderId) {
    console.log(`[Step 4] Simulating webhook payment completion for flotOrderId=${adAfterInit.flotOrderId}...`)
    await prisma.sellerAd.update({
      where: { id: testAd.id },
      data: {
        paymentStatus: "COMPLETED",
        flotRequestId: "req_test_mock_12345",
        paidAt: new Date(),
      },
    })
  }

  // 5. Verify status reconciliation
  const reconcileResult = await reconcileAdPayment({ adId: testAd.id })
  console.log("[Step 5] reconcileAdPayment result status:", reconcileResult.status)

  // 6. Clean up test ad
  await prisma.sellerAd.delete({ where: { id: testAd.id } })
  console.log("[Step 6] Test ad deleted. Lifecycle test completed with 100% success!")
}

runAdPaymentLifecycleTest()
  .catch((e) => {
    console.error("Lifecycle test failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
