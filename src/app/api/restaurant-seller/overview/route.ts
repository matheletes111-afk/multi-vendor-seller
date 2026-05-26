import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isRestaurantSeller } from "@/lib/rbac"
import { getValidRestaurantSubscription } from "@/lib/subscriptions"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || !isRestaurantSeller(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [seller, globalSetting] = await Promise.all([
      prisma.restaurantSeller.findUnique({
        where: { userId: session.user.id },
        select: { id: true, commissionRate: true, estimateRestaurantCount: true },
      }),
      prisma.globalSetting.findFirst(),
    ])

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 })
    }

    const subscription = await getValidRestaurantSubscription(seller.id)

    return NextResponse.json({
      subscription,
      commissionRate: seller.commissionRate ?? globalSetting?.baseCommission ?? 10.0,
      isGlobalRate: seller.commissionRate === null || seller.commissionRate === undefined,
      estimateRestaurantCount: seller.estimateRestaurantCount,
    })
  } catch (error) {
    console.error("Error in restaurant seller overview API:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
