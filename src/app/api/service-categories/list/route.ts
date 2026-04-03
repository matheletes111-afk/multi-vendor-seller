import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/** GET active service categories for dropdowns. Publicly reachable via product/service lists. */
export async function GET() {
  try {
    const categories = await prisma.serviceCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(categories)
  } catch (error) {
    console.error("Error fetching service categories list:", error)
    return NextResponse.json(
      { error: "Failed to fetch service categories" },
      { status: 500 }
    )
  }
}
