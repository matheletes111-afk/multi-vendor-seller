import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

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

    // Handle image upload if file exists
    if (imageFile && imageFile.size > 0) {
      try {
        const bytes = await imageFile.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Generate unique filename using timestamp + random number
        const fileExtension = path.extname(imageFile.name)
        const timestamp = Date.now()
        const randomNum = Math.floor(Math.random() * 10000)
        const fileName = `ad-${timestamp}-${randomNum}${fileExtension}`
        
        // Define upload path
        const uploadDir = path.join(process.cwd(), "public/uploads/advertisements")
        
        // Create directory if it doesn't exist
        await mkdir(uploadDir, { recursive: true })
        
        // Save file
        const filePath = path.join(uploadDir, fileName)
        await writeFile(filePath, buffer)
        console.log("File saved to:", filePath)
        
        // Store the public URL path
        imagePath = `/uploads/advertisements/${fileName}`
      } catch (uploadError) {
        console.error("Error uploading file:", uploadError)
        return NextResponse.json({ error: "Failed to upload image" }, { status: 500 })
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