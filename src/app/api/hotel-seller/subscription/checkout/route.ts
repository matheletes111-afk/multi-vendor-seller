import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isHotelSeller } from "@/lib/rbac"
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isHotelSeller(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.hotelSeller.findUnique({
      where: { userId: session.user.id },
      include: { subscription: true },
    })
    if (!seller) return NextResponse.json({ error: "Hotel Seller not found" }, { status: 404 })

    const body = await request.json().catch(() => ({})) as { planId?: string; planName?: string; test?: boolean }
    const { planId, planName } = body
    if (!planId && !planName) {
      return NextResponse.json({ error: "planId or planName is required" }, { status: 400 })
    }

    let plan
    if (planId) {
      plan = await prisma.plan.findUnique({
        where: { id: planId },
      })
    } else if (planName) {
      plan = await prisma.plan.findFirst({
        where: {
          name: planName as SubscriptionPlan,
          type: "HOTEL",
        },
        orderBy: { price: "asc" }
      })
    }

    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

    const now = new Date()
    const durationDays = plan.duration || 30
    const currentPeriodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

    // Local / Test mode upsert subscription directly
    await prisma.hotelSubscription.upsert({
      where: { hotelSellerId: seller.id },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd,
      },
      create: {
        hotelSellerId: seller.id,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd,
      },
    })

    return NextResponse.json({ url: null })
  } catch (error) {
    console.error("Hotel subscription checkout error:", error)
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 })
  }
}
