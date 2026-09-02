import { prisma } from "./prisma"
import { calculateHaversineDistance, sortByProximity } from "./haversine-distance"
import { sendDeliveryOfferToRider, sendPushNotification } from "./firebase-messaging"
import { sendEmail } from "./email"
import { sendDeliveryOtp } from "./delivery-otp"
import { applySellerCreditForOrderLineDelivered } from "./seller-order-line-settlement"
import { determineRequiredVehicleForItems } from "./ai-vehicle-matcher"
import { DeliveryAssignmentStatus, DispatchMode, OrderStatus } from "@prisma/client"

const OFFER_TIMEOUT_SECONDS = 60
const NO_SHOW_TIMEOUT_MINUTES = 30

/**
 * Initiates the Cascading Waterfall Auto-Dispatch for a Product Order.
 * Supports multi-vendor orders: dispatches separate riders per distinct physical seller.
 */
export async function triggerOrderAutoDispatch(orderId: string, targetSellerId?: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        seller: {
          include: {
            businessInfo: true,
            store: true,
            user: true,
          },
        },
        items: {
          where: { productId: { not: null } },
          include: {
            product: { select: { name: true } },
            productVariant: { select: { name: true, weight: true, height: true, width: true, depth: true } },
            seller: {
              include: {
                businessInfo: true,
                store: true,
                user: true,
              },
            },
          },
        },
        deliveryAssignments: {
          orderBy: { attemptNumber: "desc" },
        },
      },
    })

    if (!order) {
      console.error(`[Dispatch] Order not found: ${orderId}`)
      return { success: false, message: "Order not found" }
    }

    // Determine all distinct physical sellers for this order
    const sellerIds = targetSellerId
      ? [targetSellerId]
      : [...new Set(order.items.map((i) => i.sellerId).filter((s): s is string => !!s))]

    if (sellerIds.length === 0 && order.sellerId) {
      sellerIds.push(order.sellerId)
    }

    if (sellerIds.length === 0) {
      return { success: false, message: "Order has no physical product sellers to dispatch" }
    }

    const results: any[] = []

    for (const sellerId of sellerIds) {
      // Check if there is already an active accepted or in-progress assignment for this seller (Live DB query to prevent race conditions)
      const activeAssignment = await prisma.riderDeliveryAssignment.findFirst({
        where: {
          orderId: order.id,
          sellerId: sellerId,
          status: {
            in: [
              DeliveryAssignmentStatus.ACCEPTED,
              DeliveryAssignmentStatus.AT_PICKUP,
              DeliveryAssignmentStatus.PICKED_UP,
              DeliveryAssignmentStatus.OUT_FOR_DELIVERY,
              DeliveryAssignmentStatus.OFFERED,
            ],
          },
        },
      })

      if (activeAssignment) {
        results.push({
          sellerId,
          success: false,
          message: `Seller package already has active assignment: ${activeAssignment.id} (${activeAssignment.status})`,
        })
        continue
      }

      // Determine Seller coordinates (Shop location)
      const sellerInfo =
        order.items.find((i) => i.sellerId === sellerId)?.seller ||
        (order.sellerId === sellerId ? order.seller : null) ||
        (await prisma.seller.findUnique({
          where: { id: sellerId },
          include: { businessInfo: true, store: true, user: true },
        }))

      const sellerLat = sellerInfo?.businessInfo?.latitude || null
      const sellerLng = sellerInfo?.businessInfo?.longitude || null

      // List of riders already offered/attempted for this seller on this order (Live DB query — stale cache causes infinite re-dispatch to same rider)
      const previousAssignments = await prisma.riderDeliveryAssignment.findMany({
        where: {
          orderId: order.id,
          sellerId: sellerId,
          status: { in: ["REJECTED", "TIMED_OUT", "CANCELLED_BY_RIDER"] },
        },
        select: { riderId: true },
      })
      const previousRiderIds = previousAssignments.map((a) => a.riderId)

      // Match customer delivery location name or zone
      const customerLocation = (order.shippingCity || order.shippingAddressLine1 || "").trim()

      // 1 Rider = 1 Delivery Rule: Find all online, approved, idle riders
      const freeRiders = await prisma.rider.findMany({
        where: {
          isApproved: true,
          isSuspended: false,
          isOnline: true,
          status: "APPROVED",
          id: { notIn: previousRiderIds },
          deliveryAssignments: {
            none: {
              status: { in: ["ACCEPTED", "AT_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"] },
            },
          },
        },
        include: {
          user: true,
        },
      })

      if (freeRiders.length === 0) {
        console.log(`[Dispatch] No free candidates for order #${order.orderNumber} (Seller: ${sellerId}).`)
        results.push({
          sellerId,
          success: false,
          message: "No available free riders found in the area",
          candidatesCount: 0,
        })
        continue
      }

      // AI-Driven Vehicle Type Classification for this seller's package
      const sellerItems = order.items.filter((i) => i.sellerId === sellerId)
      const vehicleMatch = await determineRequiredVehicleForItems(sellerItems)
      console.log(
        `[Dispatch] Package for Seller ${sellerId} AI Vehicle Match: ${vehicleMatch.requiredVehicle} (${vehicleMatch.reason})`
      )

      // Filter by zone/location match if rider specified selectedLocations
      let eligibleRiders = freeRiders.filter((rider) => {
        if (!customerLocation) return true
        if (!rider.selectedLocations) return true

        const locs = Array.isArray(rider.selectedLocations)
          ? (rider.selectedLocations as string[])
          : []
        if (locs.length === 0) return true // Covers all zones

        return locs.some(
          (loc) =>
            customerLocation.toLowerCase().includes(loc.toLowerCase()) ||
            loc.toLowerCase().includes(customerLocation.toLowerCase())
        )
      })

      if (eligibleRiders.length === 0) {
        eligibleRiders = freeRiders
      }

      // Filter candidates by required vehicle compatibility
      const vehicleMatchedRiders = eligibleRiders.filter((rider) => {
        const types = Array.isArray(rider.vehicleTypes) ? (rider.vehicleTypes as string[]) : []
        if (types.length === 0) return true // Legacy riders without specified vehicle types
        return types.some((t) => vehicleMatch.compatibleVehicles.includes(t as any))
      })

      if (vehicleMatchedRiders.length === 0) {
        console.log(
          `[Dispatch] No vehicle-compatible riders for Seller ${sellerId} (Required: ${vehicleMatch.requiredVehicle}, Compatible: ${vehicleMatch.compatibleVehicles.join(", ")}).`
        )
        results.push({
          sellerId,
          success: false,
          message: `No ${vehicleMatch.requiredVehicle}-compatible riders available in zone (requires ${vehicleMatch.compatibleVehicles.join(" or ")}). Waiting for suitable rider.`,
          requiredVehicle: vehicleMatch.requiredVehicle,
          compatibleVehicles: vehicleMatch.compatibleVehicles,
          candidatesCount: 0,
        })
        continue
      }

      const finalCandidates = vehicleMatchedRiders

      // Rank candidates by distance from Seller Shop (if GPS available)
      let rankedCandidates: any[] = []

      if (sellerLat != null && sellerLng != null) {
        const targetCoord = { latitude: sellerLat, longitude: sellerLng }
        const withGps = finalCandidates.filter(
          (r) => r.currentLatitude != null && r.currentLongitude != null
        )
        const withoutGps = finalCandidates.filter(
          (r) => r.currentLatitude == null || r.currentLongitude == null
        )

        const sortedWithGps = sortByProximity(targetCoord, withGps)
        rankedCandidates = [...sortedWithGps, ...withoutGps]
      } else {
        rankedCandidates = finalCandidates
      }

      const selectedRider = rankedCandidates[0]
      if (!selectedRider) {
        results.push({ sellerId, success: false, message: "No candidate selected" })
        continue
      }

      const attemptNumber =
        order.deliveryAssignments.filter((a) => a.sellerId === sellerId).length + 1
      const distanceKm = (selectedRider as any).distanceKm || null

      // Create the OFFERED assignment
      const expiresAt = new Date(Date.now() + OFFER_TIMEOUT_SECONDS * 1000)

      const assignment = await prisma.riderDeliveryAssignment.create({
        data: {
          orderId: order.id,
          riderId: selectedRider.id,
          sellerId: sellerId,
          status: DeliveryAssignmentStatus.OFFERED,
          dispatchMode: DispatchMode.AUTO_CASCADE,
          attemptNumber,
          sellerLatitude: sellerLat,
          sellerLongitude: sellerLng,
          riderLatitudeAtOffer: selectedRider.currentLatitude,
          riderLongitudeAtOffer: selectedRider.currentLongitude,
          distanceKm,
          expiresAt,
        },
      })

      // Send high-priority Push Notification to selected Rider
      const shopName =
        sellerInfo?.store?.name ||
        sellerInfo?.businessInfo?.businessName ||
        "Seller Store"

      await sendDeliveryOfferToRider(selectedRider, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        assignmentId: assignment.id,
        shopName,
        shopDistanceKm: distanceKm || undefined,
        customerZone: customerLocation || undefined,
        timeoutSeconds: OFFER_TIMEOUT_SECONDS,
      })

      console.log(
        `[Dispatch] Offer sent to Rider ${selectedRider.user?.name || selectedRider.id} (Attempt #${attemptNumber}) for Order #${order.orderNumber} (Seller: ${shopName})`
      )

      results.push({
        sellerId,
        success: true,
        assignmentId: assignment.id,
        riderId: selectedRider.id,
        attemptNumber,
        expiresAt,
      })
    }

    return results.length === 1 ? results[0] : { success: true, dispatches: results }
  } catch (error: any) {
    console.error("[Dispatch] Error in triggerOrderAutoDispatch:", error)
    return { success: false, message: error?.message || "Internal dispatch error" }
  }
}

