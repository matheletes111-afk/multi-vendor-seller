import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET active seller ads. Supports optional type filter: type=restaurant or type=hotel */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const now = new Date();

    let whereClause: any = {
      status: "ACTIVE",
      startAt: { lte: now },
      endAt: { gte: now }
    };

    if (type === "restaurant") {
      whereClause = {
        ...whereClause,
        OR: [
          { restaurantSellerId: { not: null } },
          { foodItemId: { not: null } }
        ]
      };
    } else if (type === "hotel") {
      whereClause = {
        ...whereClause,
        OR: [
          { hotelSellerId: { not: null } },
          { hotelId: { not: null } }
        ]
      };
    }

    const ads = await prisma.sellerAd.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        creativeType: true,
        creativeUrl: true,
        productId: true,
        serviceId: true,
        hotelId: true,
        foodItemId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json(ads);
  } catch (error) {
    console.error("Error fetching ads:", error);
    return NextResponse.json(
      { error: "Failed to fetch ads" },
      { status: 500 }
    );
  }
}
