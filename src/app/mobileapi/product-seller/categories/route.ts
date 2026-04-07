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
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: categories,
    });

  } catch (error: any) {
    console.error("Mobile product seller categories fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
