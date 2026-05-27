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

    const body = await request.json().catch(() => ({})) as { planName?: string; test?: boolean }
    const planName = body.planName as SubscriptionPlan | undefined
    if (!planName) return NextResponse.json({ error: "planName is required" }, { status: 400 })

    const plan = await prisma.plan.findUnique({
      where: {
        name_type: {
          name: planName,
          type: "HOTEL",
        },
      },
    })
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

    const now = new Date()
    const currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

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
