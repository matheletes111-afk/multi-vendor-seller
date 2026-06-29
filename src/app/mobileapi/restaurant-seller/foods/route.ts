import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import { sanitizeInput } from "@/lib/html-sanitization"

export const dynamic = "force-dynamic"

// GET: List restaurant seller's foods
export async function GET(request: NextRequest) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const foods = await prisma.foodItem.findMany({
      where: {
        restaurantSellerId: seller.id,
        isDeleted: false
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json({
      success: true,
      data: foods
    })
  } catch (error: any) {
    console.error("Mobile list food items error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// POST: Add a new food item
export async function POST(request: NextRequest) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const name = sanitizeInput(formData.get("name") as string)
    const description = sanitizeInput(formData.get("description") as string || "")
    const priceRaw = formData.get("price")
    const category = sanitizeInput(formData.get("category") as string)
    const isVegRaw = formData.get("isVeg")
    const imageFiles = formData.getAll("images") as File[]
    const imageFile = formData.get("image") as File | null

    if (!name || !priceRaw || !category) {
      return NextResponse.json({ success: false, error: "Name, price, and category are required" }, { status: 400 })
    }

    const price = parseFloat(String(priceRaw))
    if (isNaN(price) || price < 0) {
      return NextResponse.json({ success: false, error: "Price must be a positive number" }, { status: 400 })
    }

    const isVeg = isVegRaw === "true" || isVegRaw === "1"

    const imageUrls: string[] = []
    if (imageFiles && imageFiles.length > 0) {
      for (const file of imageFiles) {
        if (file && file.size > 0) {
          const url = await uploadPublicFile({
            folder: "foods",
            ext: path.extname(file.name) || ".jpg",
            contentType: file.type || "image/jpeg",
            buffer: Buffer.from(await file.arrayBuffer()),
            prefix: "food-img"
          })
          imageUrls.push(url)
        }
      }
    } else if (imageFile && imageFile.size > 0) {
      const url = await uploadPublicFile({
        folder: "foods",
        ext: path.extname(imageFile.name) || ".jpg",
        contentType: imageFile.type || "image/jpeg",
        buffer: Buffer.from(await imageFile.arrayBuffer()),
        prefix: "food-img"
      })
      imageUrls.push(url)
    }

    const foodItem = await prisma.foodItem.create({
      data: {
        restaurantSellerId: seller.id,
        name,
        description,
        price,
        category,
        isVeg,
        images: imageUrls as any
      }
    })

    return NextResponse.json({
      success: true,
      message: "Food item created successfully",
      data: foodItem
    }, { status: 201 })
  } catch (error: any) {
    console.error("Mobile create food item error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
