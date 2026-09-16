import { PrismaClient, SubscriptionPlan, PlanType } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * One-time utility script to link Apple In-App Purchase Product IDs to database plans.
 * Run via: pnpm exec tsx scripts/link-apple-iap-plans.ts
 */
async function main() {
  console.log("Linking Apple IAP Product IDs to subscription plans...")

  const mappings = [
    // 1. Product & Service Plans
    {
      name: SubscriptionPlan.STANDARD,
      type: PlanType.PRODUCT_SERVICE,
      duration: 30,
      appleProductId: "com.meeem.seller.standard.monthly",
    },
    {
      name: SubscriptionPlan.PREMIUM,
      type: PlanType.PRODUCT_SERVICE,
      duration: 30,
      appleProductId: "com.meeem.seller.premium.monthly",
    },
    {
      name: SubscriptionPlan.STANDARD,
      type: PlanType.PRODUCT_SERVICE,
      duration: 90,
      appleProductId: "com.meeem.seller.standard.quarterly",
    },

    // 2. Hotel Plans
    {
      name: SubscriptionPlan.STANDARD,
      type: PlanType.HOTEL,
      duration: 30,
      appleProductId: "com.meeem.seller.hotel.standard.monthly",
    },
    {
      name: SubscriptionPlan.PREMIUM,
      type: PlanType.HOTEL,
      duration: 30,
      appleProductId: "com.meeem.seller.hotel.premium.monthly",
    },

    // 3. Restaurant Plans
    {
      name: SubscriptionPlan.STANDARD,
      type: PlanType.RESTAURANT,
      duration: 30,
      appleProductId: "com.meeem.seller.restaurant.standard.monthly",
    },
    {
      name: SubscriptionPlan.PREMIUM,
      type: PlanType.RESTAURANT,
      duration: 30,
      appleProductId: "com.meeem.seller.restaurant.premium.monthly",
    },
  ]

  let updatedCount = 0

  for (const m of mappings) {
    const res = await prisma.plan.updateMany({
      where: {
        name: m.name,
        type: m.type,
        duration: m.duration,
      },
      data: {
        appleProductId: m.appleProductId,
      },
    })
    console.log(
      `✓ [${m.type}] ${m.name} (${m.duration}d) -> ${m.appleProductId} (${res.count} updated)`
    )
    updatedCount += res.count
  }

  console.log(`\nSuccessfully linked Apple Product IDs across ${updatedCount} plan(s).`)
}

main()
  .catch((e) => {
    console.error("Error linking Apple IAP plans:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
