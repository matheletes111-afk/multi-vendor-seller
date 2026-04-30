import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMobileAuth } from "@/lib/mobile-auth-server";
import { UserRole } from "@prisma/client";

/**
 * GET /mobileapi/service-seller/categories
 * Fetch the list of service categories for the onboarding step 4 checklist.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyMobileAuth(request, UserRole.SELLER_SERVICE);
  if (!auth.success) return auth.errorResponse;

  try {
    const serviceCategories = await prisma.serviceCategory.findMany({
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
        isActive: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: serviceCategories,
    });

  } catch (error: any) {
    console.error("Mobile service seller categories fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch service categories" },
      { status: 500 }
    );
  }
}
