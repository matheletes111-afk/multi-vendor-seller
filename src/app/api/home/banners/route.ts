import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET active banners for home page carousel. Public, no auth. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get("targetType");

    let whereClause: any = { isActive: true };
    if (targetType === "product" || targetType === "home") {
      whereClause.OR = [
        { targetType: "product" },
        { targetType: "home" },
        { targetType: null },
        { targetType: "" },
        { categoryId: { not: null } },
        { subcategoryId: { not: null } },
      ];
    } else if (targetType === "service") {
      whereClause.OR = [
        { targetType: "service" },
        { serviceCategoryId: { not: null } },
      ];
    } else if (targetType === "hotel") {
      whereClause.targetType = "hotel";
    } else if (targetType === "restaurant") {
      whereClause.targetType = "restaurant";
    } else if (targetType) {
      whereClause.targetType = targetType;
    }

    const banners = await prisma.banner.findMany({
      where: whereClause,
      select: {
        id: true,
        bannerHeading: true,
        bannerDescription: true,
        bannerImage: true,
        mobileBanner: true,
        categoryId: true,
        subcategoryId: true,
        serviceCategoryId: true,
        targetType: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    const formattedBanners = banners.map((b) => ({
      ...b,
      mobile_banner: b.mobileBanner || b.bannerImage,
      mobileBanner: b.mobileBanner || b.bannerImage,
    }));
    return NextResponse.json(formattedBanners);
  } catch (error) {
    console.error("Error fetching home banners:", error);
    return NextResponse.json(
      { error: "Failed to fetch banners" },
      { status: 500 }
    );
  }
}
