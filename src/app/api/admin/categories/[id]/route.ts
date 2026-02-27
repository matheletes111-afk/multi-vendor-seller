import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { generateSlug } from "@/lib/utils";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

// GET single category with subcategories
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

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        subcategories: {
          orderBy: { name: "asc" },
        },
        _count: {
          select: {
            products: true,
            services: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error: any) {
    console.error("Error fetching category:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch category" },
      { status: 500 }
    );
  }
}

// PUT update category
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
    
    // Parse form data
    const formData = await request.formData();
    
    const name = formData.get("name") as string;
    const description = formData.get("description") as string || null;
    const commissionRate = parseFloat(formData.get("commissionRate") as string) || 10.0;
    const isActive = formData.get("isActive") === "true";
    
    const categoryImageFile = formData.get("categoryImage") as File | null;
    const categoryImageUrl = (formData.get("categoryImageUrl") as string)?.trim() || null;
    const removeCategoryImage = formData.get("removeCategoryImage") === "true";
    const existingCategoryImage = formData.get("existingCategoryImage") as string || null;
    
    // Handle subcategories
    const subcategoriesData = JSON.parse(formData.get("subcategories") as string || "[]");
    const subcategoryImages = new Map();
    const deletedSubcategoryImages = JSON.parse(formData.get("deletedSubcategoryImages") as string || "[]");

    // Process all image files from formData
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("subcategoryImage_") && value instanceof File) {
        const index = key.replace("subcategoryImage_", "");
        subcategoryImages.set(index, value);
      }
    }

    console.log("Update data:", { name, description, commissionRate, isActive, subcategories: subcategoriesData });

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id },
      include: {
        subcategories: true,
      },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    
    if (name && name !== existingCategory.name) {
      updateData.name = name;
      updateData.slug = generateSlug(name);
      
      // Check if new slug conflicts with another category
      const slugConflict = await prisma.category.findFirst({
        where: {
          slug: updateData.slug,
          id: { not: id },
        },
      });

      if (slugConflict) {
        return NextResponse.json(
          { error: "A category with this name already exists" },
          { status: 400 }
        );
      }
    }
    
    if (description !== undefined) updateData.description = description;
    if (commissionRate !== undefined) updateData.commissionRate = commissionRate;
    if (isActive !== undefined) updateData.isActive = isActive;

    let categoryImagePath: string | null = removeCategoryImage ? null : (categoryImageUrl ?? existingCategoryImage ?? null);

    if (categoryImageFile && categoryImageFile.size > 0) {
      try {
        // Delete old image if exists
        if (existingCategory.image && existingCategory.image.startsWith('/uploads/')) {
          const oldImagePath = path.join(process.cwd(), 'public', existingCategory.image);
          if (existsSync(oldImagePath)) {
            await unlink(oldImagePath);
            console.log("Deleted old category image:", oldImagePath);
          }
        }

        // Save new image
        const bytes = await categoryImageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const fileExtension = path.extname(categoryImageFile.name);
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 10000);
        const fileName = `category-${timestamp}-${randomNum}${fileExtension}`;
        
        const uploadDir = path.join(process.cwd(), "public/uploads/categories");
        
        if (!existsSync(uploadDir)) {
          await mkdir(uploadDir, { recursive: true });
        }
        
        const filePath = path.join(uploadDir, fileName);
        await writeFile(filePath, buffer);
        console.log("New category image saved to:", filePath);
        
        categoryImagePath = `/uploads/categories/${fileName}`;
        updateData.image = categoryImagePath;
      } catch (uploadError) {
        console.error("Error uploading category image:", uploadError);
      }
    } else if (categoryImagePath === null) {
      if (existingCategory.image && existingCategory.image.startsWith('/uploads/')) {
        const oldImagePath = path.join(process.cwd(), 'public', existingCategory.image);
        if (existsSync(oldImagePath)) {
          await unlink(oldImagePath);
        }
      }
      updateData.image = null;
    } else {
      updateData.image = categoryImagePath;
    }

    // Update category if there are changes
    let updatedCategory = existingCategory;
    if (Object.keys(updateData).length > 0) {
      updatedCategory = await prisma.category.update({
        where: { id },
        data: updateData,
        include: {
          subcategories: true,
        },
      });
      console.log("Updated category:", updatedCategory);
    }

    // Delete images for removed subcategories
    for (const imagePath of deletedSubcategoryImages) {
      if (imagePath && imagePath.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), 'public', imagePath);
        if (existsSync(filePath)) {
          await unlink(filePath).catch(console.error);
          console.log("Deleted subcategory image:", filePath);
        }
      }
    }

    // Handle subcategories if provided
    if (subcategoriesData && Array.isArray(subcategoriesData)) {
      // Get existing subcategory IDs
      const existingSubIds = existingCategory.subcategories.map(s => s.id);
      const newSubIds = subcategoriesData.filter(s => s.id).map(s => s.id);
      
      // Delete subcategories that are not in the new list
      const toDelete = existingSubIds.filter(id => !newSubIds.includes(id));
      if (toDelete.length > 0) {
        await prisma.subcategory.deleteMany({
          where: { id: { in: toDelete } },
        });
        console.log(`Deleted ${toDelete.length} subcategories`);
      }

      // Create or update subcategories
      for (let i = 0; i < subcategoriesData.length; i++) {
        const sub = subcategoriesData[i];
        const categoryName = updatedCategory.name;
        const subSlug = generateSlug(`${categoryName}-${sub.name}`);
        
        let subImagePath = (formData.get(`subcategoryImageUrl_${i}`) as string)?.trim() || sub.existingImage || null;
        const imageFile = subcategoryImages.get(i.toString());

        if (imageFile && imageFile.size > 0) {
          try {
            // Delete old image if exists and different
            if (sub.existingImage && sub.existingImage.startsWith('/uploads/')) {
              const oldImagePath = path.join(process.cwd(), 'public', sub.existingImage);
              if (existsSync(oldImagePath)) {
                await unlink(oldImagePath);
                console.log("Deleted old subcategory image:", oldImagePath);
              }
            }

            // Save new image
            const bytes = await imageFile.arrayBuffer();
            const buffer = Buffer.from(bytes);

            const fileExtension = path.extname(imageFile.name);
            const timestamp = Date.now();
            const randomNum = Math.floor(Math.random() * 10000);
            const fileName = `subcategory-${timestamp}-${randomNum}${fileExtension}`;
            
            const uploadDir = path.join(process.cwd(), "public/uploads/subcategories");
            
            if (!existsSync(uploadDir)) {
              await mkdir(uploadDir, { recursive: true });
            }
            
            const filePath = path.join(uploadDir, fileName);
            await writeFile(filePath, buffer);
            console.log("New subcategory image saved to:", filePath);
            
            subImagePath = `/uploads/subcategories/${fileName}`;
          } catch (uploadError) {
            console.error("Error uploading subcategory image:", uploadError);
          }
        } else if (sub.removeImage) {
          // Image was removed
          if (sub.existingImage && sub.existingImage.startsWith('/uploads/')) {
            const oldImagePath = path.join(process.cwd(), 'public', sub.existingImage);
            if (existsSync(oldImagePath)) {
              await unlink(oldImagePath);
              console.log("Deleted removed subcategory image:", oldImagePath);
            }
          }
          subImagePath = null;
        }
        
        if (sub.id) {
          // Update existing subcategory
          await prisma.subcategory.update({
            where: { id: sub.id },
            data: {
              name: sub.name,
              slug: subSlug,
              description: sub.description || null,
              image: subImagePath,
              isActive: sub.isActive !== undefined ? sub.isActive : true,
            },
          });
          console.log(`Updated subcategory: ${sub.name}`);
        } else {
          // Create new subcategory
          await prisma.subcategory.create({
            data: {
              name: sub.name,
              slug: subSlug,
              description: sub.description || null,
              image: subImagePath,
              isActive: sub.isActive !== undefined ? sub.isActive : true,
              categoryId: id,
            },
          });
          console.log(`Created new subcategory: ${sub.name}`);
        }
      }
    }

    // Fetch the updated category with subcategories
    const finalCategory = await prisma.category.findUnique({
      where: { id },
      include: {
        subcategories: {
          orderBy: { name: "asc" },
        },
      },
    });

    return NextResponse.json({
      message: "Category updated successfully",
      category: finalCategory,
    });
  } catch (error: any) {
    console.error("Error updating category:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A subcategory with this name already exists in this category" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to update category" },
      { status: 500 }
    );
  }
}

