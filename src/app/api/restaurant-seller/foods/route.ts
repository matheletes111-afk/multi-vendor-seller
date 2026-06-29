import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import { sanitizeInput } from "@/lib/html-sanitization"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "SELLER_RESTAURANT") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId: session.user.id }
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

    return NextResponse.json({ success: true, data: foods })
  } catch (error) {
    console.error("Web get food items error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "SELLER_RESTAURANT") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId: session.user.id }
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
    const singleImageFile = formData.get("image") as File | null

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
    } else if (singleImageFile && singleImageFile.size > 0) {
      const url = await uploadPublicFile({
        folder: "foods",
        ext: path.extname(singleImageFile.name) || ".jpg",
        contentType: singleImageFile.type || "image/jpeg",
        buffer: Buffer.from(await singleImageFile.arrayBuffer()),
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

    return NextResponse.json({ success: true, data: foodItem }, { status: 201 })
  } catch (error) {
    console.error("Web create food item error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
