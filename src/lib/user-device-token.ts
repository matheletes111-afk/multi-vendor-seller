import { prisma } from "@/lib/prisma"

export interface UserDeviceEntry {
  token: string
  deviceId?: string | null
  platform: string
  deviceModel?: string | null
  userAgent?: string | null
  lastActiveAt: string
  createdAt: string
}

export interface RegisterUserDeviceTokenInput {
  token: string
  platform?: string
  deviceId?: string
  deviceModel?: string
  userAgent?: string
}

export interface RemoveUserDeviceTokenInput {
  token?: string
  deviceId?: string
}

/**
 * Registers or updates a push device token (FCM/APNS/Web) for any user (Customer, Seller, etc.).
 * Stores up to 10 latest active devices in PostgreSQL User.deviceTokens JSON array.
 */
export async function registerUserDeviceToken(
  userId: string,
  input: RegisterUserDeviceTokenInput
): Promise<{ success: boolean; registeredTokensCount: number; devices: UserDeviceEntry[]; error?: string }> {
  const cleanToken = input.token ? input.token.trim() : ""
  if (!cleanToken) {
    return { success: false, registeredTokensCount: 0, devices: [], error: "Device token is required" }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deviceTokens: true },
  })

  if (!user) {
    return { success: false, registeredTokensCount: 0, devices: [], error: "User not found" }
  }

  let existingTokens: UserDeviceEntry[] = []
  if (Array.isArray(user.deviceTokens)) {
    existingTokens = user.deviceTokens as any
  }

  const cleanPlatform = input.platform || "android"
  const cleanDeviceId = input.deviceId ? input.deviceId.trim() : null
  const now = new Date().toISOString()

  const existingEntry = existingTokens.find(
    (item) => item.token === cleanToken || (cleanDeviceId && item.deviceId === cleanDeviceId)
  )

  const newEntry: UserDeviceEntry = {
    token: cleanToken,
    deviceId: cleanDeviceId,
    platform: cleanPlatform,
    deviceModel: input.deviceModel?.slice(0, 100) || null,
    userAgent: input.userAgent?.slice(0, 200) || null,
    lastActiveAt: now,
    createdAt: existingEntry?.createdAt || now,
  }

  // Filter out duplicate token or same deviceId
  const otherTokens = existingTokens.filter(
    (item) => item.token !== cleanToken && (!cleanDeviceId || item.deviceId !== cleanDeviceId)
  )

  const updatedTokens: UserDeviceEntry[] = [newEntry, ...otherTokens].slice(0, 10)

  await prisma.user.update({
    where: { id: user.id },
    data: { deviceTokens: updatedTokens },
  })

  return {
    success: true,
    registeredTokensCount: updatedTokens.length,
    devices: updatedTokens,
  }
}

/**
 * Unregisters a push device token for a user upon logout.
 */
export async function removeUserDeviceToken(
  userId: string,
  input: RemoveUserDeviceTokenInput
): Promise<{ success: boolean; remainingDevicesCount: number; error?: string }> {
  const cleanToken = input.token ? input.token.trim() : ""
  const cleanDeviceId = input.deviceId ? input.deviceId.trim() : ""

  if (!cleanToken && !cleanDeviceId) {
    return { success: false, remainingDevicesCount: 0, error: "Token or deviceId is required" }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deviceTokens: true },
  })

  if (!user || !Array.isArray(user.deviceTokens)) {
    return { success: true, remainingDevicesCount: 0 }
  }

  const remainingTokens = (user.deviceTokens as any[]).filter(
    (item) =>
      (cleanToken ? item.token !== cleanToken : true) &&
      (cleanDeviceId ? item.deviceId !== cleanDeviceId : true)
  )

  await prisma.user.update({
    where: { id: user.id },
    data: { deviceTokens: remainingTokens },
  })

  return {
    success: true,
    remainingDevicesCount: remainingTokens.length,
  }
}

/**
 * Helper to extract real FCM/APNS tokens from a User.deviceTokens field.
 */
export function extractValidTokens(deviceTokensField: any): string[] {
  if (!deviceTokensField) return []
  if (Array.isArray(deviceTokensField)) {
    return deviceTokensField
      .map((item) => (typeof item === "string" ? item : item?.token))
      .filter((t): t is string => typeof t === "string" && t.trim().length > 20 && !t.startsWith("dev_"))
  }
  if (typeof deviceTokensField === "string") {
    return deviceTokensField.trim().length > 20 && !deviceTokensField.startsWith("dev_")
      ? [deviceTokensField.trim()]
      : []
  }
  return []
}