/**
 * Handles Rider Accepting a Delivery Assignment.
 */
export async function handleRiderAcceptAssignment(
  assignmentId: string,
  riderId: string
) {
  try {
    const txResult = await prisma.$transaction(async (tx) => {
      const assignment = await tx.riderDeliveryAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          seller: {
            include: {
              businessInfo: true,
              store: true,
              user: true,
            },
          },
          order: {
            include: {
              seller: { include: { businessInfo: true, store: true, user: true } },
              customer: true,
            },
          },
          rider: { include: { user: true } },
        },
      })

      if (!assignment) {
        return { success: false, error: "Assignment not found" }
      }

      if (assignment.riderId !== riderId) {
        return { success: false, error: "Unauthorized assignment" }
      }

      if (assignment.status !== DeliveryAssignmentStatus.OFFERED) {
        return {
          success: false,
          error: `Assignment is no longer available (Status: ${assignment.status})`,
        }
      }

      // Check 60-second offer timeout
      if (assignment.expiresAt && assignment.expiresAt < new Date()) {
        await tx.riderDeliveryAssignment.update({
          where: { id: assignmentId },
          data: { status: DeliveryAssignmentStatus.TIMED_OUT },
        })
        return {
          success: false,
          error: "Offer expired (60s limit reached)",
          isExpired: true,
          orderId: assignment.orderId,
          sellerId: assignment.sellerId,
        }
      }

      // Concurrency Guard: Check if another rider already claimed/accepted this seller package
      const alreadyClaimed = await tx.riderDeliveryAssignment.findFirst({
        where: {
          orderId: assignment.orderId,
          sellerId: assignment.sellerId,
          status: {
            in: [
              DeliveryAssignmentStatus.ACCEPTED,
              DeliveryAssignmentStatus.AT_PICKUP,
              DeliveryAssignmentStatus.PICKED_UP,
              DeliveryAssignmentStatus.OUT_FOR_DELIVERY,
              DeliveryAssignmentStatus.DELIVERED,
            ],
          },
          id: { not: assignmentId },
        },
      })

      if (alreadyClaimed) {
        await tx.riderDeliveryAssignment.update({
          where: { id: assignmentId },
          data: { status: DeliveryAssignmentStatus.TIMED_OUT },
        })
        return {
          success: false,
          error: "This delivery order has already been accepted by another rider.",
        }
      }

      // Generate 6-digit Customer Delivery OTP
      const deliveryOtp = Math.floor(100000 + Math.random() * 900000).toString()

      const updatedAssignment = await tx.riderDeliveryAssignment.update({
        where: { id: assignmentId },
        data: {
          status: DeliveryAssignmentStatus.ACCEPTED,
          acceptedAt: new Date(),
          deliveryOtp,
        },
      })

      // Invalidate all other lingering OFFERED assignments for this specific seller package
      await tx.riderDeliveryAssignment.updateMany({
        where: {
          orderId: assignment.orderId,
          sellerId: assignment.sellerId,
          id: { not: assignmentId },
          status: DeliveryAssignmentStatus.OFFERED,
        },
        data: { status: DeliveryAssignmentStatus.TIMED_OUT },
      })

      // Sync order status to PROCESSING if currently PENDING or CONFIRMED
      if (assignment.order.status === OrderStatus.PENDING || assignment.order.status === OrderStatus.CONFIRMED) {
        await tx.order.update({
          where: { id: assignment.orderId },
          data: { status: OrderStatus.PROCESSING },
        })
      }

      return {
        success: true,
        assignment: updatedAssignment,
        deliveryOtp,
        order: assignment.order,
        seller: assignment.seller,
        rider: assignment.rider,
      }
    })

    if (!txResult.success) {
      if ((txResult as any).isExpired) {
        triggerOrderAutoDispatch((txResult as any).orderId, (txResult as any).sellerId || undefined)
      }
      return { success: false, message: (txResult as any).error }
    }

    // Notify seller via email that rider has accepted pickup (outside transaction)
    const targetSellerUser = txResult.seller?.user || txResult.order?.seller?.user
    if (targetSellerUser?.email) {
      const riderName = txResult.rider?.user?.name || "A delivery rider"
      sendEmail({
        to: targetSellerUser.email,
        subject: `Rider Assigned for Order #${txResult.order?.orderNumber}`,
        text: `Rider ${riderName} has accepted delivery for Order #${txResult.order?.orderNumber} and is heading to your store.`,
      }).catch(() => null)
    }

    console.log(
      `[Dispatch] Rider ${txResult.rider?.user?.name} ACCEPTED delivery for Order #${txResult.order?.orderNumber}`
    )

    return {
      success: true,
      assignment: txResult.assignment,
      deliveryOtp: txResult.deliveryOtp,
    }
  } catch (error: any) {
    console.error("[Dispatch] Concurrency error in handleRiderAcceptAssignment:", error)
    return { success: false, message: error?.message || "Failed to accept assignment" }
  }
}

