import { NextRequest, NextResponse } from "next/server"
import {
  AppType,
  PlatformType,
  getAppVersionConfig,
  evaluateAppUpdate,
} from "@/lib/app-versions"

export const dynamic = "force-dynamic"
export const revalidate = 0

async function handleVersionCheck(
  appParamRaw: string | null,
  platformParamRaw: string | null,
  versionRaw: string | null,
  versionCodeRaw: string | number | null
) {
  const app: AppType =
    appParamRaw === "seller" || appParamRaw === "rider" ? appParamRaw : "customer"

  const platform: PlatformType =
    platformParamRaw === "ios" || platformParamRaw === "apple" ? "ios" : "android"

  const clientVersionStr = versionRaw ? String(versionRaw).trim() : null
  const clientVersionCode = versionCodeRaw ? parseInt(String(versionCodeRaw), 10) : null

  const config = await getAppVersionConfig(app, platform)
  const evaluation = evaluateAppUpdate(config, clientVersionStr, clientVersionCode)

  return NextResponse.json(
    {
      success: true,
      message: evaluation.updateAvailable
        ? evaluation.forceUpdate
          ? "Critical update required"
          : "Update available"
        : "App is up to date",
      data: {
        app: config.app,
        platform: config.platform,
        current_version: clientVersionStr || "unknown",
        current_version_code: clientVersionCode,
        latest_version: config.latestVersion,
        latest_version_code: config.latestVersionCode,
        min_supported_version: config.minSupportedVersion,
        min_supported_version_code: config.minSupportedVersionCode,
        update_available: evaluation.updateAvailable,
        force_update: evaluation.forceUpdate,
        title: config.title,
        message: config.message,
        release_notes: config.releaseNotes,
        store_url: config.storeUrl,
        is_active: config.isActive,
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  )
}

/**
 * GET /mobileapi/v1/app/version-check
 * Query parameters:
 *   - app: "customer" | "seller" | "rider"
 *   - platform: "android" | "ios"
 *   - version or current_version: string (e.g. "1.0.0")
 *   - version_code or current_version_code: integer (e.g. 10)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const app = searchParams.get("app") || searchParams.get("app_type")
    const platform = searchParams.get("platform") || searchParams.get("os")
    const version =
      searchParams.get("version") ||
      searchParams.get("current_version") ||
      searchParams.get("app_version")
    const versionCode =
      searchParams.get("version_code") ||
      searchParams.get("current_version_code") ||
      searchParams.get("build_number")

    return await handleVersionCheck(app, platform, version, versionCode)
  } catch (error) {
    console.error("App version check GET error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error during version check" },
      { status: 500 }
    )
  }
}

/**
 * POST /mobileapi/v1/app/version-check
 * JSON body parameters:
 *   - app: "customer" | "seller" | "rider"
 *   - platform: "android" | "ios"
 *   - version or current_version: string
 *   - version_code or current_version_code: integer
 */
export async function POST(request: NextRequest) {
  try {
    let body: Record<string, any> = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const app = body.app || body.app_type
    const platform = body.platform || body.os
    const version = body.version || body.current_version || body.app_version
    const versionCode = body.version_code || body.current_version_code || body.build_number

    return await handleVersionCheck(app, platform, version, versionCode)
  } catch (error) {
    console.error("App version check POST error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error during version check" },
      { status: 500 }
    )
  }
}
