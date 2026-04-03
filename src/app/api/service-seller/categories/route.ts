import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"

/** GET service categories selected by the current provider during onboarding. */
export async function GET() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: {
      selectedServiceCategories: {
        where: { isActive: true },
        orderBy: { name: "asc" }
      }
    },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  return NextResponse.json(seller.selectedServiceCategories)
}
