import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"

/** GET categories selected by the current seller during onboarding. */
export async function GET() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: {
      selectedCategories: {
        where: { isActive: true },
        include: {
          subcategories: {
            where: { isActive: true },
            select: { id: true, name: true, slug: true },
            orderBy: { name: "asc" }
          },
        },
        orderBy: { name: "asc" }
      }
    },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  return NextResponse.json(seller.selectedCategories)
}
