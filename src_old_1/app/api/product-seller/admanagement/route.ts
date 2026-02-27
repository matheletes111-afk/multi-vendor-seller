import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"

export async function GET() {
  const session = await auth()

  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller || seller.type !== "PRODUCT") {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const ads = await prisma.sellerAd.findMany({
    where: { sellerId: seller.id, productId: { not: null } },
    include: {
      product: { select: { id: true, name: true, slug: true } },
      _count: { select: { adClicks: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const serialized = ads.map((ad) => ({
    ...ad,
    totalBudget: Number(ad.totalBudget),
    spentAmount: Number(ad.spentAmount),
    maxCpc: Number(ad.maxCpc),
    targetCountries: ad.targetCountries as string[] | null,
  }))

  return NextResponse.json(serialized)
}
