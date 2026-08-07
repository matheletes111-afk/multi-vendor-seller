import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET active seller ads. Supports optional type filter: type=restaurant or type=hotel or type=service */
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
    } else if (type === "service") {
      whereClause = {
        ...whereClause,
        OR: [
          { serviceId: { not: null } },
          { seller: { type: "SERVICE" } }
        ]
      };
    } else if (type === "product") {
      whereClause = {
        ...whereClause,
        serviceId: null,
        hotelId: null,
        foodItemId: null,
        restaurantSellerId: null,
        hotelSellerId: null,
      };
    }

    const limitParam = searchParams.get("limit");
    let takeLimit: number | undefined = 50;
    if (limitParam === "all" || limitParam === "0") {
      takeLimit = undefined;
    } else if (limitParam && !isNaN(parseInt(limitParam, 10))) {
      takeLimit = parseInt(limitParam, 10);
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
      ...(takeLimit ? { take: takeLimit } : {}),
    });
    const shuffled = ads.sort(() => Math.random() - 0.5);
    return NextResponse.json(shuffled);
  } catch (error: any) {
    console.error("Error fetching ads:", error);
    return NextResponse.json(
      { error: "Failed to fetch ads", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
