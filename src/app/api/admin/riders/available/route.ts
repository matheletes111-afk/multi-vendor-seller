import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { determineRequiredVehicleForItems, VehicleMatchResult } from "@/lib/ai-vehicle-matcher"

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

    const riders = await prisma.rider.findMany({
      where: {
        isApproved: true,
        isSuspended: false,
        status: "APPROVED",
        ...(includeOffline ? {} : { isOnline: true }),
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
