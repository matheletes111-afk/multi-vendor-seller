import { NextRequest, NextResponse } from "next/server"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { s3Client, S3_BUCKET_NAME } from "@/lib/s3-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Allowed public image/asset paths to prevent unauthorized access to private KYC, bank passbooks, etc.
const ALLOWED_PUBLIC_PREFIXES = [
  "uploads/restaurant-onboarding/property",
  "uploads/hotel-onboarding/property",
  "uploads/foods",
  "uploads/products",
  "uploads/banners",
  "uploads/categories",
  "uploads/subcategories",
  "uploads/service-categories",
  "uploads/advertisements",
  "uploads/seller-ads",
  "uploads/profile",
]

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "webp":
      return "image/webp"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "png":
      return "image/png"
    case "gif":
      return "image/gif"
    case "svg":
      return "image/svg+xml"
    case "mp4":
      return "video/mp4"
    case "webm":
      return "video/webm"
    default:
      return "application/octet-stream"
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    const resolvedParams = await params
    let rawPath = Array.isArray(resolvedParams?.path) ? resolvedParams.path.join("/") : ""

    if (!rawPath) {
      const searchParams = request.nextUrl.searchParams
      const queryKey = searchParams.get("key") || searchParams.get("url")
      if (queryKey) {
        const idx = queryKey.indexOf("uploads/")
        rawPath = idx !== -1 ? queryKey.substring(idx) : queryKey
      }
    }

    const cleanKey = rawPath.replace(/^\/+/, "").trim()

    if (!cleanKey || cleanKey.includes("..")) {
      return new NextResponse("Invalid file path", { status: 400 })
    }

    // Security check: only allow public media directories
    const isAllowed = ALLOWED_PUBLIC_PREFIXES.some((prefix) => cleanKey.startsWith(prefix))
    if (!isAllowed) {
      return new NextResponse("Forbidden: Access to this directory is not allowed", { status: 403 })
    }

    if (!S3_BUCKET_NAME) {
      return new NextResponse("S3 Bucket is not configured", { status: 500 })
    }

    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: cleanKey,
    })

    const s3Response = await s3Client.send(command)

    if (!s3Response.Body) {
      return new NextResponse("File body is empty", { status: 404 })
    }

    const byteArray = await s3Response.Body.transformToByteArray()
    const contentType = s3Response.ContentType || getMimeType(cleanKey)

    return new NextResponse(Buffer.from(byteArray), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(byteArray.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      },
    })
  } catch (error: any) {
    if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
      return new NextResponse("File not found in storage", { status: 404 })
    }
    console.error("[MEDIA_PROXY_ERROR]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  })
}

