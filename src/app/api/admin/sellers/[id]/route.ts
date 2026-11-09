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
        subscriptionPurchases: {
          include: { plan: true },
          orderBy: { createdAt: "desc" }
        },
        selectedCategories: true,
        selectedServiceCategories: true
      }
    })

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 })
    }

    const [plans, globalSetting] = await Promise.all([
      prisma.plan.findMany({
        where: { type: "PRODUCT_SERVICE" },
        orderBy: { price: "asc" }
      }),
      (prisma as any).globalSetting.findFirst({
        select: {
          baseCommission: true,
          productBaseCommission: true,
          serviceBaseCommission: true,
        },
      }),
    ])

    const fallbackBaseCommission = globalSetting?.baseCommission ?? 10.0
    const baseCommissionRate =
      seller.type === "SERVICE"
        ? (globalSetting?.serviceBaseCommission ?? fallbackBaseCommission)
        : (globalSetting?.productBaseCommission ?? fallbackBaseCommission)

    return NextResponse.json({ ...seller, plans, baseCommissionRate })
  } catch (error) {
    console.error("[SELLER_GET]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
