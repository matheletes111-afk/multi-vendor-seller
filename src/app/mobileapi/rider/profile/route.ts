import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "@/app/mobileapi/_helpers/rider-auth"
import { prisma } from "@/lib/prisma"
import { validateAndFormatPaymentDetails } from "@/lib/payment-details-helper"

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
      email,
      phone,
      phoneCountryCode,
      profileImage,
      vehicleType,
      vehicleTypes,
      vehicleName,
      vehicleNumber,
      drivingLicenseNo,
      selectedZones,
      selectedLocations,
      isOnline,
      paymentOption,
      bankName,
      accountHolderName,
      accountNumber,
      bbanNumber,
      branchName,
      bankAddress,
      mobileNumber,
      agentNumber,
    } = body

    const userUpdates: {
      name?: string
      email?: string | null
      phone?: string | null
      phoneCountryCode?: string | null
      image?: string | null
    } = {}

    if (email !== undefined) {
      const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
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
    if (isOnline !== undefined) {
      riderUpdates.isOnline = Boolean(isOnline)
      riderUpdates.lastLocationUpdate = new Date()
    }
    if (vehicleType !== undefined) {
      riderUpdates.vehicleTypes = [String(vehicleType).trim()]
    } else if (vehicleTypes !== undefined) {
      riderUpdates.vehicleTypes = Array.isArray(vehicleTypes) ? vehicleTypes.slice(0, 1) : [String(vehicleTypes)]
    }
    if (vehicleName !== undefined) riderUpdates.vehicleName = vehicleName ? String(vehicleName).trim() : null
    if (vehicleNumber !== undefined) riderUpdates.vehicleNumber = vehicleNumber ? String(vehicleNumber).trim() : null
    if (drivingLicenseNo !== undefined) riderUpdates.drivingLicenseNo = drivingLicenseNo ? String(drivingLicenseNo).trim() : null
    if (profileImage !== undefined) riderUpdates.profileImage = profileImage || null
    if (selectedZones !== undefined) riderUpdates.selectedZones = selectedZones
    if (selectedLocations !== undefined) riderUpdates.selectedLocations = selectedLocations

    const hasPaymentField =
      paymentOption !== undefined ||
      bankName !== undefined ||
      accountHolderName !== undefined ||
      accountNumber !== undefined ||
      bbanNumber !== undefined ||
      branchName !== undefined ||
      bankAddress !== undefined ||
      mobileNumber !== undefined ||
      agentNumber !== undefined

    if (hasPaymentField) {
      const parsedPayment = validateAndFormatPaymentDetails(
        {
          paymentOption: paymentOption ?? authResult.rider?.paymentOption ?? "Bank",
          bankName: bankName !== undefined ? bankName : authResult.rider?.bankName,
          accountHolderName: accountHolderName !== undefined ? accountHolderName : authResult.rider?.accountHolderName,
          accountNumber: accountNumber !== undefined ? accountNumber : authResult.rider?.accountNumber,
          bbanNumber: bbanNumber !== undefined ? bbanNumber : authResult.rider?.bbanNumber,
          branchName: branchName !== undefined ? branchName : authResult.rider?.branchName,
          bankAddress: bankAddress !== undefined ? bankAddress : authResult.rider?.bankAddress,
          mobileNumber: mobileNumber !== undefined ? mobileNumber : authResult.rider?.mobileNumber,
          agentNumber: agentNumber !== undefined ? agentNumber : authResult.rider?.agentNumber,
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
