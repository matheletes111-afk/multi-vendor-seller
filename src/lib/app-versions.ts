import { prisma } from "@/lib/prisma"

export type AppType = "customer" | "seller" | "rider"
export type PlatformType = "android" | "ios"

export interface AppVersionConfig {
  app: AppType
  platform: PlatformType
  latestVersion: string
  latestVersionCode: number
  minSupportedVersion: string
  minSupportedVersionCode: number
  forceUpdate: boolean
  title: string
  message: string
  releaseNotes: string[]
  storeUrl: string
  isActive: boolean
}

export function getConfigKey(app: AppType, platform: PlatformType): string {
  return `${app}_${platform}`
}

export const DEFAULT_APP_CONFIGS: Record<string, AppVersionConfig> = {
  customer_android: {
    app: "customer",
    platform: "android",
    latestVersion: "1.0.0",
    latestVersionCode: 1,
    minSupportedVersion: "1.0.0",
    minSupportedVersionCode: 1,
    forceUpdate: false,
    title: "New Update Available! 🚀",
    message: "A fresh version of Meeem Customer App is available with faster browsing, diverse seller discovery, and performance improvements.",
    releaseNotes: [
      "Automatic smooth infinite scroll",
      "Fair marketplace seller products on home",
      "Faster checkout and bug fixes",
    ],
    storeUrl: "https://play.google.com/store/apps/details?id=com.meeem.customer",
    isActive: true,
  },
  customer_ios: {
    app: "customer",
    platform: "ios",
    latestVersion: "1.0.0",
    latestVersionCode: 1,
    minSupportedVersion: "1.0.0",
    minSupportedVersionCode: 1,
    forceUpdate: false,
    title: "New Update Available! 🚀",
    message: "A fresh version of Meeem Customer App is available on the App Store.",
    releaseNotes: [
      "Automatic smooth infinite scroll",
      "Fair marketplace seller discovery",
      "Performance enhancements & bug fixes",
    ],
    storeUrl: "https://apps.apple.com/app/idYOUR_APP_ID",
    isActive: true,
  },
  seller_android: {
    app: "seller",
    platform: "android",
    latestVersion: "1.0.0",
    latestVersionCode: 1,
    minSupportedVersion: "1.0.0",
    minSupportedVersionCode: 1,
    forceUpdate: false,
    title: "Seller App Update Available! 📈",
    message: "Update your Meeem Seller App for improved order management, inventory controls, and faster payouts.",
    releaseNotes: [
      "Improved bulk upload workflow",
      "Instant order alert notifications",
      "Speed improvements & stability",
    ],
    storeUrl: "https://play.google.com/store/apps/details?id=com.meeem.seller",
    isActive: true,
  },
  seller_ios: {
    app: "seller",
    platform: "ios",
    latestVersion: "1.0.0",
    latestVersionCode: 1,
    minSupportedVersion: "1.0.0",
    minSupportedVersionCode: 1,
    forceUpdate: false,
    title: "Seller App Update Available! 📈",
    message: "Update your Meeem Seller App on the App Store for improved store management.",
    releaseNotes: [
      "Order dispatch enhancements",
      "Speed improvements & bug fixes",
    ],
    storeUrl: "https://apps.apple.com/app/idYOUR_SELLER_APP_ID",
    isActive: true,
  },
  rider_android: {
    app: "rider",
    platform: "android",
    latestVersion: "1.0.0",
    latestVersionCode: 1,
    minSupportedVersion: "1.0.0",
    minSupportedVersionCode: 1,
    forceUpdate: false,
    title: "Rider App Update Available! 🛵",
    message: "Update your Meeem Rider App for real-time delivery routing and faster pickup notifications.",
    releaseNotes: [
      "Enhanced live GPS location tracking",
      "Instant delivery OTP verification",
      "Battery & performance optimizations",
    ],
    storeUrl: "https://play.google.com/store/apps/details?id=com.meeem.rider",
    isActive: true,
  },
  rider_ios: {
    app: "rider",
    platform: "ios",
    latestVersion: "1.0.0",
    latestVersionCode: 1,
    minSupportedVersion: "1.0.0",
    minSupportedVersionCode: 1,
    forceUpdate: false,
    title: "Rider App Update Available! 🛵",
    message: "Update your Meeem Rider App for optimized route navigation.",
    releaseNotes: [
      "Real-time order dispatch notifications",
      "Performance enhancements",
    ],
    storeUrl: "https://apps.apple.com/app/idYOUR_RIDER_APP_ID",
    isActive: true,
  },
}

