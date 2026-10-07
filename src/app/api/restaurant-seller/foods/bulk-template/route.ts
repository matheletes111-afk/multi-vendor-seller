import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isRestaurantSeller } from "@/lib/rbac"
import { getMobileHotelRestaurantSellerAuth } from "@/app/mobileapi/_helpers/hotel-restaurant-seller-auth"
import { UserRole } from "@prisma/client"
import {
  BULK_FOOD_TEMPLATE_FILENAME_CSV,
  BULK_FOOD_TEMPLATE_FILENAME_XLSX,
  buildRestaurantTemplateCsv,
  buildRestaurantTemplateXlsx,
} from "@/lib/restaurant-seller-bulk-import-parse"

export async function GET(request: NextRequest) {
  let sellerUserId: string | null = null

  const session = await auth()
  if (session?.user && isRestaurantSeller(session.user)) {
    sellerUserId = session.user.id
  } else {
    const mobileAuth = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
    if (mobileAuth.ok) {
      sellerUserId = mobileAuth.userId
    }
  }

  if (!sellerUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.restaurantSeller.findUnique({
    where: { userId: sellerUserId },
    select: { id: true, primaryCuisine: true },
  })
  if (!seller) return NextResponse.json({ error: "Restaurant seller not found" }, { status: 404 })

  let cuisines: string[] = []
  if (seller.primaryCuisine) {
    try {
      const parsed = typeof seller.primaryCuisine === "string" ? JSON.parse(seller.primaryCuisine) : seller.primaryCuisine
      if (Array.isArray(parsed) && parsed.length > 0) {
        cuisines = parsed.map(String)
      }
    } catch {}
  }

  if (cuisines.length === 0) {
    cuisines = ["Mains", "Starters", "Biryani", "Desserts", "Beverages"]
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format")?.toLowerCase() ?? "xlsx"
  const dummy = searchParams.get("dummy") !== "false"

  if (format === "xlsx") {
    const buf = buildRestaurantTemplateXlsx(cuisines, dummy)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${BULK_FOOD_TEMPLATE_FILENAME_XLSX}"`,
      },
    })
  }

  const buf = buildRestaurantTemplateCsv(cuisines, dummy)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${BULK_FOOD_TEMPLATE_FILENAME_CSV}"`,
    },
  })
}
