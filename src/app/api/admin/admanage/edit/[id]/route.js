import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { writeFile, mkdir, unlink } from "fs/promises"
import path from "path"

export async function PUT(request, { params }) {
  try {
    // IMPORTANT: Await the params to get the id
    const { id } = await params
    console.log("Updating ad with ID:", id)

    if (!id) {
      console.log("No ID provided in params")
      return NextResponse.json({ error: "Ad ID is required" }, { status: 400 })
    }

    // Check authentication
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse form data
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
      imageFileName: imageFile?.name 
    })

    // Validate title
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    // Check if ad exists
    const existingAd = await prisma.adManagement.findUnique({
      where: { id },
    })

    console.log("Existing ad found:", existingAd ? "Yes" : "No")

    if (!existingAd) {
      return NextResponse.json({ error: "Ad not found" }, { status: 404 })
    }

    let imagePath = existingAd.image

    // Handle image upload if new file is provided
    if (imageFile && imageFile.size > 0) {
      try {
        // Delete old image if exists
        if (existingAd.image) {
          try {
            const oldImagePath = path.join(process.cwd(), "public", existingAd.image)
            await unlink(oldImagePath)
            console.log("Old image deleted")
          } catch (deleteError) {
            console.log("Old image delete error (ignored):", deleteError)
          }
        }

        // Save new image
        const bytes = await imageFile.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const fileExtension = path.extname(imageFile.name)
        const timestamp = Date.now()
        const randomNum = Math.floor(Math.random() * 10000)
        const fileName = `ad-${timestamp}-${randomNum}${fileExtension}`
        
        const uploadDir = path.join(process.cwd(), "public/uploads/advertisements")
        await mkdir(uploadDir, { recursive: true })
        
        const filePath = path.join(uploadDir, fileName)
        await writeFile(filePath, buffer)
        
        imagePath = `/uploads/advertisements/${fileName}`
        console.log("New image saved:", imagePath)
      } catch (uploadError) {
        console.error("Image upload error:", uploadError)
        return NextResponse.json({ error: "Failed to upload image" }, { status: 500 })
      }
    }

    // Update database
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