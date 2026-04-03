import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/** GET active categories for dropdowns. Public, no auth. */
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    })
    return NextResponse.json({ categories }) // Returning as object for backward compatibility
  } catch (error) {
    console.error("Error fetching categories:", error)
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    )
  }
}
