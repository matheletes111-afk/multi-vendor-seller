import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export async function GET(request) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const { skip, take, page, perPage } = getPaginationFromSearchParams({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    })

    const [ads, totalCount] = await Promise.all([
      prisma.adManagement.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.adManagement.count(),
    ])

    const serializedAds = ads.map((ad) => ({
      id: ad.id,
      title: ad.title,
      description: ad.description,
      image: ad.image || null,
      isActive: ad.isActive,
    }))

    const totalPages = Math.ceil(totalCount / perPage)
    return NextResponse.json({
      ads: serializedAds,
      totalCount,
      totalPages,
      page,
      perPage,
    })
  } catch (error) {
    console.error("Error fetching ad management list:", error)
    return NextResponse.json(
      { error: "Failed to fetch advertisements" },
      { status: 500 }
    )
  }
}
