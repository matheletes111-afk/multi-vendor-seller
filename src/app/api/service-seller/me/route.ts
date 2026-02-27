import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"

export async function GET() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true, type: true, isApproved: true, isSuspended: true },
  })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  if (seller.type !== "SERVICE") {
    return NextResponse.json({ error: "Not a service seller", type: seller.type }, { status: 400 })
  }
  return NextResponse.json(seller)
}
