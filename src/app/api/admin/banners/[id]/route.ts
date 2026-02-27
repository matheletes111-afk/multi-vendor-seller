import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

// GET single banner
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

    const banner = await prisma.banner.findUnique({
      where: { id },
      include: {
        category: true,
        subcategory: true,
      },
    });

    if (!banner) {
      return NextResponse.json(
        { error: "Banner not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(banner);
  } catch (error: any) {
    console.error("Error fetching banner:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch banner" },
      { status: 500 }
    );
  }
}

// PATCH update banner status
export async function PATCH(
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
    const { isActive } = body;

    const banner = await prisma.banner.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json({
      message: "Banner status updated successfully",
      banner,
    });
  } catch (error: any) {
    console.error("Error updating banner status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update banner status" },
      { status: 500 }
    );
  }
}

// PUT update banner
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
    
    const bannerHeading = formData.get("bannerHeading") as string;
    const bannerDescription = formData.get("bannerDescription") as string || null;
    const isActive = formData.get("isActive") === "true";
    const categoryId = formData.get("categoryId") as string || null;
    const subcategoryId = formData.get("subcategoryId") as string || null;
    const removeImage = formData.get("removeImage") === "true";
    const bannerImageFile = formData.get("bannerImage") as File | null;
    const bannerImageUrl = (formData.get("bannerImageUrl") as string)?.trim() || null;

    // Check if banner exists
    const existingBanner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!existingBanner) {
      return NextResponse.json(
        { error: "Banner not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      bannerHeading,
      bannerDescription,
      isActive,
      categoryId: categoryId || null,
      subcategoryId: subcategoryId || null,
    };

    // Handle image
    if (bannerImageFile && bannerImageFile.size > 0) {
      // Delete old image
      if (existingBanner.bannerImage && existingBanner.bannerImage.startsWith('/uploads/')) {
        const oldImagePath = path.join(process.cwd(), 'public', existingBanner.bannerImage);
        if (existsSync(oldImagePath)) {
          await unlink(oldImagePath).catch(console.error);
        }
      }

      // Save new image
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
        
        updateData.bannerImage = `/uploads/banners/${fileName}`;
      } catch (uploadError) {
        console.error("Error uploading banner image:", uploadError);
        return NextResponse.json({ error: "Failed to upload banner image" }, { status: 500 });
      }
    } else if (removeImage) {
      if (existingBanner.bannerImage && existingBanner.bannerImage.startsWith('/uploads/')) {
        const oldImagePath = path.join(process.cwd(), 'public', existingBanner.bannerImage);
        if (existsSync(oldImagePath)) {
          await unlink(oldImagePath).catch(console.error);
        }
      }
      updateData.bannerImage = null;
    } else if (bannerImageUrl) {
      updateData.bannerImage = bannerImageUrl;
    }

    const banner = await prisma.banner.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        subcategory: true,
      },
    });

    return NextResponse.json({
      message: "Banner updated successfully",
      banner,
    });
  } catch (error: any) {
    console.error("Error updating banner:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update banner" },
      { status: 500 }
    );
  }
}

// DELETE banner
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

    // Get banner to delete image
    const banner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      return NextResponse.json(
        { error: "Banner not found" },
        { status: 404 }
      );
    }

    // Delete image file
    if (banner.bannerImage && banner.bannerImage.startsWith('/uploads/')) {
      const imagePath = path.join(process.cwd(), 'public', banner.bannerImage);
      if (existsSync(imagePath)) {
        await unlink(imagePath).catch(console.error);
      }
    }

    // Delete banner
    await prisma.banner.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Banner deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting banner:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete banner" },
      { status: 500 }
    );
  }
}