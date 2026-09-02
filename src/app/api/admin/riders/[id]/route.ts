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
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id }, { rider: { id } }],
      },
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

import bcrypt from "bcryptjs"
import { uploadPublicFile } from "@/lib/upload-public-file"

async function resolveDocUrl(
  val: string | null | undefined,
  folder: string,
  prefix: string
): Promise<string | null | undefined> {
  if (val === undefined) return undefined
  if (!val || val.trim() === "") return null
  const trimmed = val.trim()
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }
  if (trimmed.startsWith("data:")) {
    const matches = trimmed.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/)
    if (matches && matches.length === 3) {
      const mimeType = matches[1]
      const buffer = Buffer.from(matches[2], "base64")
      const ext = mimeType.includes("pdf") ? ".pdf" : mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg"
      return await uploadPublicFile({
        folder,
        ext,
        contentType: mimeType,
        buffer,
        prefix,
      })
    }
  }
  return trimmed
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
      email,
      phone,
      phoneCountryCode,
      password,
      status,
      isSuspended,
      isApproved,
      onboardingCompleted,
      isFirstLogin,
      adminFeedback,
      adminNotes,
      selectedZones,
      selectedLocations,
      vehicleTypes,
      vehicleName,
      vehicleNumber,
      drivingLicenseNo,
      nationalIdDoc,
      drivingLicenseDoc,
      vehicleInsuranceDoc,
      profileImage,
    } = body

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id }, { rider: { id } }],
      },
      include: { rider: true },
    })

    if (!user || !user.rider) {
      return NextResponse.json({ error: "Rider not found" }, { status: 404 })
    }

    // User updates
    const userUpdates: any = {}
    if (name !== undefined) userUpdates.name = name?.trim() || null
    if (email !== undefined && email.trim() !== "") {
      const cleanEmail = email.toLowerCase().trim()
      if (cleanEmail !== user.email) {
        const existingEmail = await prisma.user.findUnique({ where: { email: cleanEmail } })
        if (existingEmail) {
          return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 })
        }
        userUpdates.email = cleanEmail
      }
    }
    if (password && typeof password === "string" && password.trim().length >= 6) {
      userUpdates.password = await bcrypt.hash(password.trim(), 10)
      userUpdates.verifyEmailOtp = null
    }
    if (phone !== undefined && phoneCountryCode !== undefined) {
      if (phone && phoneCountryCode) {
        const phoneValidation = validatePhoneAndCountryCode(phone, phoneCountryCode)
        if (!phoneValidation.isValid) {
          return NextResponse.json(
            { error: phoneValidation.error || "Invalid mobile number or country code." },
            { status: 400 }
          )
        }
        userUpdates.phone = phoneValidation.cleanedPhone
        userUpdates.phoneCountryCode = phoneValidation.cleanedCountryCode
      } else {
        userUpdates.phone = phone || null
        userUpdates.phoneCountryCode = phoneCountryCode || null
      }
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
    if (onboardingCompleted !== undefined) riderUpdates.onboardingCompleted = Boolean(onboardingCompleted)
    if (isFirstLogin !== undefined) riderUpdates.isFirstLogin = Boolean(isFirstLogin)
    if (adminFeedback !== undefined) riderUpdates.adminFeedback = adminFeedback
    if (adminNotes !== undefined) riderUpdates.adminNotes = adminNotes
    if (selectedZones !== undefined) riderUpdates.selectedZones = selectedZones
    if (selectedLocations !== undefined) riderUpdates.selectedLocations = selectedLocations
    if (vehicleTypes !== undefined) riderUpdates.vehicleTypes = vehicleTypes
    if (vehicleName !== undefined) riderUpdates.vehicleName = vehicleName ? String(vehicleName).trim() : null
    if (vehicleNumber !== undefined) riderUpdates.vehicleNumber = vehicleNumber
    if (drivingLicenseNo !== undefined) riderUpdates.drivingLicenseNo = drivingLicenseNo

    // Document & Image Updates
    if (profileImage !== undefined) {
      const resolvedProfile = await resolveDocUrl(profileImage, "riders/profiles", `pfp-${user.id.slice(0, 8)}`)
      riderUpdates.profileImage = resolvedProfile
      userUpdates.image = resolvedProfile
    }
    if (nationalIdDoc !== undefined) {
      riderUpdates.nationalIdDoc = await resolveDocUrl(nationalIdDoc, "riders/docs", `nid-${user.id.slice(0, 8)}`)
    }
    if (drivingLicenseDoc !== undefined) {
      riderUpdates.drivingLicenseDoc = await resolveDocUrl(drivingLicenseDoc, "riders/docs", `dl-${user.id.slice(0, 8)}`)
    }
    if (vehicleInsuranceDoc !== undefined) {
      riderUpdates.vehicleInsuranceDoc = await resolveDocUrl(vehicleInsuranceDoc, "riders/docs", `ins-${user.id.slice(0, 8)}`)
    }

    if (Object.keys(userUpdates).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: userUpdates,
      })
    }

    const updatedRider = await prisma.rider.update({
      where: { userId: user.id },
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