// DELETE category
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

    // Check if category exists and has dependencies
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        subcategories: true,
        _count: {
          select: {
            products: true,
            services: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    if (category._count.products > 0 || category._count.services > 0) {
      const parts = [];
      if (category._count.products > 0) parts.push(`${category._count.products} product(s)`);
      if (category._count.services > 0) parts.push(`${category._count.services} service(s)`);
      return NextResponse.json(
        { error: `Cannot delete category. In use by ${parts.join(" and ")}.` },
        { status: 400 }
      );
    }

    // Delete category image if exists
    if (category.image && category.image.startsWith('/uploads/')) {
      const imagePath = path.join(process.cwd(), 'public', category.image);
      if (existsSync(imagePath)) {
        await unlink(imagePath).catch(console.error);
        console.log("Deleted category image:", imagePath);
      }
    }

    // Delete subcategory images
    for (const sub of category.subcategories) {
      if (sub.image && sub.image.startsWith('/uploads/')) {
        const imagePath = path.join(process.cwd(), 'public', sub.image);
        if (existsSync(imagePath)) {
          await unlink(imagePath).catch(console.error);
          console.log("Deleted subcategory image:", imagePath);
        }
      }
    }

    // Delete subcategories first
    await prisma.subcategory.deleteMany({
      where: { categoryId: id },
    });
    console.log("Deleted subcategories");

    // Then delete category
    await prisma.category.delete({
      where: { id },
    });
    console.log("Deleted category");

    return NextResponse.json({
      message: "Category deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete category" },
      { status: 500 }
    );
  }
}