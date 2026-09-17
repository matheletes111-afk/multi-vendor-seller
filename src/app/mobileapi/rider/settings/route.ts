import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "@/app/mobileapi/_helpers/rider-auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { generateMobileTokens } from "@/lib/mobile-jwt"
import { validateAndFormatPaymentDetails } from "@/lib/payment-details-helper"
import { validateOnboardingFile } from "@/lib/onboarding-file-validation"

function getSafeFileExt(file: File, fallbackExt: string): string {
  const ext = path.extname(file.name || "").toLowerCase()
  if (ext && ext.length >= 2 && ext.length <= 6) return ext
  if (file.type) {
    const t = file.type.toLowerCase()
    if (t.includes("png")) return ".png"
    if (t.includes("jpeg") || t.includes("jpg")) return ".jpg"
    if (t.includes("webp")) return ".webp"
    if (t.includes("heic")) return ".heic"
    if (t.includes("heif")) return ".heif"
    if (t.includes("avif")) return ".avif"
    if (t.includes("bmp")) return ".bmp"
    if (t.includes("tiff") || t.includes("tif")) return ".tiff"
    if (t.includes("gif")) return ".gif"
    if (t.includes("pdf")) return ".pdf"
  }
  return fallbackExt
}

function getSafeFileMime(file: File, ext: string, fallbackMime: string): string {
  if (file.type && file.type.includes("/")) return file.type
  const clean = ext.toLowerCase()
  if (clean === ".jpg" || clean === ".jpeg") return "image/jpeg"
  if (clean === ".png") return "image/png"
  if (clean === ".webp") return "image/webp"
  if (clean === ".heic") return "image/heic"
  if (clean === ".heif") return "image/heif"
  if (clean === ".avif") return "image/avif"
  if (clean === ".bmp") return "image/bmp"
  if (clean === ".tiff" || clean === ".tif") return "image/tiff"
  if (clean === ".gif") return "image/gif"
  if (clean === ".pdf") return "application/pdf"
  return fallbackMime
}

// GET /mobileapi/rider/settings — Fetch full settings
export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileRiderAuth(request)
    if (!authResult.ok) {
      const statusCode = authResult.error === "suspended" ? 403 : 401
      const errorMessage =
        authResult.error === "suspended"
          ? "Your rider account has been suspended. Please contact support."
          : "Unauthorized: Invalid or expired mobile session."
      return NextResponse.json({ success: false, error: errorMessage }, { status: statusCode })
    }

    const { user, rider } = authResult
    const vehicleTypeResult = (rider?.vehicleTypes as string[])?.[0] || "2_WHEELER"

    let completedDeliveriesCount = 0
    let totalEarnings = 0
    let activeDeliveriesCount = 0

    if (rider?.id) {
      const completedAssignments = await prisma.riderDeliveryAssignment.findMany({
        where: {
          riderId: rider.id,
          status: "DELIVERED",
        },
        include: {
          order: {
            select: {
              shipping: true,
              items: {
                select: { id: true, sellerId: true, shippingAmount: true },
              },
            },
          },
        },
      })

      completedDeliveriesCount = completedAssignments.length
      totalEarnings = completedAssignments.reduce((sum, a) => {
        const assignedItems = (a.order?.items || []).filter(
          (item) => (a.orderItemId ? item.id === a.orderItemId : !a.sellerId || item.sellerId === a.sellerId)
        )
        const itemsShippingSum = assignedItems.reduce(
          (s: number, i: any) => s + (Number(i.shippingAmount) || 0),
          0
        )
        const fee = itemsShippingSum > 0 ? itemsShippingSum : Number(a.order?.shipping || 0)
        return sum + fee
      }, 0)

      activeDeliveriesCount = await prisma.riderDeliveryAssignment.count({
        where: {
          riderId: rider.id,
          status: { in: ["ACCEPTED", "AT_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"] },
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        user,
        rider: rider ? {
          ...rider,
          vehicleType: vehicleTypeResult,
        } : null,
        stats: {
          completedDeliveriesCount,
          totalEarnings,
          activeDeliveriesCount,
        },
        registeredDevices: Array.isArray(rider?.deviceTokens) ? rider.deviceTokens : [],
      },
    })
  } catch (error) {
    console.error("Mobile rider settings GET error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load rider settings." },
      { status: 500 }
    )
  }
}

