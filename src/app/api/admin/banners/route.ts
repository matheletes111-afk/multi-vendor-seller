import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";

import { getPaginationFromSearchParams } from "@/lib/admin-pagination";
import { uploadPublicFile } from "@/lib/upload-public-file";
import { sanitizeInput } from "@/lib/html-sanitization";

// GET banners with pagination
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { skip, take, page, perPage } = getPaginationFromSearchParams({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    });

    const [banners, totalCount] = await Promise.all([
      prisma.banner.findMany({
        skip,
        take,
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          subcategory: {
            select: {
              id: true,
              name: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
          serviceCategory: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.banner.count(),
    ]);

    const totalPages = Math.ceil(totalCount / perPage);
    return NextResponse.json({
      banners,
      totalCount,
      totalPages,
      page,
      perPage,
    });
  } catch (error: any) {
    console.error("Error fetching banners:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch banners" },
      { status: 500 }
    );
  }
}

// POST create new banner
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    
    const bannerHeadingRaw = formData.get("bannerHeading") as string;
    const bannerHeading = sanitizeInput(bannerHeadingRaw);
    const bannerDescription = typeof formData.get("bannerDescription") === "string" ? sanitizeInput(formData.get("bannerDescription") as string) : null;
    const isActive = formData.get("isActive") === "true";
    const targetType = (formData.get("targetType") as string) || "product";
    const categoryId = (formData.get("categoryId") as string)?.trim() || null;
    const subcategoryId = (formData.get("subcategoryId") as string)?.trim() || null;
    const serviceCategoryId = (formData.get("serviceCategoryId") as string)?.trim() || null;
    
    const bannerImageFile = formData.get("bannerImage") as File | null;
    const bannerImageUrl = (formData.get("bannerImageUrl") as string)?.trim() || null;

    if (!bannerHeading) {
      return NextResponse.json(
        { error: "Banner heading is required" },
        { status: 400 }
      );
    }

    let bannerImagePath: string | null = bannerImageUrl;

    const getImageExtFromContentType = (contentType?: string | null) => {
      const ct = (contentType || "").toLowerCase();
      if (ct.includes("png")) return ".png";
      if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg";
      if (ct.includes("webp")) return ".webp";
      if (ct.includes("gif")) return ".gif";
      return ".jpg";
    };

    if (bannerImageFile && bannerImageFile.size > 0) {
      try {
        const bytes = await bannerImageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const contentType = bannerImageFile.type || "image/jpeg";
        const ext = getImageExtFromContentType(contentType);
        bannerImagePath = await uploadPublicFile({
          folder: "banners",
          ext,
          contentType,
          buffer,
          prefix: "banner",
        });
      } catch (uploadError) {
        console.error("Error uploading banner image:", uploadError);
        return NextResponse.json({ error: "Failed to upload banner image" }, { status: 500 });
      }
    }

    if (!bannerImagePath) {
      return NextResponse.json(
        { error: "Banner image is required (link or upload)" },
        { status: 400 }
      );
    }

    const banner = await prisma.banner.create({
      data: {
        bannerHeading,
        bannerDescription,
        bannerImage: bannerImagePath,
        isActive,
        targetType: targetType === "product" || targetType === "service" ? targetType : null,
        categoryId: targetType === "product" ? categoryId : null,
        subcategoryId: targetType === "product" ? subcategoryId : null,
        serviceCategoryId: targetType === "service" ? serviceCategoryId : null,
      },
      include: {
        category: true,
        subcategory: true,
        serviceCategory: true,
      },
    });

    return NextResponse.json(
      { message: "Banner created successfully", banner },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating banner:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create banner" },
      { status: 500 }
    );
  }
}