/**
 * Handles Rider Rejecting a Delivery Assignment (Cascades to next candidate).
 */
export async function handleRiderRejectAssignment(
  assignmentId: string,
  riderId: string,
  reason?: string
) {
  const assignment = await prisma.riderDeliveryAssignment.findUnique({
    where: { id: assignmentId },
  })

  if (!assignment || assignment.riderId !== riderId) {
    return { success: false, message: "Assignment not found or unauthorized" }
  }

  await prisma.riderDeliveryAssignment.update({
    where: { id: assignmentId },
    data: {
      status: DeliveryAssignmentStatus.REJECTED,
      cancellationReason: reason || "Rejected by rider",
      cancelledAt: new Date(),
    },
  })

  console.log(`[Dispatch] Rider ${riderId} REJECTED assignment ${assignmentId} for seller ${assignment.sellerId}. Cascading...`)

  // Automatically cascade to next closest free rider for this specific seller!
  const cascadeResult = await triggerOrderAutoDispatch(assignment.orderId, assignment.sellerId || undefined)
  return { success: true, cascaded: cascadeResult }
}

/**
 * Handles Rider Delivery Milestone Status Updates.
 */
export async function handleRiderStatusUpdate(
  assignmentId: string,
  riderId: string,
  newStatus: DeliveryAssignmentStatus,
  options?: {
    otp?: string
    proofImage?: string
    cancellationReason?: string
  }
) {
  const assignment = await prisma.riderDeliveryAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      seller: {
        include: {
          businessInfo: true,
          store: true,
          user: true,
        },
      },
      order: {
        include: {
          items: true,
          seller: { include: { businessInfo: true, store: true, user: true } },
          customer: true,
        },
      },
      rider: { include: { user: true } },
    },
  })

  if (!assignment || assignment.riderId !== riderId) {
    return { success: false, message: "Assignment not found or unauthorized" }
  }

  const currentStatus = assignment.status

  const itemFilter = assignment.orderItemId
    ? { id: assignment.orderItemId }
    : assignment.sellerId
    ? { orderId: assignment.orderId, sellerId: assignment.sellerId, productId: { not: null } }
    : { orderId: assignment.orderId, productId: { not: null } }

  // Validate state transitions
  switch (newStatus) {
    case DeliveryAssignmentStatus.AT_PICKUP:
      if (currentStatus !== DeliveryAssignmentStatus.ACCEPTED) {
        return { success: false, message: `Cannot move to AT_PICKUP from ${currentStatus}` }
      }
      break

    case DeliveryAssignmentStatus.PICKED_UP:
      if (
        currentStatus !== DeliveryAssignmentStatus.AT_PICKUP &&
        currentStatus !== DeliveryAssignmentStatus.ACCEPTED
      ) {
        return { success: false, message: `Cannot move to PICKED_UP from ${currentStatus}` }
      }
      // Update items for this seller package to SHIPPED
      await prisma.orderItem.updateMany({
        where: itemFilter,
        data: { itemStatus: "SHIPPED" as any },
      })

      // Multi-seller safe parent order status sync
      {
        const allItems = await prisma.orderItem.findMany({
          where: { orderId: assignment.orderId },
          select: { itemStatus: true },
        })
        const allShippedOrBeyond = allItems.every((i) =>
          ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REFUNDED"].includes(i.itemStatus)
        )
        await prisma.order.update({
          where: { id: assignment.orderId },
          data: { status: allShippedOrBeyond ? OrderStatus.SHIPPED : OrderStatus.PROCESSING },
        })
      }
      break

    case DeliveryAssignmentStatus.OUT_FOR_DELIVERY:
      if (currentStatus !== DeliveryAssignmentStatus.PICKED_UP) {
        return { success: false, message: `Cannot move to OUT_FOR_DELIVERY from ${currentStatus}` }
      }
      // Update items for this seller package to OUT_FOR_DELIVERY and synchronize delivery OTP
      await prisma.orderItem.updateMany({
        where: itemFilter,
        data: {
          itemStatus: "OUT_FOR_DELIVERY" as any,
          deliveryOtp: assignment.deliveryOtp || null,
          deliveryOtpExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        } as any,
      })

      // Multi-seller safe parent order status sync
      {
        const allItems = await prisma.orderItem.findMany({
          where: { orderId: assignment.orderId },
          select: { itemStatus: true },
        })
        const allOutOrBeyond = allItems.every((i) =>
          ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REFUNDED"].includes(i.itemStatus)
        )
        const allShippedOrBeyond = allItems.every((i) =>
          ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REFUNDED"].includes(i.itemStatus)
        )
        await prisma.order.update({
          where: { id: assignment.orderId },
          data: {
            status: allOutOrBeyond
              ? OrderStatus.OUT_FOR_DELIVERY
              : allShippedOrBeyond
              ? OrderStatus.SHIPPED
              : OrderStatus.PROCESSING,
          },
        })
      }

      // Send OTP to customer via Email & SMS with seller store name and exact OTP
      if (assignment.order.customer?.email && assignment.deliveryOtp) {
        const storeName =
          assignment.seller?.store?.name ||
          assignment.seller?.businessInfo?.businessName ||
          assignment.order.seller?.store?.name ||
          "Seller Store"

        sendDeliveryOtp({
          toEmail: assignment.order.customer.email,
          toPhone: assignment.order.customer.phone,
          orderNumber: assignment.order.orderNumber,
          customerName: assignment.order.customer.name,
          otp: assignment.deliveryOtp,
          sellerStoreName: storeName,
        }).catch(() => null)
      }
      break

    case DeliveryAssignmentStatus.DELIVERED:
      if (currentStatus !== DeliveryAssignmentStatus.OUT_FOR_DELIVERY) {
        return { success: false, message: `Cannot move to DELIVERED from ${currentStatus}` }
      }
      // Verify OTP if OTP exists
      if (assignment.deliveryOtp) {
        if (!options?.otp || options.otp.trim() !== assignment.deliveryOtp.trim()) {
          return { success: false, message: "Invalid Delivery OTP provided by customer" }
        }
      }

      // Mark OrderItems for this seller, assignment, and settle seller — all in one atomic transaction
      const txResult = await prisma.$transaction(async (tx) => {
        await tx.orderItem.updateMany({
          where: itemFilter,
          data: {
            itemStatus: "DELIVERED" as any,
            deliveredAt: new Date(),
            deliveryProofImage: options?.proofImage || null,
          } as any,
        })
        const updatedAssignment = await tx.riderDeliveryAssignment.update({
          where: { id: assignmentId },
          data: {
            status: newStatus,
            deliveredAt: new Date(),
            deliveryProofImage: options?.proofImage || assignment.deliveryProofImage,
          },
        })
        // Settle seller net earnings credit for this seller's lines only
        const deliveredLineItems = await tx.orderItem.findMany({
          where: itemFilter,
          select: { id: true },
        })
        for (const line of deliveredLineItems) {
          await applySellerCreditForOrderLineDelivered(tx, line.id)
        }

        // Check if all items across all sellers in the order are delivered/closed
        const allRemainingItems = await tx.orderItem.findMany({
          where: { orderId: assignment.orderId },
          select: { itemStatus: true },
        })
        const allDelivered = allRemainingItems.every((i) =>
          ["DELIVERED", "CANCELLED", "REFUNDED"].includes(i.itemStatus)
        )
        if (allDelivered) {
          await tx.order.update({
            where: { id: assignment.orderId },
            data: {
              status: OrderStatus.DELIVERED,
              paymentStatus: "COMPLETED",
            },
          })
        }

        return updatedAssignment
      })

      // Notify customer and seller (outside transaction — non-critical)
      if (assignment.order.customer?.email) {
        sendEmail({
          to: assignment.order.customer.email,
          subject: `Order #${assignment.order.orderNumber} Delivered`,
          text: `Your items from order #${assignment.order.orderNumber} have been delivered successfully. Thank you for shopping with us!`,
        }).catch(() => null)
      }

      // Notify the specific seller whose package was delivered
      {
        const targetSellerUser = assignment.seller?.user || assignment.order.seller?.user
        if (targetSellerUser?.email) {
          sendEmail({
            to: targetSellerUser.email,
            subject: `Order #${assignment.order.orderNumber} Package Delivered`,
            text: `Your package for Order #${assignment.order.orderNumber} has been successfully delivered by rider ${assignment.rider.user?.name || ""}.`,
          }).catch(() => null)
        }
      }

      return { success: true, assignment: txResult }

    case DeliveryAssignmentStatus.CANCELLED_BY_RIDER:
      // Trigger instant auto-reassignment for this specific seller!
      await prisma.riderDeliveryAssignment.update({
        where: { id: assignmentId },
        data: {
          status: DeliveryAssignmentStatus.CANCELLED_BY_RIDER,
          cancellationReason: options?.cancellationReason || "Cancelled by rider",
          cancelledAt: new Date(),
        },
      })
      console.log(`[Dispatch] Rider cancelled assignment ${assignmentId} for seller ${assignment.sellerId}. Re-dispatching...`)

      // Notify the specific seller of rider cancellation
      {
        const targetSellerUser = assignment.seller?.user || assignment.order.seller?.user
        if (targetSellerUser?.email) {
          const reason = options?.cancellationReason || "Emergency cancellation"
          sendEmail({
            to: targetSellerUser.email,
            subject: `⚠️ Rider Cancelled Delivery for Order #${assignment.order.orderNumber}`,
            text: `The assigned rider cancelled delivery for your package in Order #${assignment.order.orderNumber} (Reason: ${reason}). The system is automatically re-assigning the next available rider.`,
          }).catch(() => null)
        }
      }

      const reDispatch = await triggerOrderAutoDispatch(assignment.orderId, assignment.sellerId || undefined)
      return { success: true, cancelled: true, reDispatch }

    default:
      break
  }

  // For non-DELIVERED status transitions (AT_PICKUP, PICKED_UP, OUT_FOR_DELIVERY)
  const updated = await prisma.riderDeliveryAssignment.update({
    where: { id: assignmentId },
    data: {
      status: newStatus,
      pickedUpAt:
        newStatus === DeliveryAssignmentStatus.PICKED_UP ? new Date() : assignment.pickedUpAt,
      deliveredAt: assignment.deliveredAt,
      deliveryProofImage: options?.proofImage || assignment.deliveryProofImage,
    },
  })

  return { success: true, assignment: updated }
}

