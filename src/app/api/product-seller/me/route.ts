import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"

/** GET current product seller. Used by layout to redirect if no seller or wrong type. */
export async function GET() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      type: true,
      isApproved: true,
      isSuspended: true,
    },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  if (seller.type !== "PRODUCT") {
    return NextResponse.json(
      { error: "Not a product seller", type: seller.type },
      { status: 400 }
    )
  }

  return NextResponse.json(seller)
}
