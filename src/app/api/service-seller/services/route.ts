import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user || !isServiceSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return NextResponse.json({
      services: [],
      totalCount: 0,
      totalPages: 1,
      page: 1,
      perPage: 10,
    })
  }

  const { searchParams } = new URL(request.url)
  const { skip, take, page, perPage } = getPaginationFromSearchParams({
    page: searchParams.get("page") ?? undefined,
    perPage: searchParams.get("perPage") ?? undefined,
  })

  const where = { sellerId: seller.id, isDeleted: false }

  const [services, totalCount] = await Promise.all([
    prisma.service.findMany({
      where,
      skip,
      take,
      include: {
        serviceCategory: true,
        slots: true,
        packages: true,
        _count: {
          select: {
            orderItems: true,
            reviews: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.service.count({ where }),
  ])

  const totalPages = Math.ceil(totalCount / perPage) || 1

  return NextResponse.json({
    services,
    totalCount,
    totalPages,
    page,
    perPage,
  })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found." }, { status: 404 })
  }
  if (!seller.isApproved) {
    return NextResponse.json({ error: "Your seller account is pending approval." }, { status: 403 })
  }
  if (seller.isSuspended) {
    return NextResponse.json({ error: "Your seller account has been suspended." }, { status: 403 })
  }

  const { checkServiceLimit } = await import("@/lib/subscriptions")
  const limitCheck = await checkServiceLimit(seller.id)
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: `Service limit reached. You have ${limitCheck.current} and your plan allows ${
          limitCheck.limit === null ? "unlimited" : limitCheck.limit
        }. Please upgrade.`,
      },
      { status: 403 }
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
  }

  const { sanitizeInput } = await import("@/lib/html-sanitization")

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const serviceCategoryId = typeof body.serviceCategoryId === "string" ? body.serviceCategoryId.trim() : ""
  const serviceType = body.serviceType === "APPOINTMENT" || body.serviceType === "FIXED_PRICE" ? body.serviceType : null

  if (!name || !serviceCategoryId || !serviceType) {
    return NextResponse.json(
      { error: "Missing required fields: name, category, and service type are required." },
      { status: 400 }
    )
  }

  const cleanName = sanitizeInput(name)
  const slug = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  const sanitizedDescription =
    typeof body.description === "string" && body.description.trim() ? sanitizeInput(body.description.trim()) : null

  const basePrice = typeof body.basePrice === "number" && body.basePrice > 0 ? body.basePrice : null
  const discount = typeof body.discount === "number" && body.discount > 0 ? Math.round(body.discount * 100) / 100 : 0
  const hasGst = typeof body.hasGst === "boolean" ? body.hasGst : true
  const duration = typeof body.duration === "number" && body.duration > 0 ? Math.round(body.duration) : null

  const imagesData = Array.isArray(body.images) ? body.images.filter((img: any) => typeof img === "string" && img.trim()) : []
  const galleryData = Array.isArray(body.galleryImages)
    ? body.galleryImages.filter((img: any) => typeof img === "string" && img.trim())
    : []

  const weeklyAvailability = Array.isArray(body.weeklyAvailability) && body.weeklyAvailability.length === 7
    ? body.weeklyAvailability
    : undefined

  try {
    const service = await prisma.service.create({
      data: {
        sellerId: seller.id,
        serviceCategoryId,
        name: cleanName,
        slug,
        description: sanitizedDescription,
        serviceType,
        basePrice,
        discount,
        hasGst,
        duration,
        weeklyAvailability: weeklyAvailability as any,
        images: imagesData as any,
        galleryImages: galleryData as any,
      },
    })

    const { revalidatePath } = await import("next/cache")
    revalidatePath("/service-seller/services")

    return NextResponse.json({ success: true, service }, { status: 201 })
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Service with this name already exists" }, { status: 400 })
    }
    return NextResponse.json({ error: `Failed to create service: ${error.message || "Unknown error"}` }, { status: 500 })
  }
}