/**
 * Manual Assignment by Admin or Seller from the Order Details Page.
 */
export async function manualAssignRiderToOrder(
  orderId: string,
  riderId: string,
  mode: "MANUAL_ADMIN" | "MANUAL_SELLER",
  adminNotes?: string,
  targetSellerId?: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      seller: { include: { businessInfo: true, store: true } },
      items: {
        where: { productId: { not: null } },
        include: {
          product: { select: { name: true } },
          productVariant: { select: { name: true, weight: true, height: true, width: true, depth: true } },
          seller: { include: { businessInfo: true, store: true } },
        },
      },
      deliveryAssignments: true,
    },
  })

  if (!order) {
    return { success: false, message: "Order not found" }
  }

  const sellerId =
    targetSellerId ||
    order.sellerId ||
    order.items[0]?.sellerId ||
    ""

  if (!sellerId) {
    return { success: false, message: "No seller found for this order" }
  }

  const sellerInfo =
    order.items.find((i) => i.sellerId === sellerId)?.seller ||
    (order.sellerId === sellerId ? order.seller : null) ||
    (await prisma.seller.findUnique({
      where: { id: sellerId },
      include: { businessInfo: true, store: true },
    }))

  const rider = await prisma.rider.findUnique({
    where: { id: riderId },
    include: { user: true },
  })

  if (!rider || !rider.isApproved || rider.isSuspended) {
    return { success: false, message: "Selected rider is not approved or suspended" }
  }

  // AI Vehicle Requirement Check for Manual Assignment
  const sellerItems = order.items.filter((i) => i.sellerId === sellerId)
  const vehicleMatch = await determineRequiredVehicleForItems(sellerItems)
  const riderVehicleTypes = Array.isArray(rider.vehicleTypes) ? (rider.vehicleTypes as string[]) : []
  let vehicleWarning: string | null = null

  if (
    riderVehicleTypes.length > 0 &&
    !riderVehicleTypes.some((t) => vehicleMatch.compatibleVehicles.includes(t as any))
  ) {
    vehicleWarning = `Warning: Rider vehicle (${riderVehicleTypes.join(", ")}) does not match recommended ${vehicleMatch.requiredVehicle} for this package.`
    console.warn(`[Dispatch] Manual assignment vehicle warning: ${vehicleWarning}`)
  }

  // Cancel existing pending assignments for this seller
  await prisma.riderDeliveryAssignment.updateMany({
    where: {
      orderId,
      sellerId,
      status: { in: [DeliveryAssignmentStatus.OFFERED, DeliveryAssignmentStatus.ACCEPTED] },
    },
    data: { status: DeliveryAssignmentStatus.REASSIGNED_BY_ADMIN },
  })

  const sellerLat = sellerInfo?.businessInfo?.latitude || null
  const sellerLng = sellerInfo?.businessInfo?.longitude || null
  let distanceKm: number | null = null

  if (sellerLat != null && sellerLng != null && rider.currentLatitude != null && rider.currentLongitude != null) {
    distanceKm = calculateHaversineDistance(
      { latitude: sellerLat, longitude: sellerLng },
      { latitude: rider.currentLatitude, longitude: rider.currentLongitude }
    )
  }

  const deliveryOtp = Math.floor(100000 + Math.random() * 900000).toString()

  const assignment = await prisma.riderDeliveryAssignment.create({
    data: {
      orderId: order.id,
      riderId: rider.id,
      sellerId,
      status: DeliveryAssignmentStatus.ACCEPTED,
      dispatchMode:
        mode === "MANUAL_ADMIN" ? DispatchMode.MANUAL_ADMIN : DispatchMode.MANUAL_SELLER,
      attemptNumber: order.deliveryAssignments.filter((a) => a.sellerId === sellerId).length + 1,
      sellerLatitude: sellerLat,
      sellerLongitude: sellerLng,
      riderLatitudeAtOffer: rider.currentLatitude,
      riderLongitudeAtOffer: rider.currentLongitude,
      distanceKm,
      deliveryOtp,
      acceptedAt: new Date(),
      adminNotes,
    },
  })

  // Send Push Notification to Manually Assigned Rider
  const rawTokens = rider.deviceTokens
  const tokens = Array.isArray(rawTokens)
    ? rawTokens.map((t: any) => (typeof t === "string" ? t : t?.token)).filter(Boolean)
    : typeof rawTokens === "string"
    ? [rawTokens]
    : []

  if (tokens.length > 0) {
    const shopName =
      sellerInfo?.store?.name ||
      sellerInfo?.businessInfo?.businessName ||
      order.seller?.store?.name ||
      "Seller Store"

    sendPushNotification({
      tokens,
      riderId: rider.id,
      title: "🛵 Direct Delivery Assignment",
      body: `You have been directly assigned delivery for Order #${order.orderNumber} from ${shopName}.`,
      data: {
        type: "MANUAL_ASSIGN",
        orderId: order.id,
        orderNumber: order.orderNumber,
        assignmentId: assignment.id,
      },
    }).catch((err) => console.debug("[FCM] Manual assign notification failed:", err))
  }

  return {
    success: true,
    assignment,
    vehicleWarning,
    vehicleRecommendation: vehicleMatch,
  }
}

