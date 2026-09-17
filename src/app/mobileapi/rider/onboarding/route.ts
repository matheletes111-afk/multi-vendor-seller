import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "@/app/mobileapi/_helpers/rider-auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import path from "path"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { validatePhoneAndCountryCode } from "@/lib/phone-validation"
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
    let newPassword: string | null = null
    let name: string | null = null
    let phone: string | null = null
    let phoneCountryCode: string | null = null
    let vehicleTypes: string[] = []
    let vehicleName: string | null = null
    let vehicleNumber: string | null = null
    let drivingLicenseNo: string | null = null
    let selectedZones: string[] = []
    let selectedLocations: string[] = []

    let paymentOption: string | null = null
    let bankName: string | null = null
    let accountHolderName: string | null = null
    let accountNumber: string | null = null
    let bbanNumber: string | null = null
    let branchName: string | null = null
    let bankAddress: string | null = null
    let mobileNumber: string | null = null
    let agentNumber: string | null = null

    let profileImageUrl: string | null = user.image || user.rider?.profileImage || null
    let drivingLicenseDocUrl: string | null = user.rider?.drivingLicenseDoc || null
    let nationalIdDocUrl: string | null = user.rider?.nationalIdDoc || null
    let vehicleInsuranceDocUrl: string | null = user.rider?.vehicleInsuranceDoc || null

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()

      newPassword = formData.get("newPassword") as string | null
      name = formData.get("name") as string | null
      phone = formData.get("phone") as string | null
      phoneCountryCode = formData.get("phoneCountryCode") as string | null
      vehicleName = formData.get("vehicleName") as string | null
      vehicleNumber = formData.get("vehicleNumber") as string | null
      drivingLicenseNo = formData.get("drivingLicenseNo") as string | null

      paymentOption = formData.get("paymentOption") as string | null
      bankName = formData.get("bankName") as string | null
      accountHolderName = formData.get("accountHolderName") as string | null
      accountNumber = formData.get("accountNumber") as string | null
      bbanNumber = formData.get("bbanNumber") as string | null
      branchName = formData.get("branchName") as string | null
      bankAddress = formData.get("bankAddress") as string | null
      mobileNumber = formData.get("mobileNumber") as string | null
      agentNumber = formData.get("agentNumber") as string | null

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

      // Handle profile image file upload
      const profileImageFile = formData.get("profileImage") as File | null
      if (profileImageFile && typeof profileImageFile === "object" && profileImageFile.size > 0) {
        const val = validateOnboardingFile(profileImageFile, { imagesOnly: true, maxSizeMb: 4.5 })
        if (!val.isValid) {
          return NextResponse.json({ success: false, error: `Profile Picture: ${val.error}` }, { status: 400 })
        }
        try {
          const buffer = Buffer.from(await profileImageFile.arrayBuffer())
          const ext = getSafeFileExt(profileImageFile, ".jpg")
          profileImageUrl = await uploadPublicFile({
            folder: "profile",
            ext,
            contentType: getSafeFileMime(profileImageFile, ext, "image/jpeg"),
            buffer,
            prefix: `rider-pfp-${userId.slice(0, 8)}`,
          })
        } catch (err: any) {
          console.error("Error uploading profile image:", err)
          throw new Error(`Profile image upload failed: ${err.message || err}`)
        }
      }

      // Handle driving license document upload
      const dlFile = formData.get("drivingLicenseDoc") as File | null
      if (dlFile && typeof dlFile === "object" && dlFile.size > 0) {
        const val = validateOnboardingFile(dlFile, { maxSizeMb: 4.5 })
        if (!val.isValid) {
          return NextResponse.json({ success: false, error: `Driving License: ${val.error}` }, { status: 400 })
        }
        try {
          const buffer = Buffer.from(await dlFile.arrayBuffer())
          const ext = getSafeFileExt(dlFile, ".pdf")
          drivingLicenseDocUrl = await uploadPublicFile({
            folder: "onboarding/kyc",
            ext,
            contentType: getSafeFileMime(dlFile, ext, "application/pdf"),
            buffer,
            prefix: `rider-dl-${userId.slice(0, 8)}`,
          })
        } catch (err: any) {
          console.error("Error uploading driving license document:", err)
          throw new Error(`Driving license document upload failed: ${err.message || err}`)
        }
      }

      // Handle national ID document upload
      const nidFile = formData.get("nationalIdDoc") as File | null
      if (nidFile && typeof nidFile === "object" && nidFile.size > 0) {
        const val = validateOnboardingFile(nidFile, { maxSizeMb: 4.5 })
        if (!val.isValid) {
          return NextResponse.json({ success: false, error: `National ID: ${val.error}` }, { status: 400 })
        }
        try {
          const buffer = Buffer.from(await nidFile.arrayBuffer())
          const ext = getSafeFileExt(nidFile, ".pdf")
          nationalIdDocUrl = await uploadPublicFile({
            folder: "onboarding/kyc",
            ext,
            contentType: getSafeFileMime(nidFile, ext, "application/pdf"),
            buffer,
            prefix: `rider-nid-${userId.slice(0, 8)}`,
          })
        } catch (err: any) {
          console.error("Error uploading national ID document:", err)
          throw new Error(`National ID document upload failed: ${err.message || err}`)
        }
      }

      // Handle vehicle insurance document upload
      const insFile = formData.get("vehicleInsuranceDoc") as File | null
      if (insFile && typeof insFile === "object" && insFile.size > 0) {
        const val = validateOnboardingFile(insFile, { maxSizeMb: 4.5 })
        if (!val.isValid) {
          return NextResponse.json({ success: false, error: `Vehicle Insurance: ${val.error}` }, { status: 400 })
        }
        try {
          const buffer = Buffer.from(await insFile.arrayBuffer())
          const ext = getSafeFileExt(insFile, ".pdf")
          vehicleInsuranceDocUrl = await uploadPublicFile({
            folder: "onboarding/kyc",
            ext,
            contentType: getSafeFileMime(insFile, ext, "application/pdf"),
            buffer,
            prefix: `rider-ins-${userId.slice(0, 8)}`,
          })
        } catch (err: any) {
          console.error("Error uploading vehicle insurance document:", err)
          throw new Error(`Vehicle insurance document upload failed: ${err.message || err}`)
        }
      }
    } else {
      const body = await request.json().catch(() => ({}))
      newPassword = body.newPassword || null
      name = body.name || null
      phone = body.phone || null
      phoneCountryCode = body.phoneCountryCode || null
      vehicleName = body.vehicleName || null
      const singleVehicle = (body.vehicleType as string | null)?.trim()
      if (singleVehicle) {
        vehicleTypes = [singleVehicle]
      } else if (body.vehicleTypes) {
        vehicleTypes = Array.isArray(body.vehicleTypes) ? body.vehicleTypes.slice(0, 1) : [String(body.vehicleTypes)]
      } else {
        vehicleTypes = []
      }
      vehicleNumber = body.vehicleNumber || null
      drivingLicenseNo = body.drivingLicenseNo || null
      selectedZones = body.selectedZones || []
      selectedLocations = body.selectedLocations || []
      if (body.profileImageUrl) profileImageUrl = body.profileImageUrl
      if (body.drivingLicenseDocUrl) drivingLicenseDocUrl = body.drivingLicenseDocUrl
      if (body.nationalIdDocUrl) nationalIdDocUrl = body.nationalIdDocUrl
      if (body.vehicleInsuranceDocUrl) vehicleInsuranceDocUrl = body.vehicleInsuranceDocUrl

      paymentOption = body.paymentOption || null
      bankName = body.bankName || null
      accountHolderName = body.accountHolderName || null
      accountNumber = body.accountNumber || null
      bbanNumber = body.bbanNumber || null
      branchName = body.branchName || null
      bankAddress = body.bankAddress || null
      mobileNumber = body.mobileNumber || null
      agentNumber = body.agentNumber || null
    }

    // Process and normalize payout & payment details
    const parsedPayment = validateAndFormatPaymentDetails(
      {
        paymentOption: paymentOption || user.rider?.paymentOption || "Bank",
        bankName: bankName !== null ? bankName : user.rider?.bankName,
        accountHolderName: accountHolderName !== null ? accountHolderName : user.rider?.accountHolderName,
        accountNumber: accountNumber !== null ? accountNumber : user.rider?.accountNumber,
        bbanNumber: bbanNumber !== null ? bbanNumber : user.rider?.bbanNumber,
        branchName: branchName !== null ? branchName : user.rider?.branchName,
        bankAddress: bankAddress !== null ? bankAddress : user.rider?.bankAddress,
        mobileNumber: mobileNumber !== null ? mobileNumber : user.rider?.mobileNumber,
        agentNumber: agentNumber !== null ? agentNumber : user.rider?.agentNumber,
      },
      { requireFields: false }
    ).data

    // 1. Update user credentials and name if provided
    const userUpdates: {
      name?: string
      image?: string | null
      phone?: string | null
      phoneCountryCode?: string | null
      password?: string
    } = {}

    if (name?.trim()) userUpdates.name = name.trim()
    if (profileImageUrl) userUpdates.image = profileImageUrl
    if (phone?.trim() || phoneCountryCode?.trim()) {
      const pVal = validatePhoneAndCountryCode(phone || "", phoneCountryCode || "")
      if (!pVal.isValid) {
        return NextResponse.json({ success: false, error: pVal.error || "Invalid phone number or country code" }, { status: 400 })
      }
      userUpdates.phone = pVal.cleanedPhone
      userUpdates.phoneCountryCode = pVal.cleanedCountryCode
    }

    if (newPassword && newPassword.trim().length >= 6) {
      userUpdates.password = await bcrypt.hash(newPassword.trim(), 10)
    }

    await prisma.user.update({
      where: { id: userId },
      data: userUpdates,
    })

    // 2. Upsert / update rider profile
    const updatedRider = await prisma.rider.upsert({
      where: { userId },
      create: {
        userId,
        isApproved: false,
        isSuspended: false,
        status: "PENDING",
        onboardingCompleted: true,
        isFirstLogin: false,
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
        paymentOption: parsedPayment.paymentOption,
        preferredPayoutMethod: parsedPayment.preferredPayoutMethod,
        bankName: parsedPayment.bankName,
        bankAddress: parsedPayment.bankAddress,
        accountHolderName: parsedPayment.accountHolderName,
        accountNumber: parsedPayment.accountNumber,
        bbanNumber: parsedPayment.bbanNumber,
        branchName: parsedPayment.branchName,
        mobileMoneyOption: parsedPayment.mobileMoneyOption,
        mobileNumber: parsedPayment.mobileNumber,
        agentNumber: parsedPayment.agentNumber,
      },
      update: {
        onboardingCompleted: true,
        isFirstLogin: false,
        status: user.rider?.status === "APPROVED" ? "APPROVED" : "PENDING",
        isApproved: user.rider?.status === "APPROVED" && Boolean(user.rider?.isApproved),
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
        adminFeedback: null,
        paymentOption: parsedPayment.paymentOption,
        preferredPayoutMethod: parsedPayment.preferredPayoutMethod,
        bankName: parsedPayment.bankName,
        bankAddress: parsedPayment.bankAddress,
        accountHolderName: parsedPayment.accountHolderName,
        accountNumber: parsedPayment.accountNumber,
        bbanNumber: parsedPayment.bbanNumber,
        branchName: parsedPayment.branchName,
        mobileMoneyOption: parsedPayment.mobileMoneyOption,
        mobileNumber: parsedPayment.mobileNumber,
        agentNumber: parsedPayment.agentNumber,
      },
    })

    const vehicleTypeResult = (updatedRider.vehicleTypes as string[])?.[0] || "2_WHEELER"
    const finalPasswordHash = userUpdates.password || user.password
    const tokens = generateMobileTokens({
      userId,
      email: user.email,
      role: user.role,
      passwordHash: finalPasswordHash,
    })

    return NextResponse.json({
      success: true,
      message: "Rider onboarding completed successfully!",
      data: {
        rider: {
          ...updatedRider,
          vehicleType: vehicleTypeResult,
        },
        tokens,
        onboardingCompleted: true,
      },
    })
  } catch (error: any) {
    console.error("Mobile rider onboarding error:", error)
    const msg = error?.message || "An error occurred while saving onboarding details."
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}
