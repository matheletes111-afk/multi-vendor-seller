import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { generateSlug } from "@/lib/utils";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { getPaginationFromSearchParams } from "@/lib/admin-pagination";

// GET categories with pagination and subcategory counts
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
      prisma.category.findMany({
        skip,
        take,
        include: {
          _count: {
            select: {
              products: true,
              services: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.category.count(),
    ]);

    const categoryIds = categories.map((c) => c.id);
    if (categoryIds.length === 0) {
      const totalPages = Math.ceil(totalCount / perPage);
      return NextResponse.json({
        categories: categories.map((c) => ({
          ...c,
          _count: { ...c._count, subcategories: 0 },
          subcategories: [],
        })),
        totalCount,
        totalPages,
        page,
        perPage,
      });
    }

    const subcategories = await (prisma as any).subcategory.findMany({
      where: { categoryId: { in: categoryIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        categoryId: true,
      },
    });

    const subByCategoryId = subcategories.reduce(
      (acc: Record<string, any[]>, sub: any) => {
        if (!acc[sub.categoryId]) acc[sub.categoryId] = [];
        acc[sub.categoryId].push({
          ...sub,
          _count: { products: 0, services: 0 },
        });
        return acc;
      },
      {} as Record<string, any[]>
    );

    const categoriesWithCount = categories.map((c) => ({
      ...c,
      _count: {
        ...c._count,
        subcategories: subByCategoryId[c.id]?.length ?? 0,
      },
      subcategories: subByCategoryId[c.id] ?? [],
    }));

    const totalPages = Math.ceil(totalCount / perPage);
    return NextResponse.json({
      categories: categoriesWithCount,
      totalCount,
      totalPages,
      page,
      perPage,
    });
  } catch (error: any) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// POST create new category with subcategories
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse form data instead of JSON for file uploads
    const formData = await request.formData();
    
    const name = formData.get("name") as string;
    const description = formData.get("description") as string || null;
    const commissionRate = parseFloat(formData.get("commissionRate") as string) || 10.0;
    const isActive = formData.get("isActive") === "true";
    
    const categoryImageFile = formData.get("categoryImage") as File | null;
    const categoryImageUrl = (formData.get("categoryImageUrl") as string)?.trim() || null;
    let categoryImagePath = categoryImageUrl;

    // Handle subcategories
    const subcategoriesData = JSON.parse(formData.get("subcategories") as string || "[]");
    const subcategoryImages = new Map();

    // Process all image files from formData
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("subcategoryImage_") && value instanceof File) {
        const index = key.replace("subcategoryImage_", "");
        subcategoryImages.set(index, value);
      }
    }

    console.log("Received data:", { name, description, commissionRate, isActive, subcategories: subcategoriesData });

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    // Generate slug
    const slug = generateSlug(name);

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { slug },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 400 }
      );
    }

    if (categoryImageFile && categoryImageFile.size > 0) {
      try {
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
        categoryImagePath = `/uploads/categories/${fileName}`;
      } catch (uploadError) {
        console.error("Error uploading category image:", uploadError);
        return NextResponse.json({ error: "Failed to upload category image" }, { status: 500 });
      }
    }

    // Create category
    const newCategory = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        image: categoryImagePath,
        commissionRate,
        isActive,
      },
    });

    console.log("Created category:", newCategory);

    // Create subcategories if any
    if (subcategoriesData && subcategoriesData.length > 0) {
      for (let i = 0; i < subcategoriesData.length; i++) {
        const sub = subcategoriesData[i];
        const subSlug = generateSlug(`${name}-${sub.name}`);
        
        let subImagePath = (formData.get(`subcategoryImageUrl_${i}`) as string)?.trim() || null;
        const imageFile = subcategoryImages.get(i.toString());

        if (imageFile && imageFile.size > 0) {
          try {
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
            console.log("Subcategory image saved to:", filePath);
            
            subImagePath = `/uploads/subcategories/${fileName}`;
          } catch (uploadError) {
            console.error("Error uploading subcategory image:", uploadError);
            // Continue without image if upload fails
          }
        }
        
        await prisma.subcategory.create({
          data: {
            name: sub.name,
            slug: subSlug,
            description: sub.description || null,
            image: subImagePath,
            isActive: sub.isActive !== undefined ? sub.isActive : true,
            categoryId: newCategory.id,
          },
        });
      }
      console.log(`Created ${subcategoriesData.length} subcategories`);
    }

    // Fetch the complete category with subcategories to return
    const completeCategory = await prisma.category.findUnique({
      where: { id: newCategory.id },
      include: {
        subcategories: true,
      },
    });

    return NextResponse.json(
      { message: "Category created successfully", category: completeCategory },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating category:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A category or subcategory with this name already exists" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create category" },
      { status: 500 }
    );
  }
}