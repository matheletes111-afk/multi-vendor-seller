import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"

export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileCustomerAuth(request)
    if (authResult.ok && authResult.userId) {
      const userAddr = await prisma.userAddress.findFirst({
        where: { userId: authResult.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      })

      if (userAddr) {
        return NextResponse.json({
          success: true,
          data: {
            id: userAddr.id,
            label: `Deliver to ${userAddr.addressType === "HOME" ? "Home" : userAddr.addressType === "OFFICE" ? "Office" : "Location"} - ${userAddr.addressLine1}`,
            street: userAddr.addressLine1,
            city: userAddr.city,
            state: userAddr.state,
            postalCode: userAddr.postalCode,
            country: userAddr.country,
            latitude: userAddr.latitude ?? null,
            longitude: userAddr.longitude ?? null,
            is_default: userAddr.isDefault,
            is_guest_fallback: false,
          },
        })
      }
    }

    // Default guest location fallback
    return NextResponse.json({
      success: true,
      data: {
        id: "guest_default",
        label: "Deliver to Silicon Oasis",
        street: "Silicon Oasis",
        city: "Dubai",
        state: "Dubai",
        postalCode: "00000",
        country: "UAE",
        is_default: true,
        is_guest_fallback: true,
      },
    })
  } catch (error) {
    console.error("Active delivery address API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
