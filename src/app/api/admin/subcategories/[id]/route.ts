import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { generateSlug } from "@/lib/utils";

// GET single subcategory
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

    const subcategory = await prisma.subcategory.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!subcategory) {
      return NextResponse.json(
        { error: "Subcategory not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(subcategory);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch subcategory" },
      { status: 500 }
    );
  }
}

// PUT update subcategory
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
    const body = await request.json();
    const { name, description, image, isActive, categoryId } = body;

    // Check if subcategory exists
    const existingSubcategory = await prisma.subcategory.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!existingSubcategory) {
      return NextResponse.json(
        { error: "Subcategory not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    
    if (name) {
      updateData.name = name;
      const category = await prisma.category.findUnique({
        where: { id: categoryId || existingSubcategory.categoryId },
      });
      updateData.slug = generateSlug(`${category?.name}-${name}`);
    }
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (categoryId) updateData.categoryId = categoryId;

    // Check for duplicate name in same category
    if (name && categoryId) {
      const duplicate = await prisma.subcategory.findFirst({
        where: {
          name,
          categoryId,
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "A subcategory with this name already exists in this category" },
          { status: 400 }
        );
      }
    }

    const subcategory = await prisma.subcategory.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      message: "Subcategory updated successfully",
      subcategory,
    });
  } catch (error: any) {
    console.error("Error updating subcategory:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update subcategory" },
      { status: 500 }
    );
  }
}

// DELETE subcategory
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

    // Check if subcategory exists and has dependencies
    const subcategory = await prisma.subcategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            services: true,
          },
        },
      },
    });

    if (!subcategory) {
      return NextResponse.json(
        { error: "Subcategory not found" },
        { status: 404 }
      );
    }

    if (subcategory._count.products > 0 || subcategory._count.services > 0) {
      const parts = [];
      if (subcategory._count.products > 0) parts.push(`${subcategory._count.products} product(s)`);
      if (subcategory._count.services > 0) parts.push(`${subcategory._count.services} service(s)`);
      return NextResponse.json(
        { error: `Cannot delete subcategory. In use by ${parts.join(" and ")}.` },
        { status: 400 }
      );
    }

    await prisma.subcategory.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Subcategory deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting subcategory:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete subcategory" },
      { status: 500 }
    );
  }
}