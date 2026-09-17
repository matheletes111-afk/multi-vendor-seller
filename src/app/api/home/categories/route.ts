import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shuffleArray } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET active categories with subcategories for home page category boxes with dynamic per-refresh randomization. Public, no auth. */
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
        OR: [
          { subcategories: { some: { isActive: true } } },
          { products: { some: { isActive: true } } },
        ],
      },
      include: {
        subcategories: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            mobileIcon: true,
          },
        },
      },
    });

    const randomizedCategories = shuffleArray(
      categories.map((c) => ({
        ...c,
        subcategories: shuffleArray(c.subcategories),
      }))
    );

    return NextResponse.json(randomizedCategories, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    console.error("Error fetching home categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

