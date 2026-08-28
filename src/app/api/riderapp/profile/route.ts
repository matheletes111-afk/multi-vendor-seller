import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

// GET /api/riderapp/profile — Fetch current logged-in rider profile
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

    return NextResponse.json({
      success: true,
      user,
      rider: user.rider,
    })
  } catch (error) {
    console.error("Rider profile GET error:", error)
    return NextResponse.json(
      { error: "Failed to load rider profile." },
      { status: 500 }
    )
  }
}

// PATCH /api/riderapp/profile — Update rider profile details
export async function PATCH(request: Request) {
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

    const body = await request.json().catch(() => ({}))
    const {
      name,
      phone,
      phoneCountryCode,
      vehicleTypes,
      vehicleNumber,
      drivingLicenseNo,
      profileImage,
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
    if (vehicleTypes !== undefined) riderUpdates.vehicleTypes = vehicleTypes
    if (vehicleNumber !== undefined) riderUpdates.vehicleNumber = vehicleNumber ? String(vehicleNumber).trim() : null
    if (drivingLicenseNo !== undefined) riderUpdates.drivingLicenseNo = drivingLicenseNo ? String(drivingLicenseNo).trim() : null
    if (profileImage !== undefined) riderUpdates.profileImage = profileImage || null
    if (selectedZones !== undefined) riderUpdates.selectedZones = selectedZones
    if (selectedLocations !== undefined) riderUpdates.selectedLocations = selectedLocations

    const updatedRider = await prisma.rider.upsert({
      where: { userId },
      create: {
        userId,
        isApproved: true,
        isSuspended: false,
        status: "APPROVED",
        onboardingCompleted: true,
        ...riderUpdates,
      },
      update: riderUpdates,
    })

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      rider: updatedRider,
    })
  } catch (error) {
    console.error("Rider profile PATCH error:", error)
    return NextResponse.json(
      { error: "Failed to update profile." },
      { status: 500 }
    )
  }
}
