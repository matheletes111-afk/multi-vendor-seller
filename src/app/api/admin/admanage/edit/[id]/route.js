import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { unlink } from "fs/promises"
import path from "path"
import { existsSync } from "fs"
import { uploadPublicFile } from "@/lib/upload-public-file"

function getImageExtFromContentType(contentType) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("png")) return ".png"
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("gif")) return ".gif"
  return ".jpg"
}

function isLocalPublicUpload(imageUrl) {
  return typeof imageUrl === "string" && imageUrl.startsWith("/uploads/")
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params
    console.log("Updating ad with ID:", id)

    if (!id) {
      console.log("No ID provided in params")
      return NextResponse.json({ error: "Ad ID is required" }, { status: 400 })
    }

    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const title = formData.get("title")
    const description = formData.get("description")
    const isActive = formData.get("isActive") === "true"
    const imageFile = formData.get("image")

    console.log("Received data:", {
      id,
      title,
      description,
      isActive,
      hasImage: !!imageFile,
      imageFileName: imageFile?.name,
    })

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const existingAd = await prisma.adManagement.findUnique({
      where: { id },
    })

    console.log("Existing ad found:", existingAd ? "Yes" : "No")

    if (!existingAd) {
      return NextResponse.json({ error: "Ad not found" }, { status: 404 })
    }

    let imagePath = existingAd.image

    if (imageFile && imageFile.size > 0) {
      try {
        const type = (imageFile.type || "").toLowerCase()
        if (!type.startsWith("image/")) {
          return NextResponse.json({ error: "Image must be an image file" }, { status: 400 })
        }
        if (existingAd.image && isLocalPublicUpload(existingAd.image)) {
          try {
            const oldImagePath = path.join(process.cwd(), "public", existingAd.image)
            if (existsSync(oldImagePath)) {
              await unlink(oldImagePath)
              console.log("Old local image deleted")
            }
          } catch (deleteError) {
            console.log("Old image delete error (ignored):", deleteError)
          }
        }

        const bytes = await imageFile.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const contentType = imageFile.type || "image/jpeg"
        const ext = path.extname(imageFile.name || "") || getImageExtFromContentType(contentType)
        imagePath = await uploadPublicFile({
          folder: "advertisements",
          ext,
          contentType,
          buffer,
          prefix: "admin-ad",
        })
        console.log("New image uploaded:", imagePath)
      } catch (uploadError) {
        console.error("Image upload error:", uploadError)
        const message = uploadError instanceof Error ? uploadError.message : "Failed to upload image"
        return NextResponse.json({ error: message }, { status: 500 })
      }
    }

    const updatedAd = await prisma.adManagement.update({
      where: { id },
      data: {
        title,
        description,
        image: imagePath,
        isActive,
      },
    })

    console.log("Ad updated successfully:", updatedAd)
    return NextResponse.json({ success: true, data: updatedAd })
  } catch (error) {
    console.error("Update error:", error)
    return NextResponse.json({ error: error.message || "Failed to update ad" }, { status: 500 })
  }
}
