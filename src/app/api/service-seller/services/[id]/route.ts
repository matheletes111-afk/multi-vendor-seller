import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user || !isServiceSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const service = await prisma.service.findFirst({
    where: { id, sellerId: seller.id },
    include: { serviceCategory: true, slots: true, packages: true },
  })

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 })
  }

  const sellingPrice = service.basePrice != null ? Math.max(0, service.basePrice - (service.discount || 0)) : null

  return NextResponse.json({
    ...service,
    sellingPrice,
    discountedPrice: sellingPrice,
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  const service = await prisma.service.findFirst({ where: { id, sellerId: seller.id } })
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 })
  const deletedSlug = `${service.slug}-deleted-${Date.now()}`
  await prisma.service.update({ 
    where: { id },
    data: { 
      isDeleted: true,
      isActive: false,
      slug: deletedSlug
    } 
  })
  return NextResponse.json({ success: true })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

  const service = await prisma.service.findFirst({ where: { id, sellerId: seller.id } })
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
  }

  const { sanitizeInput } = await import("@/lib/html-sanitization")

  let updateData: any = {}

  if (typeof body.name === "string" && body.name.trim()) {
    const cleanName = sanitizeInput(body.name.trim())
    updateData.name = cleanName
    updateData.slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  }
  if (typeof body.description === "string") {
    updateData.description = body.description.trim() ? sanitizeInput(body.description.trim()) : null
  }
  if (typeof body.serviceCategoryId === "string" && body.serviceCategoryId.trim()) {
    updateData.serviceCategoryId = body.serviceCategoryId.trim()
  }
  if (body.serviceType === "APPOINTMENT" || body.serviceType === "FIXED_PRICE") {
    updateData.serviceType = body.serviceType
  }
  if (typeof body.isActive === "boolean") {
    updateData.isActive = body.isActive
  }
  if (typeof body.hasGst === "boolean") {
    updateData.hasGst = body.hasGst
  }
  const effectiveBasePrice = typeof body.basePrice === "number" ? (body.basePrice > 0 ? body.basePrice : null) : service.basePrice
  if (typeof body.basePrice === "number") {
    updateData.basePrice = body.basePrice > 0 ? body.basePrice : null
  }
  const rawSelling =
    typeof body.sellingPrice === "number" && body.sellingPrice > 0
      ? body.sellingPrice
      : typeof body.discount === "number" && body.discount > 0
      ? body.discount
      : 0
  if (typeof body.discount === "number" || typeof body.sellingPrice === "number") {
    let discount = 0
    if (effectiveBasePrice && rawSelling > 0) {
      if (rawSelling < effectiveBasePrice) {
        discount = Math.round((effectiveBasePrice - rawSelling) * 100) / 100
      }
    }
    updateData.discount = discount
  }
  if (typeof body.duration === "number") {
    updateData.duration = body.duration > 0 ? Math.round(body.duration) : null
  }
  if (Array.isArray(body.images)) {
    updateData.images = body.images.filter((img: any) => typeof img === "string" && img.trim())
  }
  if (Array.isArray(body.galleryImages)) {
    updateData.galleryImages = body.galleryImages.filter((img: any) => typeof img === "string" && img.trim())
  }
  if (Array.isArray(body.weeklyAvailability) && body.weeklyAvailability.length === 7) {
    updateData.weeklyAvailability = body.weeklyAvailability
  }

  try {
    const updated = await prisma.service.update({
      where: { id },
      data: updateData,
    })
    const { revalidatePath } = await import("next/cache")
    revalidatePath("/service-seller/services")

    return NextResponse.json({ success: true, service: updated })
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Service with this name already exists" }, { status: 400 })
    }
    return NextResponse.json({ error: `Failed to update service: ${error.message || "Unknown error"}` }, { status: 500 })
  }
}

