import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { generateSlug } from "@/lib/utils";
import { getPaginationFromSearchParams } from "@/lib/admin-pagination";
import { uploadPublicFile } from "@/lib/upload-public-file";
import { sanitizeInput } from "@/lib/html-sanitization";

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

    const [categories, totalCount] = await Promise.all([
      prisma.serviceCategory.findMany({
        skip,
        take,
        include: {
          _count: { select: { services: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
      prisma.serviceCategory.count(),
    ]);

    const totalPages = Math.ceil(totalCount / perPage);
    return NextResponse.json({
      categories,
      totalCount,
      totalPages,
      page,
      perPage,
    });
  } catch (error: any) {
    console.error("Error fetching service categories:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch service categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const nameRaw = formData.get("name") as string;
    const name = sanitizeInput(nameRaw);
    const description = typeof formData.get("description") === "string" ? sanitizeInput(formData.get("description") as string) : null;
    const commissionRate = 0.0; // Commission is being disabled project-wide
    const isActive = formData.get("isActive") === "true";
    const categoryImageFile = formData.get("categoryImage") as File | null;
    const categoryImageUrl = (formData.get("categoryImageUrl") as string)?.trim() || null;
    const mobileIconFile = formData.get("mobileIcon") as File | null;
    const mobileIconUrl = (formData.get("mobileIconUrl") as string)?.trim() || null;

    let categoryImagePath = categoryImageUrl;
    let mobileIconPath = mobileIconUrl;

    const getImageExtFromContentType = (contentType?: string | null) => {
      const ct = (contentType || "").toLowerCase();
      if (ct.includes("png")) return ".png";
      if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg";
      if (ct.includes("webp")) return ".webp";
      if (ct.includes("gif")) return ".gif";
      return ".jpg";
    };

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const slug = generateSlug(name);
    const existing = await prisma.serviceCategory.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "A service category with this name already exists" },
        { status: 400 }
      );
    }

    if (categoryImageFile && (categoryImageFile.size ?? 0) > 0) {
      try {
        const bytes = await categoryImageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const contentType = categoryImageFile.type || "image/jpeg";
        const ext = getImageExtFromContentType(contentType);

        categoryImagePath = await uploadPublicFile({
          folder: "service-categories",
          ext,
          contentType,
          buffer,
          prefix: "service-category",
        });
      } catch (e) {
        console.error("Error uploading service category image:", e);
      }
    }

    if (mobileIconFile && (mobileIconFile.size ?? 0) > 0 && mobileIconFile.type === "image/png") {
      try {
        const bytes = await mobileIconFile.arrayBuffer();
        const buffer = Buffer.from(bytes);

        mobileIconPath = await uploadPublicFile({
          folder: "service-categories",
          ext: ".png",
          contentType: "image/png",
          buffer,
          prefix: "mobile",
        });
      } catch (e) {
        console.error("Error uploading service category mobile icon:", e);
      }
    }

    const newCategory = await prisma.serviceCategory.create({
      data: {
        name,
        slug,
        description,
        image: categoryImagePath,
        mobileIcon: mobileIconPath || null,
        commissionRate,
        isActive,
      },
    });

    return NextResponse.json(
      { message: "Service category created successfully", category: newCategory },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating service category:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A service category with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to create service category" },
      { status: 500 }
    );
  }
}
