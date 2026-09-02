import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "@/app/mobileapi/_helpers/rider-auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { generateMobileTokens } from "@/lib/mobile-jwt"

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

      const profileImageFile = formData.get("profileImage") as File | null
      if (profileImageFile && typeof profileImageFile === "object" && profileImageFile.size > 0) {
        const buffer = Buffer.from(await profileImageFile.arrayBuffer())
        const ext = profileImageFile.name.substring(profileImageFile.name.lastIndexOf(".")) || ".jpg"
        profileImageUrl = await uploadPublicFile({
          folder: "profile",
          ext,
          contentType: profileImageFile.type || "image/jpeg",
          buffer,
          prefix: `rider-pfp-${userId.slice(0, 8)}`,
        })
      }

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
      const body = await request.json().catch(() => ({}))
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

    const updatedRider = await prisma.rider.update({
      where: { userId },
      data: {
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

    const updatedVehicleType = (updatedRider.vehicleTypes as string[])?.[0] || "2_WHEELER"
    const finalPasswordHash = userUpdates.password || user.password
    let tokens = undefined
    if (userUpdates.password) {
      tokens = generateMobileTokens({
        userId,
        email: user.email,
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
