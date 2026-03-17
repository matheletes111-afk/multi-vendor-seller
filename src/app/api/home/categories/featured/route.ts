import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_FEATURED = 4;

/** GET up to 4 featured categories for mobile home. Public, no auth. */
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
        isFeatured: true,
        products: { some: { isActive: true } },
      },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            mobileIcon: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_FEATURED,
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching featured categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured categories" },
      { status: 500 }
    );
  }
}
