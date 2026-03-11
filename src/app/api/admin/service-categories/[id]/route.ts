import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { generateSlug } from "@/lib/utils";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const category = await prisma.serviceCategory.findUnique({
      where: { id },
      include: { _count: { select: { services: true } } },
    });
    if (!category) {
      return NextResponse.json({ error: "Service category not found" }, { status: 404 });
    }
    return NextResponse.json(category);
  } catch (error: any) {
    console.error("Error fetching service category:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch service category" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || null;
    const commissionRate = parseFloat(formData.get("commissionRate") as string) || 10.0;
    const isActive = formData.get("isActive") === "true";
    const categoryImageFile = formData.get("categoryImage") as File | null;
    const categoryImageUrl = (formData.get("categoryImageUrl") as string)?.trim() || null;
    const removeCategoryImage = formData.get("removeCategoryImage") === "true";
    const existingCategoryImage = (formData.get("existingCategoryImage") as string) || null;
    const mobileIconFile = formData.get("mobileIcon") as File | null;
    const mobileIconUrl = (formData.get("mobileIconUrl") as string)?.trim() || null;

    const existing = await prisma.serviceCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Service category not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      description,
      commissionRate,
      isActive,
    };

    if (name && name !== existing.name) {
      const slug = generateSlug(name);
      const conflict = await prisma.serviceCategory.findFirst({
        where: { slug, id: { not: id } },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "A service category with this name already exists" },
          { status: 400 }
        );
      }
      updateData.name = name;
      updateData.slug = slug;
    }

    let imagePath: string | null = removeCategoryImage ? null : (categoryImageUrl ?? existingCategoryImage ?? existing.image);
    if (categoryImageFile && (categoryImageFile.size ?? 0) > 0) {
      try {
        if (existing.image?.startsWith("/uploads/")) {
          const oldPath = path.join(process.cwd(), "public", existing.image);
          if (existsSync(oldPath)) await unlink(oldPath);
        }
        const bytes = await categoryImageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const ext = path.extname(categoryImageFile.name);
        const fileName = `service-cat-${Date.now()}-${Math.floor(Math.random() * 10000)}${ext}`;
        const uploadDir = path.join(process.cwd(), "public/uploads/service-categories");
        if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, fileName), buffer);
        imagePath = `/uploads/service-categories/${fileName}`;
      } catch (e) {
        console.error("Error uploading image:", e);
      }
    }
    updateData.image = imagePath;

    let mobileIconPath: string | null = mobileIconUrl || existing.mobileIcon;
    if (mobileIconFile && (mobileIconFile.size ?? 0) > 0 && mobileIconFile.type === "image/png") {
      try {
        if (existing.mobileIcon?.startsWith("/uploads/")) {
          const oldPath = path.join(process.cwd(), "public", existing.mobileIcon);
          if (existsSync(oldPath)) await unlink(oldPath);
        }
        const bytes = await mobileIconFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileName = `mobile-${Date.now()}-${Math.floor(Math.random() * 10000)}.png`;
        const uploadDir = path.join(process.cwd(), "public/uploads/service-categories");
        if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, fileName), buffer);
        mobileIconPath = `/uploads/service-categories/${fileName}`;
      } catch (e) {
        console.error("Error uploading mobile icon:", e);
      }
    }
    updateData.mobileIcon = mobileIconPath;

    const updated = await prisma.serviceCategory.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ message: "Service category updated successfully", category: updated });
  } catch (error: any) {
    console.error("Error updating service category:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A service category with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to update service category" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const category = await prisma.serviceCategory.findUnique({
      where: { id },
      include: { _count: { select: { services: true } } },
    });

    if (!category) {
      return NextResponse.json({ error: "Service category not found" }, { status: 404 });
    }

    if (category._count.services > 0) {
      return NextResponse.json(
        { error: `Cannot delete: category is used by ${category._count.services} service(s). Remove or reassign them first.` },
        { status: 400 }
      );
    }

    if (category.image?.startsWith("/uploads/")) {
      const imagePath = path.join(process.cwd(), "public", category.image);
      if (existsSync(imagePath)) await unlink(imagePath).catch(console.error);
    }
    if (category.mobileIcon?.startsWith("/uploads/")) {
      const iconPath = path.join(process.cwd(), "public", category.mobileIcon);
      if (existsSync(iconPath)) await unlink(iconPath).catch(console.error);
    }

    await prisma.serviceCategory.delete({ where: { id } });
    return NextResponse.json({ message: "Service category deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting service category:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete service category" },
      { status: 500 }
    );
  }
}
