import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { id } = await params

    const seller = await prisma.seller.findUnique({
      where: { id },
      include: {
        user: true,
        store: true,
        businessInfo: true,
        kyc: true,
        bankDetails: true,
        agreement: true,
        subscription: {
          include: {
            plan: true
          }
        },
        selectedCategories: true,
        selectedServiceCategories: true
      }
    })

    if (!seller) {
      return new NextResponse("Seller not found", { status: 404 })
    }

    return NextResponse.json(seller)
  } catch (error) {
    console.error("[SELLER_GET]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
