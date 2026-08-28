import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "@/app/mobileapi/_helpers/rider-auth"
import { prisma } from "@/lib/prisma"

// GET /mobileapi/rider/profile — Fetch authenticated rider profile
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

    return NextResponse.json({
      success: true,
      data: {
        user,
        rider: rider ? {
          ...rider,
          vehicleType: vehicleTypeResult,
        } : null,
      },
    })
  } catch (error) {
    console.error("Mobile rider profile GET error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load rider profile." },
      { status: 500 }
    )
  }
}

// PATCH /mobileapi/rider/profile — Update basic profile fields
export async function PATCH(request: NextRequest) {
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
    const body = await request.json().catch(() => ({}))
    const {
      name,
      phone,
      phoneCountryCode,
      profileImage,
      vehicleType,
      vehicleTypes,
      vehicleNumber,
      drivingLicenseNo,
      selectedZones,
      selectedLocations,
    } = body

    const userUpdates: {
      name?: string
      phone?: string | null
      phoneCountryCode?: string | null
      image?: string | null
    } = {}

    if (name !== undefined) userUpdates.name = String(name).trim()
    if (phone !== undefined) userUpdates.phone = phone ? String(phone).trim() : null
    if (phoneCountryCode !== undefined) userUpdates.phoneCountryCode = phoneCountryCode ? String(phoneCountryCode).trim() : null
    if (profileImage !== undefined) userUpdates.image = profileImage || null

    if (Object.keys(userUpdates).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userUpdates,
      })
    }

    const riderUpdates: any = {}
    if (vehicleType !== undefined) {
      riderUpdates.vehicleTypes = [String(vehicleType).trim()]
    } else if (vehicleTypes !== undefined) {
      riderUpdates.vehicleTypes = Array.isArray(vehicleTypes) ? vehicleTypes.slice(0, 1) : [String(vehicleTypes)]
    }
    if (vehicleNumber !== undefined) riderUpdates.vehicleNumber = vehicleNumber ? String(vehicleNumber).trim() : null
    if (drivingLicenseNo !== undefined) riderUpdates.drivingLicenseNo = drivingLicenseNo ? String(drivingLicenseNo).trim() : null
    if (profileImage !== undefined) riderUpdates.profileImage = profileImage || null
    if (selectedZones !== undefined) riderUpdates.selectedZones = selectedZones
    if (selectedLocations !== undefined) riderUpdates.selectedLocations = selectedLocations

    const updatedRider = await prisma.rider.update({
      where: { userId },
      data: riderUpdates,
    })

    const updatedVehicleType = (updatedRider.vehicleTypes as string[])?.[0] || "2_WHEELER"

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      data: {
        rider: {
          ...updatedRider,
          vehicleType: updatedVehicleType,
        },
      },
    })
  } catch (error) {
    console.error("Mobile rider profile PATCH error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update rider profile." },
      { status: 500 }
    )
  }
}
