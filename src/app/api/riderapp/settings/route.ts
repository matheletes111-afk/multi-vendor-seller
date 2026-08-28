import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { validatePhoneAndCountryCode } from "@/lib/phone-validation"

// GET /api/riderapp/settings — Fetch full rider settings and profile
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        phoneCountryCode: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        rider: true,
      },
    })

    if (!user || user.role !== UserRole.RIDER) {
      return NextResponse.json({ error: "Forbidden: Not a rider account" }, { status: 403 })
    }

    let completedDeliveriesCount = 0
    let totalEarnings = 0
    let activeDeliveriesCount = 0

    if (user.rider?.id) {
      const completedAssignments = await prisma.riderDeliveryAssignment.findMany({
        where: {
          riderId: user.rider.id,
          status: "DELIVERED",
        },
        include: {
          order: {
            select: {
              shipping: true,
              items: {
                select: { shippingAmount: true },
              },
            },
          },
        },
      })

      completedDeliveriesCount = completedAssignments.length
      // Each delivery earns the order-level shipping total (delivery fee)
      totalEarnings = completedAssignments.reduce((sum, a) => {
        // Use order.shipping (set at checkout) as the definitive delivery fee
        const orderShipping = Number(a.order?.shipping ?? 0)
        if (orderShipping > 0) return sum + orderShipping
        // Fallback: sum item-level shippingAmounts
        const itemsShipping = a.order?.items?.reduce((s: number, i: any) => s + (Number(i.shippingAmount) || 0), 0) ?? 0
        return sum + itemsShipping
      }, 0)

      activeDeliveriesCount = await prisma.riderDeliveryAssignment.count({
        where: {
          riderId: user.rider.id,
          status: { in: ["ACCEPTED", "AT_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"] },
        },
      })
    }

    return NextResponse.json({
      success: true,
      user,
      rider: user.rider,
      stats: {
        completedDeliveriesCount,
        totalEarnings,
        activeDeliveriesCount,
      },
    })
  } catch (error) {
    console.error("Rider settings GET error:", error)
    return NextResponse.json(
      { error: "Failed to load rider settings." },
      { status: 500 }
    )
  }
}

// POST /api/riderapp/settings — Update rider settings (profile, documents, zones, vehicle, password)
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

    const contentType = request.headers.get("content-type") || ""
    let name: string | null = null
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

    let profileImageUrl: string | null = user.image || user.rider?.profileImage || null
    let drivingLicenseDocUrl: string | null = user.rider?.drivingLicenseDoc || null
    let nationalIdDocUrl: string | null = user.rider?.nationalIdDoc || null
    let vehicleInsuranceDocUrl: string | null = user.rider?.vehicleInsuranceDoc || null

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()

      name = formData.get("name") as string | null
      phone = formData.get("phone") as string | null
      phoneCountryCode = formData.get("phoneCountryCode") as string | null
      vehicleName = formData.get("vehicleName") as string | null
      vehicleNumber = formData.get("vehicleNumber") as string | null
      drivingLicenseNo = formData.get("drivingLicenseNo") as string | null
      currentPassword = formData.get("currentPassword") as string | null
      newPassword = formData.get("newPassword") as string | null

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
      currentPassword = body.currentPassword || null
      newPassword = body.newPassword || null
      if (body.profileImageUrl) profileImageUrl = body.profileImageUrl
      if (body.drivingLicenseDocUrl) drivingLicenseDocUrl = body.drivingLicenseDocUrl
      if (body.nationalIdDocUrl) nationalIdDocUrl = body.nationalIdDocUrl
      if (body.vehicleInsuranceDocUrl) vehicleInsuranceDocUrl = body.vehicleInsuranceDocUrl
    }

    // Password change verification
    if (newPassword && newPassword.trim().length >= 6) {
      if (user.password && currentPassword) {
        const isValid = await bcrypt.compare(currentPassword, user.password)
        if (!isValid) {
          return NextResponse.json({ error: "Current password does not match." }, { status: 400 })
        }
      }
    }

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

    const updatedRider = await prisma.rider.upsert({
      where: { userId },
      create: {
        userId,
        isApproved: true,
        isSuspended: false,
        status: "APPROVED",
        onboardingCompleted: true,
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
      update: {
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
      message: "Settings updated successfully!",
      rider: updatedRider,
    })
  } catch (error) {
    console.error("Rider settings update error:", error)
    return NextResponse.json(
      { error: "An error occurred while updating settings." },
      { status: 500 }
    )
  }
}
