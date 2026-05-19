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

  const room = await prisma.room.findFirst({
    where: { 
      id: id,
      hotel: { hotelSellerId: seller.id },
      isDeleted: false
    },
    include: {
      hotel: {
        select: { name: true }
      }
    }
  })

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 })
  }

  return NextResponse.json(room)
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

  const existingRoom = await prisma.room.findFirst({
    where: { id: id, hotel: { hotelSellerId: seller.id } }
  })

  if (!existingRoom) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 })
  }

  const formData = await request.formData()
  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const priceRaw = formData.get("price") as string
  const price = priceRaw ? parseFloat(priceRaw) : undefined
  const capacityAdultsRaw = formData.get("capacityAdults") as string
  const capacityAdults = capacityAdultsRaw ? parseInt(capacityAdultsRaw, 10) : undefined
  const capacityChildrenRaw = formData.get("capacityChildren") as string
  const capacityChildren = capacityChildrenRaw ? parseInt(capacityChildrenRaw, 10) : undefined
  const totalRoomsRaw = formData.get("totalRooms") as string
  const totalRooms = totalRoomsRaw ? parseInt(totalRoomsRaw, 10) : undefined
  const amenitiesRaw = formData.get("amenities") as string
  
  const newImageFiles = formData.getAll("newImages") as File[]
  const existingImagesRaw = formData.get("existingImages") as string

  try {
    const amenities = amenitiesRaw ? JSON.parse(amenitiesRaw) : undefined
    const existingImages = existingImagesRaw ? JSON.parse(existingImagesRaw) : (existingRoom.images as string[])

    const imageUrls: string[] = [...existingImages]
    for (const file of newImageFiles) {
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

    const updatedRoom = await prisma.room.update({
      where: { id: id },
      data: {
        name: name || undefined,
        description: description || undefined,
        price,
        capacityAdults,
        capacityChildren,
        totalRooms,
        amenities: amenities as any,
        images: imageUrls as any,
      },
    })

    return NextResponse.json(updatedRoom)
  } catch (error: any) {
    console.error("Update room error:", error)
    return NextResponse.json({ error: error.message || "Failed to update room" }, { status: 500 })
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
    await prisma.room.update({
      where: { id: id },
      data: { isDeleted: true }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to delete room" }, { status: 500 })
  }
}