// POST /mobileapi/rider/settings — Update settings (documents, zones, vehicle, password)
export async function POST(request: NextRequest) {
  try {
    const authResult = await getMobileRiderAuth(request)
    if (!authResult.ok) {
      const statusCode = authResult.error === "suspended" ? 403 : 401
      const errorMessage =
        authResult.error === "suspended"
          ? "Your rider account has been suspended. Please contact support."
          : "Unauthorized: Invalid or expired mobile session."
      return NextResponse.json({ success: false, error: errorMessage }, { status: statusCode })
    }

    const userId = authResult.userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { rider: true },
    })

    if (!user || !user.rider) {
      return NextResponse.json({ success: false, error: "Rider record not found." }, { status: 404 })
    }

    const contentType = request.headers.get("content-type") || ""
    let name: string | null = null
    let email: string | null = null
    let hasEmailField = false
    let phone: string | null = null
    let phoneCountryCode: string | null = null
    let vehicleTypes: string[] = []
    let vehicleName: string | null = null
    let vehicleNumber: string | null = null
    let drivingLicenseNo: string | null = null
    let selectedZones: string[] = []
    let selectedLocations: string[] = []
    let currentPassword: string | null = null
    let newPassword: string | null = null
    let hasPaymentField = false
    let paymentOption: string | undefined = undefined
    let bankName: string | undefined = undefined
    let accountHolderName: string | undefined = undefined
    let accountNumber: string | undefined = undefined
    let bbanNumber: string | undefined = undefined
    let branchName: string | undefined = undefined
    let bankAddress: string | undefined = undefined
    let mobileNumber: string | undefined = undefined
    let agentNumber: string | undefined = undefined

    let profileImageUrl: string | null = user.image || user.rider?.profileImage || null
    let drivingLicenseDocUrl: string | null = user.rider?.drivingLicenseDoc || null
    let nationalIdDocUrl: string | null = user.rider?.nationalIdDoc || null
    let vehicleInsuranceDocUrl: string | null = user.rider?.vehicleInsuranceDoc || null

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()

      name = formData.get("name") as string | null
      if (formData.has("email")) {
        hasEmailField = true
        email = formData.get("email") as string | null
      }
      phone = formData.get("phone") as string | null
      phoneCountryCode = formData.get("phoneCountryCode") as string | null
      vehicleName = formData.get("vehicleName") as string | null
      vehicleNumber = formData.get("vehicleNumber") as string | null
      drivingLicenseNo = formData.get("drivingLicenseNo") as string | null
      currentPassword = formData.get("currentPassword") as string | null
      newPassword = formData.get("newPassword") as string | null

      if (
        formData.has("paymentOption") ||
        formData.has("bankName") ||
        formData.has("accountHolderName") ||
        formData.has("accountNumber") ||
        formData.has("bbanNumber") ||
        formData.has("branchName") ||
        formData.has("bankAddress") ||
        formData.has("mobileNumber") ||
        formData.has("agentNumber")
      ) {
        hasPaymentField = true
        if (formData.has("paymentOption")) paymentOption = (formData.get("paymentOption") as string) || undefined
        if (formData.has("bankName")) bankName = (formData.get("bankName") as string) || undefined
        if (formData.has("accountHolderName")) accountHolderName = (formData.get("accountHolderName") as string) || undefined
        if (formData.has("accountNumber")) accountNumber = (formData.get("accountNumber") as string) || undefined
        if (formData.has("bbanNumber")) bbanNumber = (formData.get("bbanNumber") as string) || undefined
        if (formData.has("branchName")) branchName = (formData.get("branchName") as string) || undefined
        if (formData.has("bankAddress")) bankAddress = (formData.get("bankAddress") as string) || undefined
        if (formData.has("mobileNumber")) mobileNumber = (formData.get("mobileNumber") as string) || undefined
        if (formData.has("agentNumber")) agentNumber = (formData.get("agentNumber") as string) || undefined
      }

      const singleVehicle = (formData.get("vehicleType") as string | null)?.trim()
      const rawVehicleTypes = formData.get("vehicleTypes")
      if (singleVehicle) {
        vehicleTypes = [singleVehicle]
      } else if (rawVehicleTypes) {
        try {
          const parsed = JSON.parse(rawVehicleTypes as string)
          vehicleTypes = Array.isArray(parsed) ? parsed.slice(0, 1) : [String(parsed)]
        } catch {
          vehicleTypes = (rawVehicleTypes as string).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 1)
        }
      }

      const rawZones = formData.get("selectedZones")
      if (rawZones) {
        try {
          selectedZones = JSON.parse(rawZones as string)
        } catch {
          selectedZones = (rawZones as string).split(",").map((s) => s.trim()).filter(Boolean)
        }
      }

      const rawLocations = formData.get("selectedLocations")
      if (rawLocations) {
        try {
          selectedLocations = JSON.parse(rawLocations as string)
        } catch {
          selectedLocations = (rawLocations as string).split(",").map((s) => s.trim()).filter(Boolean)
        }
      }

      // Support pre-existing URLs passed from mobile app client state
      if (formData.has("profileImageUrl")) {
        const pVal = formData.get("profileImageUrl") as string | null
        if (pVal) profileImageUrl = pVal.trim()
      }
      if (formData.has("drivingLicenseDocUrl")) {
        const dVal = formData.get("drivingLicenseDocUrl") as string | null
        if (dVal) drivingLicenseDocUrl = dVal.trim()
      }
      if (formData.has("nationalIdDocUrl")) {
        const nVal = formData.get("nationalIdDocUrl") as string | null
        if (nVal) nationalIdDocUrl = nVal.trim()
      }
      if (formData.has("vehicleInsuranceDocUrl")) {
        const iVal = formData.get("vehicleInsuranceDocUrl") as string | null
        if (iVal) vehicleInsuranceDocUrl = iVal.trim()
      }

      const profileImageFile = formData.get("profileImage") as File | null
      if (profileImageFile && typeof profileImageFile === "object" && profileImageFile.size > 0) {
        const val = validateOnboardingFile(profileImageFile, { imagesOnly: true, maxSizeMb: 4.5 })
        if (!val.isValid) {
          return NextResponse.json({ success: false, error: `Profile Picture: ${val.error}` }, { status: 400 })
        }
        const buffer = Buffer.from(await profileImageFile.arrayBuffer())
        const ext = getSafeFileExt(profileImageFile, ".jpg")
        profileImageUrl = await uploadPublicFile({
          folder: "profile",
          ext,
          contentType: getSafeFileMime(profileImageFile, ext, "image/jpeg"),
          buffer,
          prefix: `rider-pfp-${userId.slice(0, 8)}`,
        })
      }

      const dlFile = formData.get("drivingLicenseDoc") as File | null
      if (dlFile && typeof dlFile === "object" && dlFile.size > 0) {
        const val = validateOnboardingFile(dlFile, { maxSizeMb: 4.5 })
        if (!val.isValid) {
          return NextResponse.json({ success: false, error: `Driving License: ${val.error}` }, { status: 400 })
        }
        const buffer = Buffer.from(await dlFile.arrayBuffer())
        const ext = getSafeFileExt(dlFile, ".pdf")
        drivingLicenseDocUrl = await uploadPublicFile({
          folder: "onboarding/kyc",
          ext,
          contentType: getSafeFileMime(dlFile, ext, "application/pdf"),
          buffer,
          prefix: `rider-dl-${userId.slice(0, 8)}`,
        })
      }

      const nidFile = formData.get("nationalIdDoc") as File | null
      if (nidFile && typeof nidFile === "object" && nidFile.size > 0) {
        const val = validateOnboardingFile(nidFile, { maxSizeMb: 4.5 })
        if (!val.isValid) {
          return NextResponse.json({ success: false, error: `National ID: ${val.error}` }, { status: 400 })
        }
        const buffer = Buffer.from(await nidFile.arrayBuffer())
        const ext = getSafeFileExt(nidFile, ".pdf")
        nationalIdDocUrl = await uploadPublicFile({
          folder: "onboarding/kyc",
          ext,
          contentType: getSafeFileMime(nidFile, ext, "application/pdf"),
          buffer,
          prefix: `rider-nid-${userId.slice(0, 8)}`,
        })
      }

      const insFile = formData.get("vehicleInsuranceDoc") as File | null
      if (insFile && typeof insFile === "object" && insFile.size > 0) {
        const val = validateOnboardingFile(insFile, { maxSizeMb: 4.5 })
        if (!val.isValid) {
          return NextResponse.json({ success: false, error: `Vehicle Insurance: ${val.error}` }, { status: 400 })
        }
        const buffer = Buffer.from(await insFile.arrayBuffer())
        const ext = getSafeFileExt(insFile, ".pdf")
        vehicleInsuranceDocUrl = await uploadPublicFile({
          folder: "onboarding/kyc",
          ext,
          contentType: getSafeFileMime(insFile, ext, "application/pdf"),
          buffer,
          prefix: `rider-ins-${userId.slice(0, 8)}`,
        })
      }
    } else {
      const body = await request.json().catch(() => ({}))
      name = body.name || null
      if ("email" in body) {
        hasEmailField = true
        email = body.email || null
      }
      phone = body.phone || null
      phoneCountryCode = body.phoneCountryCode || null
      vehicleName = body.vehicleName || null
      vehicleNumber = body.vehicleNumber || null
      drivingLicenseNo = body.drivingLicenseNo || null
      if (body.vehicleType) {
        vehicleTypes = [String(body.vehicleType).trim()]
      } else if (body.vehicleTypes) {
        vehicleTypes = Array.isArray(body.vehicleTypes) ? body.vehicleTypes.slice(0, 1) : [String(body.vehicleTypes)]
      }
      selectedZones = body.selectedZones || []
      selectedLocations = body.selectedLocations || []
      currentPassword = body.currentPassword || null
      newPassword = body.newPassword || null
      if (body.profileImageUrl) profileImageUrl = body.profileImageUrl
      if (body.drivingLicenseDocUrl) drivingLicenseDocUrl = body.drivingLicenseDocUrl
      if (body.nationalIdDocUrl) nationalIdDocUrl = body.nationalIdDocUrl
      if (body.vehicleInsuranceDocUrl) vehicleInsuranceDocUrl = body.vehicleInsuranceDocUrl

      if (
        body.paymentOption !== undefined ||
        body.bankName !== undefined ||
        body.accountHolderName !== undefined ||
        body.accountNumber !== undefined ||
        body.bbanNumber !== undefined ||
        body.branchName !== undefined ||
        body.bankAddress !== undefined ||
        body.mobileNumber !== undefined ||
        body.agentNumber !== undefined
      ) {
        hasPaymentField = true
        paymentOption = body.paymentOption
        bankName = body.bankName
        accountHolderName = body.accountHolderName
        accountNumber = body.accountNumber
        bbanNumber = body.bbanNumber
        branchName = body.branchName
        bankAddress = body.bankAddress
        mobileNumber = body.mobileNumber
        agentNumber = body.agentNumber
      }
    }

    // Password change check
    if (newPassword && newPassword.trim().length >= 6) {
      if (user.password && currentPassword) {
        const isValid = await bcrypt.compare(currentPassword, user.password)
        if (!isValid) {
          return NextResponse.json(
            { success: false, error: "Current password does not match." },
            { status: 400 }
          )
        }
      }
    }

    const userUpdates: {
      name?: string
      email?: string | null
      image?: string | null
      phone?: string | null
      phoneCountryCode?: string | null
      password?: string
    } = {}

    if (hasEmailField) {
      const trimmedEmail = email?.trim().toLowerCase()
      if (trimmedEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(trimmedEmail)) {
          return NextResponse.json({ success: false, error: "Please enter a valid email address." }, { status: 400 })
        }
        const existingUser = await prisma.user.findFirst({
          where: { email: trimmedEmail, NOT: { id: userId } },
        })
        if (existingUser) {
          return NextResponse.json({ success: false, error: "This email address is already registered to another account." }, { status: 400 })
        }
        userUpdates.email = trimmedEmail
      } else {
        userUpdates.email = null
      }
    }

    if (name?.trim()) userUpdates.name = name.trim()
    if (profileImageUrl) userUpdates.image = profileImageUrl
    if (phone?.trim()) userUpdates.phone = phone.trim()
    if (phoneCountryCode?.trim()) userUpdates.phoneCountryCode = phoneCountryCode.trim()
    if (newPassword && newPassword.trim().length >= 6) {
      userUpdates.password = await bcrypt.hash(newPassword.trim(), 10)
    }

    await prisma.user.update({
      where: { id: userId },
      data: userUpdates,
    })

    const riderUpdates: any = {
      vehicleTypes: vehicleTypes,
      vehicleName: vehicleName?.trim() || null,
      vehicleNumber: vehicleNumber?.trim() || null,
      drivingLicenseNo: drivingLicenseNo?.trim() || null,
      profileImage: profileImageUrl,
      drivingLicenseDoc: drivingLicenseDocUrl,
      nationalIdDoc: nationalIdDocUrl,
      vehicleInsuranceDoc: vehicleInsuranceDocUrl,
      selectedZones: selectedZones,
      selectedLocations: selectedLocations,
    }

    if (hasPaymentField) {
      const parsedPayment = validateAndFormatPaymentDetails(
        {
          paymentOption: paymentOption ?? user.rider?.paymentOption ?? "Bank",
          bankName: bankName !== undefined ? bankName : user.rider?.bankName,
          accountHolderName: accountHolderName !== undefined ? accountHolderName : user.rider?.accountHolderName,
          accountNumber: accountNumber !== undefined ? accountNumber : user.rider?.accountNumber,
          bbanNumber: bbanNumber !== undefined ? bbanNumber : user.rider?.bbanNumber,
          branchName: branchName !== undefined ? branchName : user.rider?.branchName,
          bankAddress: bankAddress !== undefined ? bankAddress : user.rider?.bankAddress,
          mobileNumber: mobileNumber !== undefined ? mobileNumber : user.rider?.mobileNumber,
          agentNumber: agentNumber !== undefined ? agentNumber : user.rider?.agentNumber,
        },
        { requireFields: false }
      ).data

      riderUpdates.paymentOption = parsedPayment.paymentOption
      riderUpdates.preferredPayoutMethod = parsedPayment.preferredPayoutMethod
      riderUpdates.bankName = parsedPayment.bankName
      riderUpdates.bankAddress = parsedPayment.bankAddress
      riderUpdates.accountHolderName = parsedPayment.accountHolderName
      riderUpdates.accountNumber = parsedPayment.accountNumber
      riderUpdates.bbanNumber = parsedPayment.bbanNumber
      riderUpdates.branchName = parsedPayment.branchName
      riderUpdates.mobileMoneyOption = parsedPayment.mobileMoneyOption
      riderUpdates.mobileNumber = parsedPayment.mobileNumber
      riderUpdates.agentNumber = parsedPayment.agentNumber
    }

    const updatedRider = await prisma.rider.update({
      where: { userId },
      data: riderUpdates,
    })

    const updatedVehicleType = (updatedRider.vehicleTypes as string[])?.[0] || "2_WHEELER"
    const finalPasswordHash = userUpdates.password || user.password
    let tokens = undefined
    if (userUpdates.password) {
      tokens = generateMobileTokens({
        userId,
        email: userUpdates.email !== undefined ? userUpdates.email : user.email,
        phone: userUpdates.phone !== undefined ? userUpdates.phone : user.phone,
        role: user.role,
        passwordHash: finalPasswordHash,
      })
    }

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully!",
      data: {
        rider: {
          ...updatedRider,
          vehicleType: updatedVehicleType,
        },
        ...(tokens && { tokens }),
      },
    })
  } catch (error) {
    console.error("Mobile rider settings update error:", error)
    return NextResponse.json(
      { success: false, error: "An error occurred while updating settings." },
      { status: 500 }
    )
  }
}

export const PUT = POST
export const PATCH = POST