/**
 * Compares two semantic version strings (e.g. "1.2.0" vs "1.0.0").
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareSemanticVersions(v1: string, v2: string): number {
  const clean1 = (v1 || "").replace(/[^0-9.]/g, "").split(".").map((n) => parseInt(n, 10) || 0)
  const clean2 = (v2 || "").replace(/[^0-9.]/g, "").split(".").map((n) => parseInt(n, 10) || 0)
  const maxLen = Math.max(clean1.length, clean2.length)

  for (let i = 0; i < maxLen; i++) {
    const num1 = clean1[i] ?? 0
    const num2 = clean2[i] ?? 0
    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }
  return 0
}

/**
 * Checks if an update is available or required for the client.
 */
export function evaluateAppUpdate(
  config: AppVersionConfig,
  clientVersionStr?: string | null,
  clientVersionCode?: number | null
): { updateAvailable: boolean; forceUpdate: boolean } {
  if (!config.isActive) {
    return { updateAvailable: false, forceUpdate: false }
  }

  let isOutdated = false
  let isBelowMinSupported = false

  // 1. If client provided integer version code, compare codes first
  if (typeof clientVersionCode === "number" && !isNaN(clientVersionCode) && clientVersionCode > 0) {
    if (clientVersionCode < config.latestVersionCode) {
      isOutdated = true
    }
    if (clientVersionCode < config.minSupportedVersionCode) {
      isBelowMinSupported = true
    }
  }

  // 2. If client provided version string (e.g. "1.0.0"), compare semantic versions
  if (clientVersionStr && clientVersionStr.trim()) {
    const cmpLatest = compareSemanticVersions(clientVersionStr, config.latestVersion)
    if (cmpLatest < 0) {
      isOutdated = true
    }
    const cmpMin = compareSemanticVersions(clientVersionStr, config.minSupportedVersion)
    if (cmpMin < 0) {
      isBelowMinSupported = true
    }
  }

  if (!isOutdated) {
    return { updateAvailable: false, forceUpdate: false }
  }

  // If client is below minimum supported version, or admin flagged forceUpdate = true
  const forceUpdate = isBelowMinSupported || config.forceUpdate

  return {
    updateAvailable: true,
    forceUpdate,
  }
}

/**
 * Retrieves all app version configurations from GlobalSetting with fallbacks.
 */
export async function getAllAppVersionConfigs(): Promise<Record<string, AppVersionConfig>> {
  try {
    const setting = await prisma.globalSetting.findFirst({
      select: { appVersions: true },
    })

    const dbConfigs = (setting?.appVersions as Record<string, Partial<AppVersionConfig>>) || {}
    const merged: Record<string, AppVersionConfig> = {}

    for (const [key, defaultCfg] of Object.entries(DEFAULT_APP_CONFIGS)) {
      const custom = dbConfigs[key] || {}
      merged[key] = {
        ...defaultCfg,
        ...custom,
        releaseNotes: Array.isArray(custom.releaseNotes) ? custom.releaseNotes : defaultCfg.releaseNotes,
      }
    }

    return merged
  } catch (err) {
    console.error("Error loading app version configs:", err)
    return DEFAULT_APP_CONFIGS
  }
}

/**
 * Retrieves a single app version configuration.
 */
export async function getAppVersionConfig(
  app: AppType,
  platform: PlatformType
): Promise<AppVersionConfig> {
  const all = await getAllAppVersionConfigs()
  const key = getConfigKey(app, platform)
  return all[key] || DEFAULT_APP_CONFIGS[key] || DEFAULT_APP_CONFIGS.customer_android
}

/**
 * Saves or updates an app version configuration in GlobalSetting.
 */
export async function saveAppVersionConfig(
  updatedConfig: AppVersionConfig
): Promise<AppVersionConfig> {
  const current = await getAllAppVersionConfigs()
  const key = getConfigKey(updatedConfig.app, updatedConfig.platform)

  const updatedAll = {
    ...current,
    [key]: {
      ...DEFAULT_APP_CONFIGS[key],
      ...updatedConfig,
    },
  }

  let setting = await prisma.globalSetting.findFirst({ select: { id: true } })
  if (!setting) {
    setting = await prisma.globalSetting.create({
      data: {
        appVersions: updatedAll as any,
      },
      select: { id: true },
    })
  } else {
    await prisma.globalSetting.update({
      where: { id: setting.id },
      data: {
        appVersions: updatedAll as any,
      },
    })
  }

  return updatedAll[key]
}
