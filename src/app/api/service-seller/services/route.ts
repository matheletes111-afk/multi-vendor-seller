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
  })

  if (!seller) {
    return NextResponse.json([])
  }

  const services = await prisma.service.findMany({
    where: { sellerId: seller.id },
    include: {
      category: true,
      slots: true,
      packages: true,
      _count: {
        select: {
          orderItems: true,
          reviews: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(services)
}
