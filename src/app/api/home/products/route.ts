import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shuffleArray } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET products for home: optional categoryId for "Best Sellers in X", else featured + latest. Dynamic per-refresh randomization across all sellers. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const limit = Math.min(Number(searchParams.get("limit")) || 48, 60);

    const where: any = {
      isActive: true,
      isDeleted: false,
      seller: {
        isApproved: true,
        isSuspended: false,
      }
    };
    if (categoryId) {
      where.categoryId = categoryId;
    } else {
      const session = await auth();
      if (session?.user?.id && session.user.role === UserRole.CUSTOMER) {
        const interests = await prisma.userCategoryInterest.findMany({
          where: { userId: session.user.id },
          select: { categoryId: true },
        });
        const ids = interests.map((i) => i.categoryId);
        if (ids.length > 0) {
          where.categoryId = { in: ids };
        }
      }
    }

    // Fetch an oversampled candidate pool to shuffle across all sellers
    const candidatePool = await prisma.product.findMany({
      where,
      take: Math.max(limit * 3, 100),
      select: {
        id: true,
        name: true,
        slug: true,
        images: true,
        category: { select: { id: true, name: true, slug: true } },
        seller: { select: { store: { select: { name: true } } } },
        variants: {
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { price: true, discount: true },
        },
        _count: { select: { reviews: true } },
      },
    });

    // Randomize order on each refresh and slice to requested limit
    const products = shuffleArray(candidatePool).slice(0, limit);

    const productIds = products.map((p) => p.id);
    const ratingRows = productIds.length > 0
      ? await prisma.review.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds } },
        _avg: { rating: true },
      })
      : [];

    const ratingByProduct = Object.fromEntries(
      ratingRows.map((r) => [r.productId, Number(r._avg.rating ?? 0)])
    ) as Record<string, number>;

    const serialized = products.map((p) => {
      const first = p.variants[0];
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        images: (p.images as string[]) || [],
        category: p.category,
        seller: p.seller,
        basePrice: first?.price ?? 0,
        discount: first?.discount ?? 0,
        _count: p._count,
        averageRating: ratingByProduct[p.id] ?? 0,
      };
    });

    return NextResponse.json(serialized, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    console.error("Error fetching home products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products", log: error },
      { status: 500 }
    );
  }
}

