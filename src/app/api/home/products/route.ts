import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET products for home: optional categoryId for "Best Sellers in X", else featured + latest. Public, no auth. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const limit = Math.min(Number(searchParams.get("limit")) || 12, 24);

    const where = { isActive: true };
    if (categoryId) {
      (where as any).categoryId = categoryId;
    }

    const products = await prisma.product.findMany({
      where,
      take: limit,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        basePrice: true,
        discount: true,
        images: true,
        category: { select: { id: true, name: true, slug: true } },
        seller: { select: { store: { select: { name: true } } } },
      },
    });

    const serialized = products.map((p) => ({
      ...p,
      images: (p.images as string[]) || [],
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Error fetching home products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
