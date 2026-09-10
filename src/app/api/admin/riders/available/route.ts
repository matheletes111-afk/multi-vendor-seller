import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { determineRequiredVehicleForItems, VehicleMatchResult, isRiderVehicleCompatible } from "@/lib/ai-vehicle-matcher"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const zone = searchParams.get("zone")?.trim()
    const orderId = searchParams.get("orderId")?.trim()
    const sellerId = searchParams.get("sellerId")?.trim()

    let aiVehicleRecommendation: VehicleMatchResult | null = null

    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            where: {
              productId: { not: null },
              ...(sellerId ? { sellerId } : {}),
            },
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

    const includeOffline = searchParams.get("includeOffline") === "true"
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

    const riders = await prisma.rider.findMany({
      where: {
        isApproved: true,
        isSuspended: false,
        status: "APPROVED",
        onboardingCompleted: true,
        ...(includeOffline ? {} : { isOnline: true, lastLocationUpdate: { gte: tenMinutesAgo } }),
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
      const isVehicleMatch =
        !aiVehicleRecommendation ||
        isRiderVehicleCompatible(r.vehicleTypes, aiVehicleRecommendation.compatibleVehicles)

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
        isVehicleMatch,
        isOnline: Boolean(
          r.isOnline &&
          r.lastLocationUpdate &&
          (Date.now() - new Date(r.lastLocationUpdate).getTime()) < 10 * 60 * 1000
        ),
        isBusy,
        selectedZones: r.selectedZones,
        selectedLocations: r.selectedLocations,
        currentLatitude: r.currentLatitude,
        currentLongitude: r.currentLongitude,
        lastLocationUpdate: r.lastLocationUpdate,
        deviceTokens: r.deviceTokens,
        deviceTokensCount: Array.isArray(r.deviceTokens) ? r.deviceTokens.length : 0,
      }
    })

    return NextResponse.json({
      success: true,
      riders: availableRiders,
      aiVehicleRecommendation,
    })
  } catch (error: any) {
    console.error("[API] Available riders fetch error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch available riders" },
      { status: 500 }
    )
  }
}
