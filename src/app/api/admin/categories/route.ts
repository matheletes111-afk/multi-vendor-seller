import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { generateSlug } from "@/lib/utils";
import path from "path";
import { uploadPublicFile } from "@/lib/upload-public-file";
import { getPaginationFromSearchParams } from "@/lib/admin-pagination";
import { sanitizeInput } from "@/lib/html-sanitization";

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
              subcategories: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
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

    const subcategories = await prisma.subcategory.findMany({
      where: { categoryId: { in: categoryIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        mobileIcon: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        categoryId: true,
      },
    });

    const subByCategoryId = subcategories.reduce(
      (acc: Record<string, typeof subcategories>, sub) => {
        if (!acc[sub.categoryId]) acc[sub.categoryId] = [];
        acc[sub.categoryId].push(sub);
        return acc;
      },
      {} as Record<string, typeof subcategories>
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
    
    const nameRaw = formData.get("name") as string;
    const name = sanitizeInput(nameRaw);
    const description = typeof formData.get("description") === "string" ? sanitizeInput(formData.get("description") as string) : null;
    const commissionRate = 0.0; // Commission is being disabled project-wide
    const isActive = formData.get("isActive") === "true";
    const isFeatured = formData.get("isFeatured") === "true";
 
    const categoryImageFile = formData.get("categoryImage") as File | null;
    const categoryImageUrl = (formData.get("categoryImageUrl") as string)?.trim() || null;
    let categoryImagePath = categoryImageUrl;
    const categoryMobileIconFile = formData.get("categoryMobileIcon") as File | null;
    const categoryMobileIconUrl = (formData.get("categoryMobileIconUrl") as string)?.trim() || null;
    let categoryMobileIconPath = categoryMobileIconUrl;
 
    // Handle subcategories
    const subcategoriesRaw = formData.get("subcategories") as string || "[]";
    const subcategoriesData = JSON.parse(subcategoriesRaw);
    // Sanitize subcategory details
    for (const sub of subcategoriesData) {
      if (typeof sub.name === "string") sub.name = sanitizeInput(sub.name);
      if (typeof sub.description === "string") sub.description = sanitizeInput(sub.description);
    }
    const subcategoryImages = new Map();
    const subcategoryMobileIcons = new Map();

    // Process all subcategory image files from formData.
    // Note: on the server, these can be `File` or `Blob`-like objects depending on runtime.
    // We detect file-like values via `arrayBuffer()` instead of `instanceof File`.
    for (const [key, value] of formData.entries()) {
      if (
        key.startsWith("subcategoryImage_") &&
        value &&
        typeof (value as any).arrayBuffer === "function"
      ) {
        const index = key.replace("subcategoryImage_", "");
        subcategoryImages.set(index, value);
      }
      if (
        key.startsWith("subcategoryMobileIcon_") &&
        value &&
        typeof (value as any).arrayBuffer === "function"
      ) {
        const index = key.replace("subcategoryMobileIcon_", "");
        subcategoryMobileIcons.set(index, value);
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

    if (isFeatured) {
      const featuredCount = await prisma.category.count({ where: { isFeatured: true } });
      if (featuredCount >= 4) {
        return NextResponse.json(
          { error: "Maximum 4 categories can be featured for mobile" },
          { status: 400 }
        );
      }
    }

    if (categoryImageFile && categoryImageFile.size > 0) {
      try {
        const bytes = await categoryImageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileExtension = path.extname(categoryImageFile.name) || ".jpg";
        categoryImagePath = await uploadPublicFile({
          folder: "categories",
          ext: fileExtension,
          contentType: categoryImageFile.type || "image/jpeg",
          buffer,
          prefix: "category",
        });
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "Failed to upload category image";
        console.error("Error uploading category image:", uploadError);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    if (categoryMobileIconFile && categoryMobileIconFile.size > 0 && categoryMobileIconFile.type === "image/png") {
      try {
        const bytes = await categoryMobileIconFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        categoryMobileIconPath = await uploadPublicFile({
          folder: "categories",
          ext: ".png",
          contentType: "image/png",
          buffer,
          prefix: "mobile",
        });
      } catch (uploadError) {
        console.error("Error uploading category mobile icon:", uploadError);
      }
    }

    // Create category
    const newCategory = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        image: categoryImagePath,
        mobileIcon: categoryMobileIconPath || null,
        commissionRate,
        isActive,
        isFeatured,
      },
    });

    console.log("Created category:", newCategory);

    // Create subcategories if any
    if (subcategoriesData && subcategoriesData.length > 0) {
      for (let i = 0; i < subcategoriesData.length; i++) {
        const sub = subcategoriesData[i];
        const subSlug = generateSlug(`${name}-${sub.name}`);
        
        let subImagePath = (formData.get(`subcategoryImageUrl_${i}`) as string)?.trim() || null;
        let subMobileIconPath = (formData.get(`subcategoryMobileIconUrl_${i}`) as string)?.trim() || null;
        const imageFile = subcategoryImages.get(i.toString());
        const mobileIconFile = subcategoryMobileIcons.get(i.toString());

        if (imageFile && imageFile.size > 0) {
          try {
            const bytes = await imageFile.arrayBuffer();
            const buffer = Buffer.from(bytes);

            const fileExtension = path.extname((imageFile as any).name || "") || ".jpg";
            subImagePath = await uploadPublicFile({
              folder: "subcategories",
              ext: fileExtension,
              contentType: imageFile.type || "image/jpeg",
              buffer,
              prefix: "subcategory",
            });
          } catch (uploadError) {
            console.error("Error uploading subcategory image:", uploadError);
          }
        }

        if (mobileIconFile && mobileIconFile.size > 0 && mobileIconFile.type === "image/png") {
          try {
            const bytes = await mobileIconFile.arrayBuffer();
            const buffer = Buffer.from(bytes);
            subMobileIconPath = await uploadPublicFile({
              folder: "subcategories",
              ext: ".png",
              contentType: "image/png",
              buffer,
              prefix: "mobile",
            });
          } catch (uploadError) {
            console.error("Error uploading subcategory mobile icon:", uploadError);
          }
        }
        
        await prisma.subcategory.create({
          data: {
            name: sub.name,
            slug: subSlug,
            description: sub.description || null,
            image: subImagePath,
            mobileIcon: subMobileIconPath || null,
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