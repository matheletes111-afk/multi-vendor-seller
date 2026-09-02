import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import path from "path"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { validatePhoneAndCountryCode } from "@/lib/phone-validation"

function getSafeFileExt(file: File, fallbackExt: string): string {
  const ext = path.extname(file.name || "").toLowerCase()
  if (ext && ext.length >= 2 && ext.length <= 6) return ext
  if (file.type) {
    const t = file.type.toLowerCase()
    if (t.includes("png")) return ".png"
    if (t.includes("jpeg") || t.includes("jpg")) return ".jpg"
    if (t.includes("webp")) return ".webp"
    if (t.includes("pdf")) return ".pdf"
  }
  return fallbackExt
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { rider: true },
    })

    if (!user || user.role !== UserRole.RIDER) {
      return NextResponse.json({ error: "Forbidden: Not a rider account" }, { status: 403 })
    }

    if (user.rider?.isSuspended || user.rider?.status === "SUSPENDED") {
      return NextResponse.json({ error: "Account is suspended" }, { status: 403 })
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

      // Handle profile image upload
      const profileImageFile = formData.get("profileImage") as File | null
      if (profileImageFile && typeof profileImageFile === "object" && profileImageFile.size > 0) {
        try {
          const buffer = Buffer.from(await profileImageFile.arrayBuffer())
          const ext = getSafeFileExt(profileImageFile, ".jpg")
          profileImageUrl = await uploadPublicFile({
            folder: "profile",
            ext,
            contentType: profileImageFile.type || "image/jpeg",
            buffer,
            prefix: `rider-pfp-${userId.slice(0, 8)}`,
          })
        } catch (err: any) {
          console.error("Error uploading profile image:", err)
          throw new Error(`Profile image upload failed: ${err.message || err}`)
        }
      }

      // Handle driving license document
      const drivingLicenseFile = formData.get("drivingLicenseDoc") as File | null
      if (drivingLicenseFile && typeof drivingLicenseFile === "object" && drivingLicenseFile.size > 0) {
        try {
          const buffer = Buffer.from(await drivingLicenseFile.arrayBuffer())
          const ext = getSafeFileExt(drivingLicenseFile, ".pdf")
          drivingLicenseDocUrl = await uploadPublicFile({
            folder: "onboarding/kyc",
            ext,
            contentType: drivingLicenseFile.type || "application/pdf",
            buffer,
            prefix: `rider-dl-${userId.slice(0, 8)}`,
          })
        } catch (err: any) {
          console.error("Error uploading driving license document:", err)
          throw new Error(`Driving license document upload failed: ${err.message || err}`)
        }
      }

      // Handle national ID document
      const nationalIdFile = formData.get("nationalIdDoc") as File | null
      if (nationalIdFile && typeof nationalIdFile === "object" && nationalIdFile.size > 0) {
        try {
          const buffer = Buffer.from(await nationalIdFile.arrayBuffer())
          const ext = getSafeFileExt(nationalIdFile, ".pdf")
          nationalIdDocUrl = await uploadPublicFile({
            folder: "onboarding/kyc",
            ext,
            contentType: nationalIdFile.type || "application/pdf",
            buffer,
            prefix: `rider-nid-${userId.slice(0, 8)}`,
          })
        } catch (err: any) {
          console.error("Error uploading national ID document:", err)
          throw new Error(`National ID document upload failed: ${err.message || err}`)
        }
      }

      // Handle vehicle insurance document
      const vehicleInsuranceFile = formData.get("vehicleInsuranceDoc") as File | null
      if (vehicleInsuranceFile && typeof vehicleInsuranceFile === "object" && vehicleInsuranceFile.size > 0) {
        try {
          const buffer = Buffer.from(await vehicleInsuranceFile.arrayBuffer())
          const ext = getSafeFileExt(vehicleInsuranceFile, ".pdf")
          vehicleInsuranceDocUrl = await uploadPublicFile({
            folder: "onboarding/kyc",
            ext,
            contentType: vehicleInsuranceFile.type || "application/pdf",
            buffer,
            prefix: `rider-ins-${userId.slice(0, 8)}`,
          })
        } catch (err: any) {
          console.error("Error uploading vehicle insurance document:", err)
          throw new Error(`Vehicle insurance document upload failed: ${err.message || err}`)
        }
      }
    } else {
      const body = await request.json()
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
    }

    // 1. Update user password if provided
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
        return NextResponse.json({ error: pVal.error || "Invalid phone number or country code" }, { status: 400 })
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

    // 2. Upsert / Update Rider profile
    const rider = await prisma.rider.upsert({
      where: { userId },
      create: {
        userId,
        isApproved: true,
        isSuspended: false,
        status: "APPROVED",
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
        adminFeedback: null,
      },
      update: {
        onboardingCompleted: true,
        isFirstLogin: false,
        // If re-submitting after rejection, move to PENDING or keep APPROVED
        status: user.rider?.status === "REJECTED" ? "PENDING" : user.rider?.status || "APPROVED",
        adminFeedback: null, // Clear past feedback on resubmit
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
      },
    })

    return NextResponse.json({
      success: true,
      message: "Onboarding completed successfully!",
      rider,
      passwordHash: userUpdates.password || undefined,
    })
  } catch (error: any) {
    console.error("Rider onboarding error:", error)
    const msg = error?.message || "An error occurred while saving onboarding details. Please try again."
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    )
  }
}
