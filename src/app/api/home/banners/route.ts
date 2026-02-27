import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET active banners for home page carousel. Public, no auth. */
export async function GET() {
  try {
    const banners = await prisma.banner.findMany({
      where: { isActive: true },
      select: {
        id: true,
        bannerHeading: true,
        bannerDescription: true,
        bannerImage: true,
        categoryId: true,
        subcategoryId: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(banners);
  } catch (error) {
    console.error("Error fetching home banners:", error);
    return NextResponse.json(
      { error: "Failed to fetch banners" },
      { status: 500 }
    );
  }
}
