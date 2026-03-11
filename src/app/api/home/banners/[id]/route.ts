import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET a single active banner by id. Public, no auth. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Banner id required" }, { status: 400 });

  try {
    const banner = await prisma.banner.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        bannerHeading: true,
        bannerDescription: true,
        bannerImage: true,
        categoryId: true,
        subcategoryId: true,
        serviceCategoryId: true,
      },
    });
    if (!banner) return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    return NextResponse.json(banner);
  } catch (error) {
    console.error("Error fetching banner:", error);
    return NextResponse.json(
      { error: "Failed to fetch banner" },
      { status: 500 }
    );
  }
}
