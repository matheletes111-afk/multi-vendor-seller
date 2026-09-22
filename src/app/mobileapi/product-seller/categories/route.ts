import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMobileAuth } from "@/lib/mobile-auth-server";
import { UserRole } from "@prisma/client";

/**
 * GET /mobileapi/product-seller/categories
 * Fetch the list of product categories for the onboarding step 4 checklist.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyMobileAuth(request, UserRole.SELLER_PRODUCT);
  if (!auth.success) return auth.errorResponse;

  try {
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { isActive: true },
          { sellers: { some: { id: auth.seller.id } } }
        ]
      },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        mobileIcon: true,
        isActive: true,
        products: {
          where: { isActive: true, isDeleted: false },
          select: { images: true },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    const formattedCategories = categories.map((cat) => {
      const prodImg = Array.isArray(cat.products?.[0]?.images) ? cat.products[0].images[0] : null;
      const resolvedImg = cat.image || cat.mobileIcon || prodImg || null;
      return {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        image: resolvedImg,
        mobileIcon: cat.mobileIcon || resolvedImg,
        isActive: cat.isActive,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedCategories,
    });

  } catch (error: any) {
    console.error("Mobile product seller categories fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
