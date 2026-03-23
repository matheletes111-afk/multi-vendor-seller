import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import path from "path"
import { uploadPublicFile } from "@/lib/upload-public-file"

function getImageExtFromContentType(contentType) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("png")) return ".png"
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("gif")) return ".gif"
  return ".jpg"
}

export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const title = formData.get("title")
    const description = formData.get("description")
    const isActive = formData.get("isActive") === "true"
    const imageFile = formData.get("image")

    console.log("Received data:", { title, description, isActive, hasImage: !!imageFile })

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    let imagePath = null

    if (imageFile && imageFile.size > 0) {
      try {
        const type = (imageFile.type || "").toLowerCase()
        if (!type.startsWith("image/")) {
          return NextResponse.json({ error: "Image must be an image file" }, { status: 400 })
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
        console.log("Image uploaded to:", imagePath)
      } catch (uploadError) {
        console.error("Error uploading file:", uploadError)
        const message = uploadError instanceof Error ? uploadError.message : "Failed to upload image"
        return NextResponse.json({ error: message }, { status: 500 })
      }
    }

    const ad = await prisma.adManagement.create({
      data: {
        title,
        description,
        image: imagePath,
        isActive,
      },
    })

    console.log("Ad created:", ad)
    return NextResponse.json({ success: true, data: ad })
  } catch (error) {
    console.error("Error creating ad:", error)
    return NextResponse.json({ error: "Failed to create ad" }, { status: 500 })
  }
}
