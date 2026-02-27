import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

import { getPaginationFromSearchParams } from "@/lib/admin-pagination";

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
    
    const bannerHeading = formData.get("bannerHeading") as string;
    const bannerDescription = formData.get("bannerDescription") as string || null;
    const isActive = formData.get("isActive") === "true";
    const categoryId = formData.get("categoryId") as string || null;
    const subcategoryId = formData.get("subcategoryId") as string || null;
    
    const bannerImageFile = formData.get("bannerImage") as File | null;
    const bannerImageUrl = (formData.get("bannerImageUrl") as string)?.trim() || null;

    if (!bannerHeading) {
      return NextResponse.json(
        { error: "Banner heading is required" },
        { status: 400 }
      );
    }

    let bannerImagePath: string | null = bannerImageUrl;

    if (bannerImageFile && bannerImageFile.size > 0) {
      try {
        const bytes = await bannerImageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileExtension = path.extname(bannerImageFile.name);
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 10000);
        const fileName = `banner-${timestamp}-${randomNum}${fileExtension}`;
        const uploadDir = path.join(process.cwd(), "public/uploads/banners");
        if (!existsSync(uploadDir)) {
          await mkdir(uploadDir, { recursive: true });
        }
        const filePath = path.join(uploadDir, fileName);
        await writeFile(filePath, buffer);
        bannerImagePath = `/uploads/banners/${fileName}`;
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

    // Create banner
    const banner = await prisma.banner.create({
      data: {
        bannerHeading,
        bannerDescription,
        bannerImage: bannerImagePath,
        isActive,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
      },
      include: {
        category: true,
        subcategory: true,
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