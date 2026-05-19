import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import { UserRole } from "@prisma/client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const hotel = await prisma.hotel.findUnique({
    where: { 
      id: id,
      hotelSellerId: seller.id,
      isDeleted: false
    },
    include: {
      rooms: {
        where: { isDeleted: false }
      }
    }
  })

  if (!hotel) {
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 })
  }

  return NextResponse.json(hotel)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const existingHotel = await prisma.hotel.findUnique({
    where: { id: id, hotelSellerId: seller.id }
  })

  if (!existingHotel) {
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 })
  }

  const formData = await request.formData()
  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const starRatingRaw = formData.get("starRating") as string
  const starRating = starRatingRaw ? parseInt(starRatingRaw, 10) : undefined
  const amenitiesRaw = formData.get("amenities") as string
  const checkInPolicy = formData.get("checkInPolicy") as string
  const checkOutPolicy = formData.get("checkOutPolicy") as string
  const address = formData.get("address") as string
  const city = formData.get("city") as string
  const state = formData.get("state") as string
  const latRaw = formData.get("lat") as string
  const lat = latRaw ? parseFloat(latRaw) : undefined
  const lngRaw = formData.get("lng") as string
  const lng = lngRaw ? parseFloat(lngRaw) : undefined

  const newImageFiles = formData.getAll("newImages") as File[]
  const existingImagesRaw = formData.get("existingImages") as string // JSON array of URLs to keep
  
  const logoFile = formData.get("logo") as File | null
  const bannerFile = formData.get("banner") as File | null

  try {
    const amenities = amenitiesRaw ? JSON.parse(amenitiesRaw) : undefined
    const existingImages = existingImagesRaw ? JSON.parse(existingImagesRaw) : (existingHotel.images as string[])

    const imageUrls: string[] = [...existingImages]
    for (const file of newImageFiles) {
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

    let logoUrl = existingHotel.logo
    if (logoFile && logoFile.size > 0) {
      logoUrl = await uploadPublicFile({
        folder: "hotels/logos",
        ext: path.extname(logoFile.name) || ".jpg",
        contentType: logoFile.type || "image/jpeg",
        buffer: Buffer.from(await logoFile.arrayBuffer()),
        prefix: "hotel-logo",
      })
    }

    let bannerUrl = existingHotel.banner
    if (bannerFile && bannerFile.size > 0) {
      bannerUrl = await uploadPublicFile({
        folder: "hotels/banners",
        ext: path.extname(bannerFile.name) || ".jpg",
        contentType: bannerFile.type || "image/jpeg",
        buffer: Buffer.from(await bannerFile.arrayBuffer()),
        prefix: "hotel-banner",
      })
    }

    const updatedHotel = await prisma.hotel.update({
      where: { id: id },
      data: {
        name: name || undefined,
        description: description || undefined,
        starRating,
        amenities: amenities as any,
        checkInPolicy: checkInPolicy || undefined,
        checkOutPolicy: checkOutPolicy || undefined,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        lat,
        lng,
        images: imageUrls as any,
        logo: logoUrl,
        banner: bannerUrl,
      },
    })

    return NextResponse.json(updatedHotel)
  } catch (error: any) {
    console.error("Update hotel error:", error)
    return NextResponse.json({ error: error.message || "Failed to update hotel" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  try {
    await prisma.hotel.update({
      where: { id: id, hotelSellerId: seller.id },
      data: { isDeleted: true }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to delete hotel" }, { status: 500 })
  }
}
