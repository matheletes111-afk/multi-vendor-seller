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

  return NextResponse.json(service)
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
