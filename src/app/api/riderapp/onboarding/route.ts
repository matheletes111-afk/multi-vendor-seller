import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import { uploadPublicFile } from "@/lib/upload-public-file"

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
        const buffer = Buffer.from(await profileImageFile.arrayBuffer())
        const ext = profileImageFile.name.substring(profileImageFile.name.lastIndexOf(".")) || ".jpg"
        profileImageUrl = await uploadPublicFile({
          folder: "riders/profiles",
          ext,
          contentType: profileImageFile.type || "image/jpeg",
          buffer,
          prefix: `rider-pfp-${userId.slice(0, 8)}`,
        })
      }

      // Handle driving license document
      const dlFile = formData.get("drivingLicenseDoc") as File | null
      if (dlFile && typeof dlFile === "object" && dlFile.size > 0) {
        const buffer = Buffer.from(await dlFile.arrayBuffer())
        const ext = dlFile.name.substring(dlFile.name.lastIndexOf(".")) || ".pdf"
        drivingLicenseDocUrl = await uploadPublicFile({
          folder: "riders/documents",
          ext,
          contentType: dlFile.type || "application/pdf",
          buffer,
          prefix: `rider-dl-${userId.slice(0, 8)}`,
        })
      }

      // Handle national ID document
      const nidFile = formData.get("nationalIdDoc") as File | null
      if (nidFile && typeof nidFile === "object" && nidFile.size > 0) {
        const buffer = Buffer.from(await nidFile.arrayBuffer())
        const ext = nidFile.name.substring(nidFile.name.lastIndexOf(".")) || ".pdf"
        nationalIdDocUrl = await uploadPublicFile({
          folder: "riders/documents",
          ext,
          contentType: nidFile.type || "application/pdf",
          buffer,
          prefix: `rider-nid-${userId.slice(0, 8)}`,
        })
      }

      // Handle insurance document
      const insFile = formData.get("vehicleInsuranceDoc") as File | null
      if (insFile && typeof insFile === "object" && insFile.size > 0) {
        const buffer = Buffer.from(await insFile.arrayBuffer())
        const ext = insFile.name.substring(insFile.name.lastIndexOf(".")) || ".pdf"
        vehicleInsuranceDocUrl = await uploadPublicFile({
          folder: "riders/documents",
          ext,
          contentType: insFile.type || "application/pdf",
          buffer,
          prefix: `rider-ins-${userId.slice(0, 8)}`,
        })
      }
    } else {
      const body = await request.json()
      newPassword = body.newPassword || null
      name = body.name || null
      phone = body.phone || null
      phoneCountryCode = body.phoneCountryCode || null
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
    if (phone?.trim()) userUpdates.phone = phone.trim()
    if (phoneCountryCode?.trim()) userUpdates.phoneCountryCode = phoneCountryCode.trim()

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
    })
  } catch (error) {
    console.error("Rider onboarding error:", error)
    return NextResponse.json(
      { error: "An error occurred while saving onboarding details. Please try again." },
      { status: 500 }
    )
  }
}
