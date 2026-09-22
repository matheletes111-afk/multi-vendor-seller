import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shuffleArray } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_FEATURED = 4;

/** GET up to 4 featured categories with dynamic per-refresh randomization. Public, no auth. */
export async function GET() {
  try {
    const featuredPool = await prisma.category.findMany({
      where: {
        isActive: true,
        isFeatured: true,
      },
      include: {
        products: {
          where: { isActive: true, isDeleted: false },
          select: { images: true },
          take: 1,
        },
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
      take: 20,
    });

    let categories = shuffleArray(featuredPool).slice(0, MAX_FEATURED);

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
          products: {
            where: { isActive: true, isDeleted: false },
            select: { images: true },
            take: 1,
          },
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
        take: 20,
      });
      const shuffledBackfills = shuffleArray(backfills).slice(0, MAX_FEATURED - categories.length);
      categories = [...categories, ...shuffledBackfills];
    }

    const randomizedCategories = categories.map((c) => {
      const prodImg = Array.isArray(c.products?.[0]?.images) ? c.products[0].images[0] : null;
      const resolvedImage = c.image || c.mobileIcon || prodImg || c.subcategories?.[0]?.image || null;
      return {
        ...c,
        image: resolvedImage,
        mobileIcon: c.mobileIcon || resolvedImage,
        subcategories: shuffleArray(c.subcategories),
      };
    });

    return NextResponse.json(randomizedCategories, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    console.error("Error fetching featured categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured categories" },
      { status: 500 }
    );
  }
}

