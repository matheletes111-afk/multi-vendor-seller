import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isRestaurantSeller } from "@/lib/rbac"
import { getMobileHotelRestaurantSellerAuth } from "@/app/mobileapi/_helpers/hotel-restaurant-seller-auth"
import { UserRole } from "@prisma/client"
import { sanitizeInput } from "@/lib/html-sanitization"
import {
  parseBulkFoodFile,
  parseCleanNumber,
  parseBool,
  parseFoodImages,
  type BulkFoodDataRow,
} from "@/lib/restaurant-seller-bulk-import-parse"

const MAX_DATA_ROWS = 500
const MAX_FILE_BYTES = 8 * 1024 * 1024

export async function POST(request: NextRequest) {
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
    select: { id: true, isApproved: true, isSuspended: true },
  })
  if (!seller) {
    return NextResponse.json({ error: "Restaurant seller profile not found" }, { status: 404 })
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Please attach a CSV or XLSX file" }, { status: 400 })
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds 8MB limit" }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const parsed = parseBulkFoodFile(buf, file.name)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { rows } = parsed
  if (rows.length === 0) {
    return NextResponse.json({ error: "File contains no data rows" }, { status: 400 })
  }

  if (rows.length > MAX_DATA_ROWS) {
    return NextResponse.json(
      { error: `File contains ${rows.length} rows. Maximum allowed per upload is ${MAX_DATA_ROWS}.` },
      { status: 400 }
    )
  }

  const errors: string[] = []
  type PreparedFood = {
    name: string
    category: string
    price: number
    discount: number
    isVeg: boolean
    description: string
    images: string[]
    isActive: boolean
  }
  const preparedFoods: PreparedFood[] = []
  const allReferencedImages = new Set<string>()

  for (const r of rows) {
    const c = r.cells
    const rawName = (c.food_name ?? "").trim()
    const rawCategory = (c.category ?? "").trim()
    const rawPrice = c.price

    if (!rawName) {
      errors.push(`Row ${r.excelRow}: food_name is required`)
      continue
    }

    if (!rawCategory) {
      errors.push(`Row ${r.excelRow}: category is required for "${rawName}"`)
      continue
    }

    const price = parseCleanNumber(rawPrice)
    if (isNaN(price) || price <= 0) {
      errors.push(`Row ${r.excelRow}: valid price greater than 0 is required for "${rawName}"`)
      continue
    }

    let discount = 0
    if (c.discount !== undefined && c.discount !== null && String(c.discount).trim() !== "") {
      const rawSellingPrice = parseCleanNumber(c.discount)
      if (isNaN(rawSellingPrice) || rawSellingPrice <= 0) {
        errors.push(`Row ${r.excelRow}: selling_price must be greater than 0 for "${rawName}" (leave blank for no discount)`)
        continue
      }
      if (rawSellingPrice > price) {
        errors.push(`Row ${r.excelRow}: selling price (${rawSellingPrice}) cannot exceed regular price (${price}) for "${rawName}"`)
        continue
      }
      discount = Math.round((price - rawSellingPrice) * 100) / 100
    }

    const isVeg = parseBool(c.is_veg, true)
    const isActive = parseBool(c.is_active, true)
    const description = sanitizeInput(c.description ?? "")
    const name = sanitizeInput(rawName)
    const category = sanitizeInput(rawCategory)
    const images = parseFoodImages(c.food_images)

    images.forEach((imgUrl) => allReferencedImages.add(imgUrl))

    preparedFoods.push({
      name,
      category,
      price,
      discount,
      isVeg,
      description,
      images,
      isActive,
    })
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Import validation failed", errors: [...new Set(errors)] }, { status: 400 })
  }

  if (preparedFoods.length === 0) {
    return NextResponse.json({ error: "No valid food items found to import" }, { status: 400 })
  }

  try {
    const createdFoods = await prisma.$transaction(
      preparedFoods.map((f) =>
        prisma.foodItem.create({
          data: {
            restaurantSellerId: seller.id,
            name: f.name,
            category: f.category,
            price: f.price,
            discount: f.discount,
            isVeg: f.isVeg,
            description: f.description || null,
            images: f.images as any,
            isActive: f.isActive,
            isDeleted: false,
          },
        })
      )
    )

    // Mark matched restaurant media images as isUsed = true
    if (allReferencedImages.size > 0) {
      try {
        await prisma.restaurantMediaImage.updateMany({
          where: {
            restaurantSellerId: seller.id,
            url: { in: Array.from(allReferencedImages) },
          },
          data: { isUsed: true },
        })
      } catch (mediaErr) {
        console.warn("Could not auto-mark media images as used:", mediaErr)
      }
    }

    return NextResponse.json({
      success: true,
      count: createdFoods.length,
      message: `Successfully imported ${createdFoods.length} food items to your menu.`,
    })
  } catch (dbErr: any) {
    console.error("Bulk food items creation error:", dbErr)
    return NextResponse.json(
      { error: "Database transaction failed during bulk food import. Please try again." },
      { status: 500 }
    )
  }
}
