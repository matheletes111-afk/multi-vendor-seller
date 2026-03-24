import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/** GET /api/home/services — public list of active services for home carousel */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limitRaw = Number(searchParams.get("limit") ?? "12")
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 30) : 12
    const serviceCategoryId = searchParams.get("serviceCategoryId") ?? undefined

    const services = await prisma.service.findMany({
      where: {
        isActive: true,
        ...(serviceCategoryId ? { serviceCategoryId } : {}),
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        basePrice: true,
        discount: true,
        images: true,
        serviceCategory: { select: { id: true, name: true, slug: true } },
        seller: { select: { store: { select: { name: true } } } },
      },
    })

    return NextResponse.json(services)
  } catch (error) {
    console.error("Home services API error:", error)
    return NextResponse.json([], { status: 500 })
  }
}
