import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const service = await prisma.service.findFirst({
      where: { id, isDeleted: false },
      include: { serviceCategory: true, slots: true, packages: true, seller: { include: { store: true, user: true } } },
    })

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    return NextResponse.json(service)
  } catch (error) {
    console.error("Error fetching single admin service:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.service.findFirst({
      where: { id, isDeleted: false },
    })
    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({})) as {
      name?: string
      description?: string
      serviceCategoryId?: string
      images?: string[]
      isActive?: boolean
      serviceType?: "APPOINTMENT" | "FIXED_PRICE"
      basePrice?: number | null
      discount?: number
      hasGst?: boolean
      duration?: number | null
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.description !== undefined) updateData.description = body.description
    if (body.serviceCategoryId !== undefined) updateData.serviceCategoryId = body.serviceCategoryId
    if (body.images !== undefined) updateData.images = Array.isArray(body.images) ? body.images : (existing as { images: unknown }).images
    if (typeof body.isActive === "boolean") updateData.isActive = body.isActive
    if (body.serviceType !== undefined) {
      updateData.serviceType = body.serviceType === "APPOINTMENT" ? "APPOINTMENT" : "FIXED_PRICE"
    }
    if (body.basePrice !== undefined) updateData.basePrice = body.basePrice !== null ? Number(body.basePrice || 0) : null
    if (body.discount !== undefined) updateData.discount = Math.round(Number(body.discount || 0) * 100) / 100
    if (body.hasGst !== undefined) updateData.hasGst = body.hasGst === true
    if (body.duration !== undefined) updateData.duration = body.duration !== null ? Math.floor(Number(body.duration || 0)) : null

    if (body.name) {
      (updateData as { slug?: string }).slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    }

    const service = await prisma.service.update({
      where: { id },
      data: updateData as any,
      include: { serviceCategory: true },
    })

    return NextResponse.json(service)
  } catch (error) {
    console.error("Error updating admin service:", error)
    return NextResponse.json(
      { error: `Failed to update: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const service = await prisma.service.findUnique({ where: { id } })
    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

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
  } catch (error) {
    console.error("Error deleting service:", error)
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 })
  }
}
