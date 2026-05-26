import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import { UserRole } from "@prisma/client"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import { checkHotelLimit } from "@/lib/subscriptions"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_HOTEL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.hotelSeller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const { skip, take, page, perPage } = getPaginationFromSearchParams({
    page: searchParams.get("page") ?? undefined,
    perPage: searchParams.get("perPage") ?? undefined,
  })

  const q = searchParams.get("q") || ""
  const city = searchParams.get("city") || ""
  const rating = searchParams.get("rating") || ""

  const where: any = {
    hotelSellerId: seller.id,
    isDeleted: false,
  }

  if (q) {
    where.name = { contains: q, mode: "insensitive" }
  }
  if (city) {
    where.city = { contains: city, mode: "insensitive" }
  }
  if (rating) {
    where.starRating = parseInt(rating, 10)
  }

  const [hotels, totalCount] = await Promise.all([
    prisma.hotel.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { rooms: true }
        }
      }
    }),
    prisma.hotel.count({ where }),
  ])

  const totalPages = Math.ceil(totalCount / perPage) || 1

  return NextResponse.json({
    hotels,
    totalCount,
    totalPages,
    page,
    perPage,
  })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_HOTEL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.hotelSeller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const limitCheck = await checkHotelLimit(seller.id)
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: `Hotel listing limit reached (${limitCheck.limit}). Please upgrade your plan.` },
      { status: 403 }
    )
  }

  const formData = await request.formData()
  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const starRating = parseInt(formData.get("starRating") as string, 10) || 0
  const amenitiesRaw = formData.get("amenities") as string
  const checkInPolicy = formData.get("checkInPolicy") as string
  const checkOutPolicy = formData.get("checkOutPolicy") as string
  const address = formData.get("address") as string
  const city = formData.get("city") as string
  const state = formData.get("state") as string
  const lat = parseFloat(formData.get("lat") as string) || null
  const lng = parseFloat(formData.get("lng") as string) || null

  const imageFiles = formData.getAll("images") as File[]
  const logoFile = formData.get("logo") as File | null
  const bannerFile = formData.get("banner") as File | null

  try {
    const amenities = amenitiesRaw ? JSON.parse(amenitiesRaw) : []
    
    const imageUrls: string[] = []
    for (const file of imageFiles) {
      if (file && file.size > 0) {
        const url = await uploadPublicFile({
          folder: "hotels/gallery",
          ext: path.extname(file.name) || ".jpg",
          contentType: file.type || "image/jpeg",
          buffer: Buffer.from(await file.arrayBuffer()),
          prefix: "hotel-img",
        })
        imageUrls.push(url)
      }
    }

    let logoUrl = null
    if (logoFile && logoFile.size > 0) {
      logoUrl = await uploadPublicFile({
        folder: "hotels/logos",
        ext: path.extname(logoFile.name) || ".jpg",
        contentType: logoFile.type || "image/jpeg",
        buffer: Buffer.from(await logoFile.arrayBuffer()),
        prefix: "hotel-logo",
      })
    }

    let bannerUrl = null
    if (bannerFile && bannerFile.size > 0) {
      bannerUrl = await uploadPublicFile({
        folder: "hotels/banners",
        ext: path.extname(bannerFile.name) || ".jpg",
        contentType: bannerFile.type || "image/jpeg",
        buffer: Buffer.from(await bannerFile.arrayBuffer()),
        prefix: "hotel-banner",
      })
    }

    const hotel = await prisma.hotel.create({
      data: {
        hotelSellerId: seller.id,
        name,
        description,
        starRating,
        amenities,
        checkInPolicy,
        checkOutPolicy,
        address,
        city,
        state,
        lat,
        lng,
        images: imageUrls as any,
        logo: logoUrl,
        banner: bannerUrl,
      },
    })

    return NextResponse.json(hotel)
  } catch (error: any) {
    console.error("Create hotel error:", error)
    return NextResponse.json({ error: error.message || "Failed to create hotel" }, { status: 500 })
  }
}
