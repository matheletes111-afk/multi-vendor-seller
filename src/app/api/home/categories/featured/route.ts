import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_FEATURED = 4;

/** GET up to 4 featured categories for mobile home. Public, no auth. */
export async function GET() {
  try {
    let categories = await prisma.category.findMany({
      where: {
        isActive: true,
        isFeatured: true,
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

    // If fewer than 4 featured categories, backfill with active categories that have subcategories or products
    if (categories.length < MAX_FEATURED) {
      const existingIds = categories.map((c) => c.id);
      const backfills = await prisma.category.findMany({
        where: {
          isActive: true,
          id: { notIn: existingIds },
          OR: [
            { subcategories: { some: { isActive: true } } },
            { products: { some: { isActive: true } } },
          ],
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
        take: MAX_FEATURED - categories.length,
      });
      categories = [...categories, ...backfills];
    }

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching featured categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured categories" },
      { status: 500 }
    );
  }
}
