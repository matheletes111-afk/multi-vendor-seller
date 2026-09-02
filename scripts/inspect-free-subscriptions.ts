import { prisma } from "../src/lib/prisma"

async function main() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  console.log(`Analyzing sellers registered since: ${thirtyDaysAgo.toISOString()}\n`)

  // 1. Product/Service
  const prodSubs = await prisma.subscription.findMany({
    where: {
      seller: { createdAt: { gte: thirtyDaysAgo } },
      plan: { price: 0 },
    },
    include: {
      seller: { include: { user: { select: { email: true, name: true } } } },
      plan: true,
    },
  })

  // 2. Hotel
  const hotelSubs = await prisma.hotelSubscription.findMany({
    where: {
      hotelSeller: { createdAt: { gte: thirtyDaysAgo } },
      plan: { price: 0 },
    },
    include: {
      hotelSeller: { include: { user: { select: { email: true, name: true } } } },
      plan: true,
    },
  })

  // 3. Restaurant
  const restSubs = await prisma.restaurantSubscription.findMany({
    where: {
      restaurantSeller: { createdAt: { gte: thirtyDaysAgo } },
      plan: { price: 0 },
    },
    include: {
      restaurantSeller: { include: { user: { select: { email: true, name: true } } } },
      plan: true,
    },
  })

  console.log(`Product/Service Free Subscriptions: ${prodSubs.length}`)
  prodSubs.forEach((s) => {
    const snap = s.planSnapshot as any
    const diffDays = s.currentPeriodEnd && s.currentPeriodStart 
      ? Math.round((s.currentPeriodEnd.getTime() - s.currentPeriodStart.getTime()) / (24 * 3600 * 1000))
      : null
    console.log(`  - [${s.seller.user.email}] start: ${s.currentPeriodStart?.toISOString().slice(0, 10)}, end: ${s.currentPeriodEnd?.toISOString().slice(0, 10)}, spanDays: ${diffDays}, snapDur: ${snap?.duration}`)
  })

  console.log(`\nHotel Free Subscriptions: ${hotelSubs.length}`)
  hotelSubs.forEach((s) => {
    const snap = s.planSnapshot as any
    const diffDays = s.currentPeriodEnd && s.currentPeriodStart 
      ? Math.round((s.currentPeriodEnd.getTime() - s.currentPeriodStart.getTime()) / (24 * 3600 * 1000))
      : null
    console.log(`  - [${s.hotelSeller.user.email}] start: ${s.currentPeriodStart?.toISOString().slice(0, 10)}, end: ${s.currentPeriodEnd?.toISOString().slice(0, 10)}, spanDays: ${diffDays}, snapDur: ${snap?.duration}`)
  })

  console.log(`\nRestaurant Free Subscriptions: ${restSubs.length}`)
  restSubs.forEach((s) => {
    const snap = s.planSnapshot as any
    const diffDays = s.currentPeriodEnd && s.currentPeriodStart 
      ? Math.round((s.currentPeriodEnd.getTime() - s.currentPeriodStart.getTime()) / (24 * 3600 * 1000))
      : null
    console.log(`  - [${s.restaurantSeller.user.email}] start: ${s.currentPeriodStart?.toISOString().slice(0, 10)}, end: ${s.currentPeriodEnd?.toISOString().slice(0, 10)}, spanDays: ${diffDays}, snapDur: ${snap?.duration}`)
  })

  // Check sellers who registered in last 30 days but have NO subscription
  const sellersWithoutSub = await prisma.seller.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
      subscription: null,
    },
    include: { user: { select: { email: true } } },
  })
  const hotelWithoutSub = await prisma.hotelSeller.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
      subscription: null,
    },
    include: { user: { select: { email: true } } },
  })
  const restWithoutSub = await prisma.restaurantSeller.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
      subscription: null,
    },
    include: { user: { select: { email: true } } },
  })

  console.log(`\nSellers registered in last 30 days without subscription:`)
  console.log(`  - Product/Service without sub: ${sellersWithoutSub.length} (${sellersWithoutSub.map(s => s.user.email).join(", ")})`)
  console.log(`  - Hotel without sub: ${hotelWithoutSub.length} (${hotelWithoutSub.map(s => s.user.email).join(", ")})`)
  console.log(`  - Restaurant without sub: ${restWithoutSub.length} (${restWithoutSub.map(s => s.user.email).join(", ")})`)

  // Check if any registered in last 30 days have a PAID subscription
  const paidProd = await prisma.subscription.count({
    where: { seller: { createdAt: { gte: thirtyDaysAgo } }, plan: { price: { gt: 0 } } },
  })
  const paidHotel = await prisma.hotelSubscription.count({
    where: { hotelSeller: { createdAt: { gte: thirtyDaysAgo } }, plan: { price: { gt: 0 } } },
  })
  const paidRest = await prisma.restaurantSubscription.count({
    where: { restaurantSeller: { createdAt: { gte: thirtyDaysAgo } }, plan: { price: { gt: 0 } } },
  })
  console.log(`\nPaid subscriptions in last 30 days: Product: ${paidProd}, Hotel: ${paidHotel}, Restaurant: ${paidRest}`)
}

main().finally(() => prisma.$disconnect())
