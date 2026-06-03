import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isRestaurantSeller } from "@/lib/rbac"

import { activateRestaurantFreePlan } from "@/lib/subscriptions"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || !isRestaurantSeller(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.restaurantSeller.findUnique({
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
      const newSub = await activateRestaurantFreePlan(seller.id)
      if (newSub) {
        subscription = await prisma.restaurantSubscription.findUnique({
          where: { restaurantSellerId: seller.id },
          include: { plan: true },
        })
      }
    }

    return NextResponse.json(subscription)
  } catch (error) {
    console.error("Error fetching restaurant subscription:", error)
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 })
  }
}
