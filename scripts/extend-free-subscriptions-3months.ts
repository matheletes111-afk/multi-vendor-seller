/**
 * Script: Extend Free Subscriptions to 3 Months (90 Days)
 * Target: All sellers registered in the last 30 days on FREE plans (Product, Service, Hotel, Restaurant).
 *
 * Usage:
 *   npx tsx scripts/extend-free-subscriptions-3months.ts --dry-run
 *   npx tsx scripts/extend-free-subscriptions-3months.ts
 */

import { prisma } from "../src/lib/prisma"
import { PlanType, SubscriptionPlan } from "@prisma/client"
import { createPlanSnapshot } from "../src/lib/subscriptions"

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes("--dry-run") || args.includes("-d")

  console.log("==================================================================")
  console.log("🚀 MEEEM Free Subscription Extension to 3 Months (90 Days)")
  console.log("==================================================================")
  console.log(`Execution Mode: ${isDryRun ? "🧪 DRY RUN (Simulation only, no DB writes)" : "⚡ LIVE EXECUTION"}`)

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  console.log(`Target Window: Sellers registered since ${thirtyDaysAgo.toISOString()}\n`)

  // Fetch the 90-day Free Plans from database
  const prodFreePlan = await prisma.plan.findFirst({
    where: { price: 0, type: PlanType.PRODUCT_SERVICE },
  })
  const hotelFreePlan = await prisma.plan.findFirst({
    where: { price: 0, type: PlanType.HOTEL },
  })
  const restFreePlan = await prisma.plan.findFirst({
    where: { price: 0, type: PlanType.RESTAURANT },
  })

  if (!prodFreePlan || !hotelFreePlan || !restFreePlan) {
    throw new Error("Missing one or more free plan templates in database!")
  }

  const prodSnapshot = { ...createPlanSnapshot(prodFreePlan), duration: 90 }
  const hotelSnapshot = { ...createPlanSnapshot(hotelFreePlan), duration: 90 }
  const restSnapshot = { ...createPlanSnapshot(restFreePlan), duration: 90 }

  let prodCount = 0
  let hotelCount = 0
  let restCount = 0

  // 1. PRODUCT / SERVICE SELLERS
  console.log("--- 1. PROCESSING PRODUCT / SERVICE SELLERS ---")
  const prodSubs = await prisma.subscription.findMany({
    where: {
      seller: { createdAt: { gte: thirtyDaysAgo } },
      OR: [
        { plan: { price: 0 } },
        { paidPrice: 0 },
        { plan: { name: SubscriptionPlan.FREE } },
      ],
    },
    include: {
      seller: { include: { user: { select: { email: true, name: true } } } },
      plan: true,
    },
  })

  for (const sub of prodSubs) {
    const start = sub.currentPeriodStart || sub.createdAt || sub.seller.createdAt
    const newEnd = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000)
    const prevEndStr = sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString().slice(0, 10) : "none"
    const newEndStr = newEnd.toISOString().slice(0, 10)
    const prevSnapDur = (sub.planSnapshot as any)?.duration || "none"

    console.log(`[Product] ${sub.seller.user.email} | Start: ${start.toISOString().slice(0, 10)} | PrevEnd: ${prevEndStr} -> NewEnd: ${newEndStr} | PrevSnapDur: ${prevSnapDur} -> 90`)

    if (!isDryRun) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          planId: prodFreePlan.id,
          paidPrice: 0,
          status: "ACTIVE",
          currentPeriodStart: start,
          currentPeriodEnd: newEnd,
          planSnapshot: prodSnapshot,
        },
      })
    }
    prodCount++
  }

  // 2. HOTEL SELLERS
  console.log("\n--- 2. PROCESSING HOTEL SELLERS ---")
  const hotelSubs = await prisma.hotelSubscription.findMany({
    where: {
      hotelSeller: { createdAt: { gte: thirtyDaysAgo } },
      OR: [
        { plan: { price: 0 } },
        { paidPrice: 0 },
        { plan: { name: SubscriptionPlan.FREE } },
      ],
    },
    include: {
      hotelSeller: { include: { user: { select: { email: true, name: true } } } },
      plan: true,
    },
  })

  for (const sub of hotelSubs) {
    const start = sub.currentPeriodStart || sub.createdAt || sub.hotelSeller.createdAt
    const newEnd = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000)
    const prevEndStr = sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString().slice(0, 10) : "none"
    const newEndStr = newEnd.toISOString().slice(0, 10)
    const prevSnapDur = (sub.planSnapshot as any)?.duration || "none"

    console.log(`[Hotel] ${sub.hotelSeller.user.email} | Start: ${start.toISOString().slice(0, 10)} | PrevEnd: ${prevEndStr} -> NewEnd: ${newEndStr} | PrevSnapDur: ${prevSnapDur} -> 90`)

    if (!isDryRun) {
      await prisma.hotelSubscription.update({
        where: { id: sub.id },
        data: {
          planId: hotelFreePlan.id,
          paidPrice: 0,
          status: "ACTIVE",
          currentPeriodStart: start,
          currentPeriodEnd: newEnd,
          planSnapshot: hotelSnapshot,
        },
      })
    }
    hotelCount++
  }

  // 3. RESTAURANT SELLERS
  console.log("\n--- 3. PROCESSING RESTAURANT SELLERS ---")
  const restSubs = await prisma.restaurantSubscription.findMany({
    where: {
      restaurantSeller: { createdAt: { gte: thirtyDaysAgo } },
      OR: [
        { plan: { price: 0 } },
        { paidPrice: 0 },
        { plan: { name: SubscriptionPlan.FREE } },
      ],
    },
    include: {
      restaurantSeller: { include: { user: { select: { email: true, name: true } } } },
      plan: true,
    },
  })

  for (const sub of restSubs) {
    const start = sub.currentPeriodStart || sub.createdAt || sub.restaurantSeller.createdAt
    const newEnd = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000)
    const prevEndStr = sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString().slice(0, 10) : "none"
    const newEndStr = newEnd.toISOString().slice(0, 10)
    const prevSnapDur = (sub.planSnapshot as any)?.duration || "none"

    console.log(`[Restaurant] ${sub.restaurantSeller.user.email} | Start: ${start.toISOString().slice(0, 10)} | PrevEnd: ${prevEndStr} -> NewEnd: ${newEndStr} | PrevSnapDur: ${prevSnapDur} -> 90`)

    if (!isDryRun) {
      await prisma.restaurantSubscription.update({
        where: { id: sub.id },
        data: {
          planId: restFreePlan.id,
          paidPrice: 0,
          status: "ACTIVE",
          currentPeriodStart: start,
          currentPeriodEnd: newEnd,
          planSnapshot: restSnapshot,
        },
      })
    }
    restCount++
  }

  console.log("\n==================================================================")
  console.log("📊 EXECUTION SUMMARY")
  console.log("==================================================================")
  console.log(`Product/Service Sellers Extended: ${prodCount}`)
  console.log(`Hotel Sellers Extended:           ${hotelCount}`)
  console.log(`Restaurant Sellers Extended:      ${restCount}`)
  console.log(`Total Free Subscriptions Updated: ${prodCount + hotelCount + restCount}`)
  console.log(`Mode:                             ${isDryRun ? "DRY RUN (No changes made)" : "LIVE APPLIED SUCCESSFULLY"}`)
  console.log("==================================================================")
}

main()
  .catch((e) => {
    console.error("Extension script error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
