import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const zone = searchParams.get("zone")?.trim()
    const statusParam = searchParams.get("status")?.trim() // "ALL" | "FREE" | "ON_DELIVERY" | "OFFLINE"
    const search = searchParams.get("search")?.trim()

    // Fetch all active/registered riders with their active delivery assignments and user profile
    // Only fully onboarded riders are eligible for live tracking & delivery dispatches
    const riders = await prisma.rider.findMany({
      where: {
        isApproved: true,
        isSuspended: false,
        status: "APPROVED",
        onboardingCompleted: true,
        ...(search
          ? {
              OR: [
                { user: { name: { contains: search, mode: "insensitive" } } },
                { user: { email: { contains: search, mode: "insensitive" } } },
                { user: { phone: { contains: search, mode: "insensitive" } } },
                { vehicleNumber: { contains: search, mode: "insensitive" } },
                { vehicleName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
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
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                shippingAddress: true,
                shippingCity: true,
                shippingAddressLine1: true,
                seller: {
                  include: {
                    store: true,
                    businessInfo: true,
                  },
                },
              },
            },
          },
          orderBy: { offeredAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastLocationUpdate: "desc" },
    })

    const formattedRiders = riders.map((r: any) => {
      const activeAssignment = r.deliveryAssignments?.[0] || null
      const isBusy = !!activeAssignment

      // Determine operational status
      // A rider is active on the live fleet map if r.isOnline is true AND:
      // 1) They have an ongoing active delivery assignment (isBusy -> ON_DELIVERY)
      // 2) OR their GPS heartbeat was transmitted within the last 10 minutes (-> FREE)
      // If a rider hasn't reported location for >10 mins without an active order, they are treated as OFFLINE.
      const nowMs = Date.now()
      const lastUpdateMs = r.lastLocationUpdate ? new Date(r.lastLocationUpdate).getTime() : 0
      const isLocationRecent = lastUpdateMs > 0 && (nowMs - lastUpdateMs) < 10 * 60 * 1000 // 10 minutes

      let operationalStatus: "FREE" | "ON_DELIVERY" | "OFFLINE" = "OFFLINE"
      if (r.isOnline) {
        if (isBusy) {
          operationalStatus = "ON_DELIVERY"
        } else if (isLocationRecent) {
          operationalStatus = "FREE"
        } else {
          operationalStatus = "OFFLINE"
        }
      } else {
        operationalStatus = "OFFLINE"
      }

      // Resolve primary vehicle type
      const vehicleTypesList = Array.isArray(r.vehicleTypes) ? (r.vehicleTypes as string[]) : []
      const primaryVehicleType = vehicleTypesList[0] || "2_WHEELER"

      const sellerObj = activeAssignment?.order?.seller
      const sellerStoreName =
        sellerObj?.store?.name ||
        sellerObj?.businessInfo?.companyName ||
        "Store"

      const sellerAddress =
        sellerObj?.store?.address ||
        sellerObj?.businessInfo?.address ||
        null

      return {
        id: r.id,
        userId: r.userId,
        name: r.user?.name || "Rider",
        email: r.user?.email || "",
        phone: r.user?.phone || null,
        phoneCountryCode: r.user?.phoneCountryCode || "+232",
        profileImage: r.profileImage || r.user?.image || null,
        vehicleTypes: vehicleTypesList,
        primaryVehicleType,
        vehicleName: r.vehicleName || null,
        vehicleNumber: r.vehicleNumber || null,
        drivingLicenseNo: r.drivingLicenseNo || null,
        selectedZones: Array.isArray(r.selectedZones) ? (r.selectedZones as string[]) : [],
        selectedLocations: Array.isArray(r.selectedLocations) ? (r.selectedLocations as string[]) : [],
        isOnline: r.isOnline && (isLocationRecent || isBusy),
        rawIsOnline: r.isOnline,
        onboardingCompleted: Boolean(r.onboardingCompleted),
        deviceTokensCount: Array.isArray(r.deviceTokens) ? r.deviceTokens.length : 0,
        devices: Array.isArray(r.deviceTokens)
          ? (r.deviceTokens as any[]).map((d) => {
              if (typeof d === "string") {
                return {
                  platform: "mobile",
                  deviceModel: null,
                  userAgent: null,
                  deviceId: null,
                  lastActiveAt: null,
                }
              }
              return {
                platform: d?.platform || "mobile",
                deviceModel: d?.deviceModel || null,
                userAgent: d?.userAgent || null,
                deviceId: d?.deviceId || null,
                isActiveDriver: Boolean(d?.isActiveDriver),
                lastActiveAt: d?.lastActiveAt || d?.createdAt || null,
              }
            })
          : [],
        activeDeviceId: (Array.isArray(r.deviceTokens)
          ? (r.deviceTokens as any[]).find((d) => d?.isActiveDriver)?.deviceId
          : null) || null,
        operationalStatus,
        telemetry: {
          latitude: r.currentLatitude,
          longitude: r.currentLongitude,
          heading: r.heading || 0,
          speed: r.speed || 0,
          lastLocationUpdate: r.lastLocationUpdate,
          isRecent: isLocationRecent,
        },
        activeDelivery: activeAssignment
          ? {
              assignmentId: activeAssignment.id,
              assignmentStatus: activeAssignment.status,
              orderId: activeAssignment.order?.id,
              orderNumber: activeAssignment.order?.orderNumber,
              orderStatus: activeAssignment.order?.status,
              sellerName: sellerStoreName,
              sellerAddress: sellerAddress,
              sellerLat: activeAssignment.sellerLatitude || null,
              sellerLng: activeAssignment.sellerLongitude || null,
              customerAddress:
                activeAssignment.order?.shippingAddressLine1 ||
                (activeAssignment.order?.shippingAddress as any)?.addressLine1 ||
                null,
              customerCity:
                activeAssignment.order?.shippingCity ||
                (activeAssignment.order?.shippingAddress as any)?.city ||
                null,
            }
          : null,
      }
    })

    // Filter by Zone if specified
    let result = formattedRiders
    if (zone && zone !== "ALL") {
      result = result.filter((r) => r.selectedZones.includes(zone))
    }

    // Filter by operational status if specified
    if (statusParam && statusParam !== "ALL") {
      result = result.filter((r) => r.operationalStatus === statusParam)
    }

    // Aggregated statistics for top dashboard pills
    const stats = {
      total: formattedRiders.length,
      free: formattedRiders.filter((r) => r.operationalStatus === "FREE").length,
      onDelivery: formattedRiders.filter((r) => r.operationalStatus === "ON_DELIVERY").length,
      offline: formattedRiders.filter((r) => r.operationalStatus === "OFFLINE").length,
      withGps: formattedRiders.filter((r) => r.telemetry.latitude != null && r.telemetry.longitude != null).length,
    }

    // Count pending onboarding riders for admin awareness
    const pendingOnboardingCount = await prisma.rider.count({
      where: {
        isApproved: true,
        isSuspended: false,
        status: "APPROVED",
        onboardingCompleted: false,
      },
    })

    return NextResponse.json({
      success: true,
      stats,
      pendingOnboardingCount,
      riders: result,
    })
  } catch (error: any) {
    console.error("[API] Admin live tracking error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to load live tracking data" },
      { status: 500 }
    )
  }
}
