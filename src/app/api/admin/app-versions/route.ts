import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import {
  AppType,
  PlatformType,
  AppVersionConfig,
  getAllAppVersionConfigs,
  saveAppVersionConfig,
} from "@/lib/app-versions"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/admin/app-versions
 * Returns all app version configurations for Customer, Seller, and Rider apps (Android & iOS).
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 })
    }

    const configs = await getAllAppVersionConfigs()
    return NextResponse.json({
      success: true,
      data: configs,
    })
  } catch (error) {
    console.error("Admin app versions GET error:", error)
    return NextResponse.json(
      { error: "Internal server error loading app version configurations" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/app-versions
 * Updates an app version configuration.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 })
    }

    const body = await request.json()
    const app: AppType = body.app
    const platform: PlatformType = body.platform

    if (!app || !["customer", "seller", "rider"].includes(app)) {
      return NextResponse.json({ error: "Invalid app type. Must be customer, seller, or rider." }, { status: 400 })
    }
    if (!platform || !["android", "ios"].includes(platform)) {
      return NextResponse.json({ error: "Invalid platform. Must be android or ios." }, { status: 400 })
    }

    const latestVersion = String(body.latestVersion || "1.0.0").trim()
    const latestVersionCode = Math.max(1, parseInt(String(body.latestVersionCode || 1), 10))
    const minSupportedVersion = String(body.minSupportedVersion || latestVersion).trim()
    const minSupportedVersionCode = Math.max(1, parseInt(String(body.minSupportedVersionCode || latestVersionCode), 10))
    const forceUpdate = Boolean(body.forceUpdate)
    const title = String(body.title || "New Update Available!").trim()
    const message = String(body.message || "A new version of the app is available.").trim()
    const storeUrl = String(body.storeUrl || "").trim()
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true

    let releaseNotes: string[] = []
    if (Array.isArray(body.releaseNotes)) {
      releaseNotes = body.releaseNotes.map((r: any) => String(r).trim()).filter(Boolean)
    } else if (typeof body.releaseNotes === "string") {
      releaseNotes = body.releaseNotes
        .split("\n")
        .map((s: string) => s.trim().replace(/^[-•*]\s*/, ""))
        .filter(Boolean)
    }

    const updatedConfig: AppVersionConfig = {
      app,
      platform,
      latestVersion,
      latestVersionCode,
      minSupportedVersion,
      minSupportedVersionCode,
      forceUpdate,
      title,
      message,
      releaseNotes,
      storeUrl,
      isActive,
    }

    const saved = await saveAppVersionConfig(updatedConfig)

    return NextResponse.json({
      success: true,
      message: `App version settings for ${app} (${platform}) updated successfully.`,
      data: saved,
    })
  } catch (error) {
    console.error("Admin app versions PUT error:", error)
    return NextResponse.json(
      { error: "Internal server error saving app version configuration" },
      { status: 500 }
    )
  }
}
