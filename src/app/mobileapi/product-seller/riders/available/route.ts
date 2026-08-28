import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileSellerAuth } from "../../../_helpers/seller-auth"
import { determineRequiredVehicleForItems, VehicleMatchResult } from "@/lib/ai-vehicle-matcher"

export async function GET(request: NextRequest) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const zone = searchParams.get("zone")?.trim()
    const orderId = searchParams.get("orderId")?.trim()

    const seller = await prisma.seller.findUnique({
      where: { userId: authStatus.userId },
      select: { id: true },
    })

    let aiVehicleRecommendation: VehicleMatchResult | null = null

    if (orderId && seller) {
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          items: { some: { sellerId: seller.id, productId: { not: null } } },
        },
        include: {
          items: {
            where: { sellerId: seller.id, productId: { not: null } },
            include: {
              product: { select: { name: true } },
              productVariant: { select: { name: true, weight: true, height: true, width: true, depth: true } },
            },
          },
        },
      })
      if (order && order.items.length > 0) {
        aiVehicleRecommendation = await determineRequiredVehicleForItems(order.items)
      }
    }

    const riders = await prisma.rider.findMany({
      where: {
        isApproved: true,
        isSuspended: false,
        status: "APPROVED",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            phoneCountryCode: true,
            image: true,
          },
        },
        deliveryAssignments: {
          where: {
            status: { in: ["ACCEPTED", "AT_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"] },
          },
          select: { id: true, status: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    const availableRiders = riders.map((r) => {
      const isBusy = r.deliveryAssignments.length > 0
      const riderTypes = Array.isArray(r.vehicleTypes) ? (r.vehicleTypes as string[]) : []
      const isVehicleMatch =
        !aiVehicleRecommendation ||
        riderTypes.length === 0 ||
        riderTypes.some((t) => aiVehicleRecommendation!.compatibleVehicles.includes(t as any))

      return {
        id: r.id,
        userId: r.userId,
        name: r.user?.name || "Rider",
        email: r.user?.email,
        phone: r.user?.phone,
        phoneCountryCode: r.user?.phoneCountryCode || "+232",
        image: r.user?.image || r.profileImage,
        vehicleName: r.vehicleName,
        vehicleNumber: r.vehicleNumber,
        drivingLicenseNo: r.drivingLicenseNo,
        vehicleTypes: riderTypes,
        isVehicleMatch,
        isOnline: r.isOnline,
        isBusy,
        selectedZones: r.selectedZones,
        selectedLocations: r.selectedLocations,
        currentLatitude: r.currentLatitude,
        currentLongitude: r.currentLongitude,
        lastLocationUpdate: r.lastLocationUpdate,
      }
    })

    return NextResponse.json({
      success: true,
      data: availableRiders,
      aiVehicleRecommendation,
    })
  } catch (error: any) {
    console.error("[Mobile API] Seller fetch available riders error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch available riders" },
      { status: 500 }
    )
  }
}
