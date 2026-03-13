import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { generateSlug } from "@/lib/utils";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { getPaginationFromSearchParams } from "@/lib/admin-pagination";

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
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || null;
    const commissionRate = parseFloat(formData.get("commissionRate") as string) || 10.0;
    const isActive = formData.get("isActive") === "true";
    const categoryImageFile = formData.get("categoryImage") as File | null;
    const categoryImageUrl = (formData.get("categoryImageUrl") as string)?.trim() || null;
    const mobileIconFile = formData.get("mobileIcon") as File | null;
    const mobileIconUrl = (formData.get("mobileIconUrl") as string)?.trim() || null;

    let categoryImagePath = categoryImageUrl;
    let mobileIconPath = mobileIconUrl;

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
        const ext = path.extname(categoryImageFile.name);
        const fileName = `service-cat-${Date.now()}-${Math.floor(Math.random() * 10000)}${ext}`;
        const uploadDir = path.join(process.cwd(), "public/uploads/service-categories");
        if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, fileName), buffer);
        categoryImagePath = `/uploads/service-categories/${fileName}`;
      } catch (e) {
        console.error("Error uploading service category image:", e);
      }
    }

    if (mobileIconFile && (mobileIconFile.size ?? 0) > 0 && mobileIconFile.type === "image/png") {
      try {
        const bytes = await mobileIconFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileName = `mobile-${Date.now()}-${Math.floor(Math.random() * 10000)}.png`;
        const uploadDir = path.join(process.cwd(), "public/uploads/service-categories");
        if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, fileName), buffer);
        mobileIconPath = `/uploads/service-categories/${fileName}`;
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
