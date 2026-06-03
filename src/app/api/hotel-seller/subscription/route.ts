import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isHotelSeller } from "@/lib/rbac"

import { activateHotelFreePlan } from "@/lib/subscriptions"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || !isHotelSeller(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.hotelSeller.findUnique({
      where: { userId: session.user.id },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    })

    let subscription = seller?.subscription || null

    if (!subscription && seller) {
      const newSub = await activateHotelFreePlan(seller.id)
      if (newSub) {
        subscription = await prisma.hotelSubscription.findUnique({
          where: { hotelSellerId: seller.id },
          include: { plan: true },
        })
      }
    }

    return NextResponse.json(subscription)
  } catch (error) {
    console.error("Error fetching hotel subscription:", error)
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 })
  }
}
