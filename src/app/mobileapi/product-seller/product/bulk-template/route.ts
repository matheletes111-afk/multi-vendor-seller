import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { verifyMobileAuth } from "@/lib/mobile-auth-server"
import {
  BULK_TEMPLATE_FILENAME_CSV,
  BULK_TEMPLATE_FILENAME_XLSX,
  buildTemplateCsv,
  buildTemplateXlsx,
} from "@/lib/product-seller-bulk-import-parse"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/product-seller/product/bulk-template
 * Download or inspect the bulk product upload template (XLSX, CSV, or JSON).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyMobileAuth(request, UserRole.SELLER_PRODUCT)
  if (!auth.success) return auth.errorResponse

  try {
    const seller = await prisma.seller.findUnique({
      where: { id: auth.seller.id },
      include: {
        selectedCategories: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
      },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    let categoryNames = seller.selectedCategories.map((c) => c.name)

    // Fallback: If seller hasn't selected categories yet, fetch active marketplace categories
    if (categoryNames.length === 0) {
      const activeCats = await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        take: 10,
        select: { name: true },
      })
      categoryNames = activeCats.map((c) => c.name)
    }

    if (categoryNames.length === 0) {
      return NextResponse.json(
        { success: false, error: "No active marketplace categories available. Please complete category selection first." },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const format = (searchParams.get("format") || "xlsx").toLowerCase()
    const dummy = searchParams.get("dummy") !== "false"

    // 1. JSON Format - schema metadata for mobile app in-app UI
    if (format === "json") {
      return NextResponse.json({
        success: true,
        data: {
          filename: dummy ? "product-bulk-example.xlsx" : "product-bulk-template.xlsx",
          sellerCategories: categoryNames,
          columns: [
            { key: "category", required: true, description: "Category name (must match one of your assigned categories or an active marketplace category)" },
            { key: "product_name", required: true, description: "Product name (rows with identical name will be grouped into one product with multiple variants)" },
            { key: "brand", required: false, description: "Brand name" },
            { key: "product_description", required: false, description: "Product overview / description" },
            { key: "condition", required: false, description: "NEW or USED (defaults to NEW)" },
            { key: "variant_name", required: true, description: "Variant title e.g. 'Red / XL' or 'Standard'" },
            { key: "price", required: true, description: "Original selling price in local currency" },
            { key: "discount", required: false, description: "Discount percentage or amount (defaults to 0)" },
            { key: "gst_applicable", required: false, description: "Tax applicable: YES / NO (defaults to YES)" },
            { key: "stock", required: true, description: "Available inventory count" },
            { key: "sku_code", required: false, description: "Unique seller stock keeping unit code" },
            { key: "weight", required: false, description: "Product weight in KG (mandatory for certain categories)" },
            { key: "height", required: false, description: "Package height in CM" },
            { key: "width", required: false, description: "Package width in CM" },
            { key: "depth", required: false, description: "Package depth in CM" },
            { key: "product_variant_images", required: false, description: "Image URLs separated by '|' or newline" },
            { key: "variant_details", required: false, description: "Key-value attributes e.g. color: Black, size: Regular (or JSON format)" },
            { key: "specifications", required: false, description: "Technical specifications text" },
            { key: "additional_details", required: false, description: "Care instructions or notes" },
            { key: "return_policy", required: false, description: "RETURNABLE or NON_RETURNABLE (defaults to NON_RETURNABLE)" },
            { key: "return_limit_days", required: false, description: "Days window allowed for return (e.g. 7)" },
            { key: "replacement_allowed", required: false, description: "YES or NO" },
            { key: "delivery_days", required: false, description: "Estimated delivery days (integer >= 1, defaults to 7)" },
          ],
          sampleRow: {
            category: categoryNames[0] || "General",
            product_name: "Premium Cotton T-Shirt",
            brand: "Meeem Basics",
            product_description: "100% organic cotton breathable casual t-shirt.",
            condition: "NEW",
            variant_name: "Black / L",
            price: "29.99",
            discount: "5",
            gst_applicable: "YES",
            stock: "50",
            sku_code: "TSHIRT-BLK-L",
            weight: "0.25",
            height: "2",
            width: "25",
            depth: "30",
            product_variant_images: "https://your-domain.com/uploads/products/sample1.jpg | https://your-domain.com/uploads/products/sample2.jpg",
            variant_details: "color: Black, size: L",
            specifications: "100% Combed Cotton, 180 GSM",
            additional_details: "Machine wash cold with like colors.",
            return_policy: "RETURNABLE",
            return_limit_days: "7",
            replacement_allowed: "YES",
            delivery_days: "5",
          },
        },
      })
    }

    // 2. CSV Format
    if (format === "csv") {
      const buf = buildTemplateCsv(categoryNames, dummy)
      const filename = dummy ? "product-bulk-example.csv" : BULK_TEMPLATE_FILENAME_CSV
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    // 3. XLSX Format (Default)
    const buf = buildTemplateXlsx(categoryNames, dummy)
    const filename = dummy ? "product-bulk-example.xlsx" : BULK_TEMPLATE_FILENAME_XLSX
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error("Mobile bulk template generation error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate bulk product template" },
      { status: 500 }
    )
  }
}
