import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isHotelSeller } from "@/lib/rbac"

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

    const subscription = seller?.subscription || null
    return NextResponse.json(subscription)
  } catch (error) {
    console.error("Error fetching hotel subscription:", error)
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 })
  }
}
