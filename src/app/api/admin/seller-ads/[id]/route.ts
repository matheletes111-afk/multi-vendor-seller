import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params

  const ad = await prisma.sellerAd.findUnique({
    where: { id },
    include: {
      product: true,
      service: true,
      hotel: true,
      restaurantSeller: {
        include: {
          user: { select: { email: true, name: true } }
        }
      },
      foodItem: true,
      _count: { select: { adClicks: true } },
    },
  })

  if (!ad) {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 })
  }
  return NextResponse.json({
    ...ad,
    totalBudget: Number(ad.totalBudget),
    spentAmount: Number(ad.spentAmount),
    maxCpc: Number(ad.maxCpc),
    targetCountries: ad.targetCountries as string[] | null,
  })
}
