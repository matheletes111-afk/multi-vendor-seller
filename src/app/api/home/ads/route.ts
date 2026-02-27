import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET active seller ads for home page. Shows all ACTIVE ads (no date filter) so all approved ads appear. Public, no auth. */
export async function GET() {
  try {
    const ads = await prisma.sellerAd.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        title: true,
        creativeType: true,
        creativeUrl: true,
        productId: true,
        serviceId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json(ads);
  } catch (error) {
    console.error("Error fetching home ads:", error);
    return NextResponse.json(
      { error: "Failed to fetch ads" },
      { status: 500 }
    );
  }
}
