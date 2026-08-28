import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { validatePhoneAndCountryCode } from "@/lib/phone-validation"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        phoneCountryCode: true,
        image: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
        rider: true,
      },
    })

    if (!user || !user.rider) {
      return NextResponse.json({ error: "Rider not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      user,
      rider: user.rider,
    })
  } catch (error) {
    console.error("Admin GET single rider error:", error)
    return NextResponse.json({ error: "Failed to load rider details." }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()
    const {
      name,
      phone,
      phoneCountryCode,
      status,
      isSuspended,
      isApproved,
      adminFeedback,
      adminNotes,
      selectedZones,
      selectedLocations,
      vehicleTypes,
      vehicleName,
      vehicleNumber,
      drivingLicenseNo,
    } = body

    const user = await prisma.user.findUnique({
      where: { id },
      include: { rider: true },
    })

    if (!user || !user.rider) {
      return NextResponse.json({ error: "Rider not found" }, { status: 404 })
    }

    // User updates
    const userUpdates: any = {}
    if (name !== undefined) userUpdates.name = name?.trim() || null
    if (phone !== undefined && phoneCountryCode !== undefined) {
      if (phone && phoneCountryCode) {
        const phoneValidation = validatePhoneAndCountryCode(phone, phoneCountryCode)
        if (phoneValidation.isValid) {
          userUpdates.phone = phoneValidation.cleanedPhone
          userUpdates.phoneCountryCode = phoneValidation.cleanedCountryCode
        }
      } else {
        userUpdates.phone = phone || null
        userUpdates.phoneCountryCode = phoneCountryCode || null
      }
    }

    if (Object.keys(userUpdates).length > 0) {
      await prisma.user.update({
        where: { id },
        data: userUpdates,
      })
    }

    // Rider updates
    const riderUpdates: any = {}
    if (status !== undefined) {
      riderUpdates.status = status
      if (status === "APPROVED") {
        riderUpdates.isApproved = true
        riderUpdates.isSuspended = false
      } else if (status === "SUSPENDED") {
        riderUpdates.isSuspended = true
      } else if (status === "REJECTED") {
        riderUpdates.isApproved = false
      }
    }

    if (isSuspended !== undefined) riderUpdates.isSuspended = Boolean(isSuspended)
    if (isApproved !== undefined) riderUpdates.isApproved = Boolean(isApproved)
    if (adminFeedback !== undefined) riderUpdates.adminFeedback = adminFeedback
    if (adminNotes !== undefined) riderUpdates.adminNotes = adminNotes
    if (selectedZones !== undefined) riderUpdates.selectedZones = selectedZones
    if (selectedLocations !== undefined) riderUpdates.selectedLocations = selectedLocations
    if (vehicleTypes !== undefined) riderUpdates.vehicleTypes = vehicleTypes
    if (vehicleName !== undefined) riderUpdates.vehicleName = vehicleName ? String(vehicleName).trim() : null
    if (vehicleNumber !== undefined) riderUpdates.vehicleNumber = vehicleNumber
    if (drivingLicenseNo !== undefined) riderUpdates.drivingLicenseNo = drivingLicenseNo

    const updatedRider = await prisma.rider.update({
      where: { userId: id },
      data: riderUpdates,
    })

    return NextResponse.json({
      success: true,
      message: "Rider updated successfully.",
      rider: updatedRider,
    })
  } catch (error) {
    console.error("Admin update rider error:", error)
    return NextResponse.json({ error: "Failed to update rider." }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: "Rider account deleted successfully.",
    })
  } catch (error) {
    console.error("Admin delete rider error:", error)
    return NextResponse.json({ error: "Failed to delete rider." }, { status: 500 })
  }
}
