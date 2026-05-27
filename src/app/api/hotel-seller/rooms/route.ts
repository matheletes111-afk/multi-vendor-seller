import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import { UserRole } from "@prisma/client"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import { checkHotelRoomLimit } from "@/lib/subscriptions"

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
  const hotelId = searchParams.get("hotelId") || ""
  const minPrice = searchParams.get("minPrice") || ""
  const maxPrice = searchParams.get("maxPrice") || ""

  const where: any = {
    hotel: {
      hotelSellerId: seller.id
    },
    isDeleted: false,
  }

  if (q) {
    where.name = { contains: q, mode: "insensitive" }
  }
  if (hotelId) {
    where.hotelId = hotelId
  }
  if (minPrice || maxPrice) {
    where.price = {}
    if (minPrice) where.price.gte = parseFloat(minPrice)
    if (maxPrice) where.price.lte = parseFloat(maxPrice)
  }

  const [rooms, totalCount] = await Promise.all([
    prisma.room.findMany({
      where,
      skip,
      take,
      include: {
        hotel: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.room.count({ where }),
  ])

  const totalPages = Math.ceil(totalCount / perPage) || 1

  return NextResponse.json({
    rooms,
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

  const limitCheck = await checkHotelRoomLimit(seller.id)
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: `Room listing limit reached (${limitCheck.limit}). Please upgrade your plan.` },
      { status: 403 }
    )
  }

  const formData = await request.formData()
  const hotelId = formData.get("hotelId") as string
  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const price = parseFloat(formData.get("price") as string) || 0
  const capacityAdults = parseInt(formData.get("capacityAdults") as string, 10) || 2
  const capacityChildren = parseInt(formData.get("capacityChildren") as string, 10) || 0
  const totalRooms = parseInt(formData.get("totalRooms") as string, 10) || 1
  const amenitiesRaw = formData.get("amenities") as string

  // Validate hotel ownership
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId, hotelSellerId: seller.id }
  })
  if (!hotel) return NextResponse.json({ error: "Invalid hotel selected" }, { status: 400 })

  const imageFiles = formData.getAll("images") as File[]

  try {
    const amenities = amenitiesRaw ? JSON.parse(amenitiesRaw) : []
    
    const imageUrls: string[] = []
    for (const file of imageFiles) {
      if (file && file.size > 0) {
        const url = await uploadPublicFile({
          folder: "rooms/gallery",
          ext: path.extname(file.name) || ".jpg",
          contentType: file.type || "image/jpeg",
          buffer: Buffer.from(await file.arrayBuffer()),
          prefix: "room-img",
        })
        imageUrls.push(url)
      }
    }

    const room = await prisma.room.create({
      data: {
        hotelId,
        name,
        description,
        price,
        capacityAdults,
        capacityChildren,
        totalRooms,
        amenities,
        images: imageUrls as any,
      },
    })

    return NextResponse.json(room)
  } catch (error: any) {
    console.error("Create room error:", error)
    return NextResponse.json({ error: error.message || "Failed to create room" }, { status: 500 })
  }
}