/**
 * Background Sweeper: Checks for stale OFFERED (> 60s) and ACCEPTED no-shows (> 30 min).
 */
export async function processStaleAssignmentsAndNoShows() {
  const now = new Date()

  // 1. Expire stale OFFERED assignments
  const staleOffers = await prisma.riderDeliveryAssignment.findMany({
    where: {
      status: DeliveryAssignmentStatus.OFFERED,
      expiresAt: { lt: now },
    },
  })

  for (const offer of staleOffers) {
    await prisma.riderDeliveryAssignment.update({
      where: { id: offer.id },
      data: { status: DeliveryAssignmentStatus.TIMED_OUT },
    })
    console.log(`[Sweeper] Expired offer ${offer.id} for order ${offer.orderId} (Seller: ${offer.sellerId}). Cascading...`)
    await triggerOrderAutoDispatch(offer.orderId, offer.sellerId || undefined)
  }

  // 2. No-Show / Pickup Timeout: ACCEPTED or AT_PICKUP for > 30 minutes without advancing to PICKED_UP
  const thirtyMinsAgo = new Date(Date.now() - NO_SHOW_TIMEOUT_MINUTES * 60 * 1000)
  const noShows = await prisma.riderDeliveryAssignment.findMany({
    where: {
      status: {
        in: [DeliveryAssignmentStatus.ACCEPTED, DeliveryAssignmentStatus.AT_PICKUP],
      },
      acceptedAt: { lt: thirtyMinsAgo },
    },
  })

  for (const noShow of noShows) {
    const isAtPickup = noShow.status === DeliveryAssignmentStatus.AT_PICKUP
    const reason = isAtPickup
      ? "Pickup timeout (failed to collect parcel within 30m of acceptance)"
      : "No-show timeout (failed to arrive at store within 30m of acceptance)"

    await prisma.riderDeliveryAssignment.update({
      where: { id: noShow.id },
      data: {
        status: DeliveryAssignmentStatus.CANCELLED_BY_RIDER,
        cancellationReason: reason,
        cancelledAt: now,
      },
    })
    console.log(`[Sweeper] ${reason} for assignment ${noShow.id} (Seller: ${noShow.sellerId}). Re-dispatching...`)
    await triggerOrderAutoDispatch(noShow.orderId, noShow.sellerId || undefined)
  }

  return {
    staleOffersExpired: staleOffers.length,
    noShowsCancelled: noShows.length,
  }
}
