import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileHotelRestaurantSellerAuth } from "@/app/mobileapi/_helpers/hotel-restaurant-seller-auth"
import { UserRole } from "@prisma/client"
import {
  BULK_FOOD_TEMPLATE_FILENAME_CSV,
  BULK_FOOD_TEMPLATE_FILENAME_XLSX,
  buildRestaurantTemplateCsv,
  buildRestaurantTemplateXlsx,
} from "@/lib/restaurant-seller-bulk-import-parse"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    return NextResponse.json({ success: false, error: authStatus.error === "unauthorized" ? "Unauthorized" : "Forbidden" }, { status: authStatus.error === "unauthorized" ? 401 : 403 })
  }

  const seller = await prisma.restaurantSeller.findUnique({
    where: { userId: authStatus.userId },
    select: { id: true, primaryCuisine: true },
  })
  if (!seller) return NextResponse.json({ success: false, error: "Restaurant seller not found" }, { status: 404 })

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
