import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import {
  BULK_TEMPLATE_FILENAME_CSV,
  BULK_TEMPLATE_FILENAME_XLSX,
  buildTemplateCsv,
  buildTemplateXlsx,
} from "@/lib/product-seller-bulk-import-parse"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: {
      selectedCategories: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true },
      },
    },
  })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  if (seller.selectedCategories.length === 0) {
    return NextResponse.json({ error: "No categories assigned. Complete onboarding first." }, { status: 400 })
  }

  const categoryIds = seller.selectedCategories.map((c) => c.id)
  const format = new URL(request.url).searchParams.get("format")?.toLowerCase() ?? "csv"

  if (format === "xlsx") {
    const buf = buildTemplateXlsx(categoryIds)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${BULK_TEMPLATE_FILENAME_XLSX}"`,
      },
    })
  }

  const buf = buildTemplateCsv(categoryIds)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${BULK_TEMPLATE_FILENAME_CSV}"`,
    },
  })
}
