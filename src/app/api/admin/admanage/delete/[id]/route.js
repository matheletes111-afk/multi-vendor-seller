import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { unlink } from "fs/promises"
import path from "path"
import { existsSync } from "fs"

function isLocalPublicUpload(imageUrl) {
  return typeof imageUrl === "string" && imageUrl.startsWith("/uploads/")
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    console.log("Deleting ad with ID:", id)

    if (!id) {
      console.log("No ID provided in params")
      return NextResponse.json({ error: "Ad ID is required" }, { status: 400 })
    }

    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const ad = await prisma.adManagement.findUnique({
      where: { id },
    })

    console.log("Found ad to delete:", ad ? "Yes" : "No")

    if (!ad) {
      return NextResponse.json({ error: "Ad not found" }, { status: 404 })
    }

    if (ad.image && isLocalPublicUpload(ad.image)) {
      try {
        const imagePath = path.join(process.cwd(), "public", ad.image)
        if (existsSync(imagePath)) {
          await unlink(imagePath)
          console.log("Local image deleted successfully")
        }
      } catch (deleteError) {
        console.error("Error deleting image file:", deleteError)
      }
    }

    await prisma.adManagement.delete({
      where: { id },
    })

    console.log("Ad deleted successfully from database")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting ad:", error)
    return NextResponse.json({ error: error.message || "Failed to delete ad" }, { status: 500 })
  }
}
