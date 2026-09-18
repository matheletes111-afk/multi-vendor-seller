import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * Utility script to link Apple In-App Purchase Product IDs to database subscription plans.
 * Free plans are excluded from Apple IAP (Apple Store requires paid products only).
 * 
 * To run this script:
 *   npx tsx scripts/link-apple-iap-plans.ts
 */
async function main() {
  console.log("🔗 Linking Apple IAP Product IDs to subscription plans in database...\n")

  /**
   * Configure your Apple Product IDs here.
   * Edit the `appleProductId` strings to match the exact Product IDs created in App Store Connect.
   */
  const paidPlanMappings = [
    // ════════════════════════════════════════════════════════════════════════
    // 1. PRODUCT & SERVICE SELLER PLANS (Paid only)
    // ════════════════════════════════════════════════════════════════════════
    {
      id: "cmjmscjxs000113d1asvtbc1k",
      displayName: "Basic Plan",
      type: "PRODUCT_SERVICE",
      price: "Le 200",
      duration: "30 days (1 Month)",
      // 👉 Put your Apple Product ID for Basic Monthly below:
      appleProductId: "com.meeem.seller.basic",
    },
    {
      id: "cmjmsclc8000213d1s7wuymga",
      displayName: "Standard Plan",
      type: "PRODUCT_SERVICE",
      price: "Le 300",
      duration: "30 days (1 Month)",
      // 👉 Put your Apple Product ID for Standard Monthly below:
      appleProductId: "com.meeem.seller.standard",
    },
    {
      id: "cmpwa4si300008nfwutt5g2fd",
      displayName: "Premium Plan",
      type: "PRODUCT_SERVICE",
      price: "Le 1,500",
      duration: "90 days (Quarterly)",
      // 👉 Put your Apple Product ID for Premium / Quarterly below:
      appleProductId: "com.meeem.seller.premium",
    },

    // ════════════════════════════════════════════════════════════════════════
    // 2. HOTEL SELLER PLANS (Paid only)
    // ════════════════════════════════════════════════════════════════════════
    {
      id: "cmpmbi2hm0004vwrt5fy3sjp6",
      displayName: "Standard Hotel",
      type: "HOTEL",
      price: "Le 200",
      duration: "30 days (1 Month)",
      // 👉 Apple Product ID for Hotel Standard:
      appleProductId: "com.meeem.seller.hotel.standard",
    },
    {
      id: "cmpmbi3k80005vwrtpq99vgow",
      displayName: "Premium Hotel",
      type: "HOTEL",
      price: "Le 500",
      duration: "30 days (1 Month)",
      // 👉 Apple Product ID for Hotel Premium:
      appleProductId: "com.meeem.seller.hotel.premium",
    },

    // ════════════════════════════════════════════════════════════════════════
    // 3. RESTAURANT SELLER PLANS (Paid only)
    // ════════════════════════════════════════════════════════════════════════
    {
      id: "cmpmbi5fm0007vwrtacl1p761",
      displayName: "Standard Restaurant",
      type: "RESTAURANT",
      price: "Le 200",
      duration: "30 days (1 Month)",
      // 👉 Apple Product ID for Restaurant Standard:
      appleProductId: "com.meeem.seller.restaurant.standard",
    },
    {
      id: "cmpmbi6do0008vwrtjrq7jh80",
      displayName: "Premium Restaurant",
      type: "RESTAURANT",
      price: "Le 500",
      duration: "30 days (1 Month)",
      // 👉 Apple Product ID for Restaurant Premium:
      appleProductId: "com.meeem.seller.restaurant.premium",
    },
  ]

  let updatedCount = 0

  // 1. Update each paid plan with its assigned Apple Product ID
  for (const plan of paidPlanMappings) {
    const updated = await prisma.plan.update({
      where: { id: plan.id },
      data: { appleProductId: plan.appleProductId },
    })

    console.log(
      `✓ [${plan.type}] "${plan.displayName}" (${plan.price}, ${plan.duration})`
    )
    console.log(`    ↳ Plan ID:         ${plan.id}`)
    console.log(`    ↳ AppleProduct ID: ${updated.appleProductId}\n`)

    updatedCount++
  }

  // 2. Ensure all Free plans have appleProductId explicitly set to null
  const freePlans = await prisma.plan.updateMany({
    where: {
      name: "FREE",
    },
    data: {
      appleProductId: null,
    },
  })
  console.log(`ℹ️  Verified ${freePlans.count} Free plan(s) have appleProductId = null (Free plans do not use Apple IAP).`)

  console.log(`\n🎉 Successfully linked Apple Product IDs across ${updatedCount} paid plan(s).`)
}

main()
  .catch((e) => {
    console.error("❌ Error linking Apple IAP plans:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
