import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSeller } from "@/lib/rbac"

export async function GET() {
  const session = await auth()

  if (!session?.user || !isSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
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
}
