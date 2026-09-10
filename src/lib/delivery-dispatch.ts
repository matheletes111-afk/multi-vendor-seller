import { prisma } from "./prisma"
import { calculateHaversineDistance, sortByProximity } from "./haversine-distance"
import { sendDeliveryOfferToRider, sendPushNotification, extractTokens } from "./firebase-messaging"
import { sendEmail } from "./email"
import { sendDeliveryOtp } from "./delivery-otp"
import { applySellerCreditForOrderLineDelivered } from "./seller-order-line-settlement"
import { determineRequiredVehicleForItems } from "./ai-vehicle-matcher"
import { DeliveryAssignmentStatus, DispatchMode, OrderStatus } from "@prisma/client"

const OFFER_TIMEOUT_SECONDS = 60
const NO_SHOW_TIMEOUT_MINUTES = 30
export const MAX_ROUNDS_PER_RIDER = 5

export interface AutoDispatchOptions {
  forceRedispatch?: boolean
  allowReofferRejected?: boolean
}

/**
 * Initiates the Cascading Waterfall Auto-Dispatch for a Product Order.
 * Supports multi-vendor orders: dispatches separate riders per distinct physical seller.
 */
export async function triggerOrderAutoDispatch(
  orderId: string,
  targetSellerId?: string,
  options?: AutoDispatchOptions
) {
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

    const now = new Date()
    // Auto-expire any stale OFFERED assignments across this order
    await prisma.riderDeliveryAssignment.updateMany({
      where: {
        orderId: order.id,
        status: DeliveryAssignmentStatus.OFFERED,
        expiresAt: { lt: now },
      },
      data: {
        status: DeliveryAssignmentStatus.TIMED_OUT,
      },
    })

    // If forceRedispatch requested (e.g. from manual Reassign button), cancel any ongoing OFFERED assignment
    if (options?.forceRedispatch) {
      await prisma.riderDeliveryAssignment.updateMany({
        where: {
          orderId: order.id,
          status: DeliveryAssignmentStatus.OFFERED,
        },
        data: {
          status: DeliveryAssignmentStatus.TIMED_OUT,
        },
      })
    }

    const results: any[] = []

    for (const sellerId of sellerIds) {
      // 0. Check if seller has enabled Self-Delivery (In-House) for their items in this order
      const selfDeliveryItem = await prisma.orderItem.findFirst({
        where: {
          orderId: order.id,
          sellerId: sellerId,
          productId: { not: null },
          isSelfDelivery: true,
        },
      })

      if (selfDeliveryItem) {
        console.log(
          `[Dispatch] Order #${order.orderNumber} (Seller: ${sellerId}) has Self-Delivery enabled. Skipping rider dispatch.`
        )
        results.push({
          sellerId,
          success: true,
          selfDelivery: true,
          skipped: true,
          message: "Seller has chosen Self-Delivery (In-House). Rider auto-dispatch is disabled.",
        })
        continue
      }

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
        // If the assignment is OFFERED and has expired (60s passed), auto-expire it to TIMED_OUT and continue cascading!
        if (
          activeAssignment.status === DeliveryAssignmentStatus.OFFERED &&
          activeAssignment.expiresAt &&
          activeAssignment.expiresAt < new Date()
        ) {
          await prisma.riderDeliveryAssignment.update({
            where: { id: activeAssignment.id },
            data: { status: DeliveryAssignmentStatus.TIMED_OUT },
          })
          console.log(`[Dispatch] Auto-expired stale offer ${activeAssignment.id} on order ${order.id}. Continuing cascade.`)
        } else if (
          options?.forceRedispatch &&
          (activeAssignment.status === DeliveryAssignmentStatus.OFFERED ||
           activeAssignment.status === DeliveryAssignmentStatus.ACCEPTED ||
           activeAssignment.status === DeliveryAssignmentStatus.AT_PICKUP)
        ) {
          // If forceRedispatch is requested, revoke the existing pending offer or accepted assignment
          await prisma.riderDeliveryAssignment.update({
            where: { id: activeAssignment.id },
            data: {
              status: DeliveryAssignmentStatus.REASSIGNED_BY_ADMIN,
              cancellationReason: "Re-dispatch triggered by user",
              cancelledAt: new Date(),
            },
          })

          // If the rider had accepted, notify them via FCM and Email that the assignment was revoked
          if (
            activeAssignment.status === DeliveryAssignmentStatus.ACCEPTED ||
            activeAssignment.status === DeliveryAssignmentStatus.AT_PICKUP
          ) {
            const revokedRider = await prisma.rider.findUnique({
              where: { id: activeAssignment.riderId },
              include: { user: true },
            })
            if (revokedRider) {
              const tokens = extractTokens(revokedRider.deviceTokens)
              if (tokens.length > 0) {
                sendPushNotification({
                  tokens,
                  riderId: revokedRider.id,
                  title: "⚠️ Delivery Assignment Revoked",
                  body: `Your delivery assignment for Order #${order.orderNumber} has been reassigned to another rider.`,
                  data: {
                    type: "ASSIGNMENT_REVOKED",
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                  },
                }).catch(() => null)
              }
              if (revokedRider.user?.email) {
                sendEmail({
                  to: revokedRider.user.email,
                  subject: `⚠️ Delivery Assignment Revoked for Order #${order.orderNumber}`,
                  text: `Your delivery assignment for Order #${order.orderNumber} has been reassigned by the store/admin. You are now free to accept other deliveries.`,
                }).catch(() => null)
              }
            }
          }
          console.log(`[Dispatch] Revoked assignment ${activeAssignment.id} (${activeAssignment.status}) on order ${order.id} due to forceRedispatch.`)
        } else {
          results.push({
            sellerId,
            success: false,
            message: `Seller package already has active assignment: ${activeAssignment.id} (${activeAssignment.status})`,
          })
          continue
        }
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

      // Match customer delivery location name or zone
      const customerLocation = (order.shippingCity || order.shippingAddressLine1 || "").trim()

      // 1 Rider = 1 Delivery Rule: Find all online, approved, idle riders with completed onboarding
      // Exclude riders currently engaged in an active delivery
      const allAvailableRiders = await prisma.rider.findMany({
        where: {
          isApproved: true,
          isSuspended: false,
          isOnline: true,
          status: "APPROVED",
          onboardingCompleted: true,
          deliveryAssignments: {
            none: {
              status: { in: ["ACCEPTED", "AT_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY", "OFFERED"] },
            },
          },
        },
        include: {
          user: true,
        },
      })

      if (allAvailableRiders.length === 0) {
        console.log(`[Dispatch] No free riders currently online for order #${order.orderNumber} (Seller: ${sellerId}).`)
        results.push({
          sellerId,
          success: false,
          message: "No available free riders found in the area",
          candidatesCount: 0,
        })
        continue
      }

      // Filter by zone/location match if rider specified selectedLocations
      let zoneMatchedRiders = allAvailableRiders.filter((rider) => {
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

      if (zoneMatchedRiders.length === 0) {
        zoneMatchedRiders = allAvailableRiders
      }

      // AI-Driven Vehicle Type Classification for this seller's package
      const sellerItems = order.items.filter((i) => i.sellerId === sellerId)
      const vehicleMatch = await determineRequiredVehicleForItems(sellerItems)
      console.log(
        `[Dispatch] Package for Seller ${sellerId} AI Vehicle Match: ${vehicleMatch.requiredVehicle} (${vehicleMatch.reason})`
      )

      // Filter candidates by required vehicle compatibility
      const vehicleMatchedRiders = zoneMatchedRiders.filter((rider) => {
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

      const poolCandidates = vehicleMatchedRiders
      const vehicleWarning = null

      // Multi-Flow Wave Dispatch: Count how many times each candidate in the pool has ALREADY been offered this order
      const riderOfferCounts = await prisma.riderDeliveryAssignment.groupBy({
        by: ["riderId"],
        where: {
          orderId: order.id,
          sellerId: sellerId,
          dispatchMode: DispatchMode.AUTO_CASCADE,
        },
        _count: { id: true },
      })
      const offerCountMap = new Map<string, number>()
      for (const row of riderOfferCounts) {
        offerCountMap.set(row.riderId, row._count.id)
      }

      // Each available rider receives up to MAX_ROUNDS_PER_RIDER (5) notifications across 5 sequential flows
      const eligibleRiders = poolCandidates.filter((rider) => {
        if (options?.forceRedispatch) return true
        const count = offerCountMap.get(rider.id) || 0
        return count < MAX_ROUNDS_PER_RIDER
      })

      if (eligibleRiders.length === 0) {
        console.log(
          `[Dispatch] All ${poolCandidates.length} available riders have been offered 5 times across 5 complete cascade flows without acceptance for Order #${order.orderNumber} (Seller: ${sellerId}). Pausing auto-dispatch.`
        )
        results.push({
          sellerId,
          success: false,
          maxAttemptsReached: true,
          message: `All ${poolCandidates.length} available riders have received 5 offer notifications without acceptance. Automatic cascade paused. Click Reassign to retry.`,
        })
        continue
      }

      // Sequential Flow / Wave Strategy:
      // Find the minimum offer count among eligible candidates (e.g. Flow 1 = 0, Flow 2 = 1, Flow 3 = 2, Flow 4 = 3, Flow 5 = 4)
      // All riders in the current flow must be offered before moving to the next flow!
      const minOfferCount = Math.min(
        ...eligibleRiders.map((r) => offerCountMap.get(r.id) || 0)
      )
      const currentFlowCandidates = eligibleRiders.filter(
        (r) => (offerCountMap.get(r.id) || 0) === minOfferCount
      )
      const currentCycleNumber = minOfferCount + 1 // Flow 1, Flow 2, Flow 3, Flow 4, Flow 5

      // Rank candidates in current flow by distance from Seller Shop (if GPS available)
      let rankedCandidates: any[] = []

      if (sellerLat != null && sellerLng != null) {
        const targetCoord = { latitude: sellerLat, longitude: sellerLng }
        const withGps = currentFlowCandidates.filter(
          (r) => r.currentLatitude != null && r.currentLongitude != null
        )
        const withoutGps = currentFlowCandidates.filter(
          (r) => r.currentLatitude == null || r.currentLongitude == null
        )

        const sortedWithGps = sortByProximity(targetCoord, withGps)
        rankedCandidates = [...sortedWithGps, ...withoutGps]
      } else {
        rankedCandidates = currentFlowCandidates
      }

      // Prioritize riders who have active device tokens registered so that push notifications actually deliver
      rankedCandidates.sort((a, b) => {
        const aTokens = extractTokens(a.deviceTokens).length
        const bTokens = extractTokens(b.deviceTokens).length
        if (aTokens > 0 && bTokens === 0) return -1
        if (bTokens > 0 && aTokens === 0) return 1
        return 0
      })

      const selectedRider = rankedCandidates[0]
      if (!selectedRider) {
        results.push({ sellerId, success: false, message: "No candidate selected in current flow" })
        continue
      }

      const totalAttemptsSoFar = await prisma.riderDeliveryAssignment.count({
        where: { orderId: order.id, sellerId },
      })
      const attemptNumber = totalAttemptsSoFar + 1
      const riderAttemptCount = (offerCountMap.get(selectedRider.id) || 0) + 1
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
          adminNotes: `Flow ${currentCycleNumber}/5 • Rider Offer #${riderAttemptCount}/5 (Pool: ${poolCandidates.length} riders)`,
        },
      })

      // Determine accurate Delivery Earning for this seller's package
      const sellerItemsForDispatch = order.items.filter((i) => i.sellerId === sellerId)
      const sellerDeliveryFee = sellerItemsForDispatch.reduce(
        (sum, item) => sum + (Number(item.shippingAmount) || 0),
        0
      ) || Number(order.shipping || 0)

      const shopName =
        sellerInfo?.store?.name ||
        sellerInfo?.businessInfo?.businessName ||
        "Seller Store"

      const shopAddress =
        [sellerInfo?.businessInfo?.street, sellerInfo?.businessInfo?.city].filter(Boolean).join(", ") ||
        sellerInfo?.store?.address ||
        "Store Address"

      const customerName = order.shippingFullName || "Customer"
      const customerPhone = order.shippingPhone || ""
      const customerAddress =
        [order.shippingAddressLine1, order.shippingAddressLine2, order.shippingCity].filter(Boolean).join(", ") ||
        "Delivery Address"

      // Send high-priority Push Notification to selected Rider with accurate earning and route
      await sendDeliveryOfferToRider(selectedRider, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        assignmentId: assignment.id,
        shopName,
        shopAddress,
        shopDistanceKm: distanceKm || undefined,
        customerName,
        customerAddress,
        customerPhone,
        customerZone: customerLocation || undefined,
        deliveryFee: sellerDeliveryFee,
        timeoutSeconds: OFFER_TIMEOUT_SECONDS,
        cycle: currentCycleNumber,
        riderAttempt: riderAttemptCount,
      })

      // Also send Email notification to selected Rider as immediate backup channel
      if (selectedRider.user?.email) {
        sendEmail({
          to: selectedRider.user.email,
          subject: `📦 New Delivery Offer: NLe ${sellerDeliveryFee.toFixed(2)} for Order #${order.orderNumber} (Flow ${currentCycleNumber}/5)`,
          text: `Hello ${selectedRider.user.name || "Rider"},\n\nA new delivery offer for Order #${order.orderNumber} is available from ${shopName} (Flow ${currentCycleNumber}/5 • Your Offer #${riderAttemptCount}/5).\n\n💰 Delivery Earning: NLe ${sellerDeliveryFee.toFixed(2)}\n🏪 Store: ${shopName} (${shopAddress})\n📍 Delivery Destination: ${customerAddress} (${customerName})\n\nPlease open your MEEEM Rider App to accept the delivery within ${OFFER_TIMEOUT_SECONDS} seconds!`,
        }).catch(() => null)
      }

      console.log(
        `[Dispatch] Offer sent to Rider ${selectedRider.user?.name || selectedRider.id} (Flow #${currentCycleNumber}/5, Rider Offer #${riderAttemptCount}/5, Attempt #${attemptNumber}) for Order #${order.orderNumber} (Seller: ${shopName})`
      )

      // Proactive Server-Side Timer: Automatically cascade to next rider after 62s if ignored
      const assignmentIdToWatch = assignment.id
      const orderIdToWatch = order.id
      const sellerIdToWatch = sellerId
      setTimeout(async () => {
        try {
          const current = await prisma.riderDeliveryAssignment.findUnique({
            where: { id: assignmentIdToWatch },
            select: { status: true, orderId: true, sellerId: true },
          })
          if (current && current.status === DeliveryAssignmentStatus.OFFERED) {
            await prisma.riderDeliveryAssignment.update({
              where: { id: assignmentIdToWatch },
              data: { status: DeliveryAssignmentStatus.TIMED_OUT },
            })
            console.log(
              `[Dispatch] Server timer auto-expired offer ${assignmentIdToWatch} for Order #${order.orderNumber} (Flow #${currentCycleNumber}/5, Attempt #${attemptNumber}). Cascading to next rider...`
            )
            await triggerOrderAutoDispatch(orderIdToWatch, sellerIdToWatch || undefined)
          }
        } catch (err) {
          console.debug("[Dispatch] Proactive cascade timer error:", err)
        }
      }, (OFFER_TIMEOUT_SECONDS + 2) * 1000)

      results.push({
        sellerId,
        success: true,
        assignmentId: assignment.id,
        riderId: selectedRider.id,
        attemptNumber,
        cycle: currentCycleNumber,
        riderAttempt: riderAttemptCount,
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

      if (!assignment.rider?.onboardingCompleted) {
        return {
          success: false,
          error: "Rider has not completed onboarding. Delivery orders cannot be accepted until profile onboarding is finished.",
        }
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

      const itemFilterForAccept = assignment.orderItemId
        ? { id: assignment.orderItemId }
        : assignment.sellerId
          ? { orderId: assignment.orderId, sellerId: assignment.sellerId, productId: { not: null } }
          : { orderId: assignment.orderId, productId: { not: null } }

      const unconfirmedItems = await tx.orderItem.findMany({
        where: {
          ...itemFilterForAccept,
          itemStatus: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] },
        },
        select: { id: true },
      })
      if (unconfirmedItems.length > 0) {
        await tx.orderItem.updateMany({
          where: { id: { in: unconfirmedItems.map((i) => i.id) } },
          data: { itemStatus: OrderStatus.PROCESSING },
        })
        const riderName = assignment.rider?.user?.name || "Rider"
        const storeName =
          assignment.seller?.store?.name ||
          assignment.seller?.businessInfo?.businessName ||
          assignment.order.seller?.store?.name ||
          "Store"
        await tx.orderItemStatusHistory.createMany({
          data: unconfirmedItems.map((i) => ({
            orderItemId: i.id,
            status: OrderStatus.PROCESSING,
            location: storeName,
            note: `Rider ${riderName} accepted delivery assignment. Preparing package for pickup.`,
          })),
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

  if (!assignment.rider?.onboardingCompleted) {
    return {
      success: false,
      message: "Rider has not completed onboarding. Delivery actions are not permitted until onboarding is completed.",
    }
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
      {
        const atPickupItems = await prisma.orderItem.findMany({
          where: itemFilter,
          select: { id: true },
        })
        if (atPickupItems.length > 0) {
          const storeName =
            assignment.seller?.store?.name ||
            assignment.seller?.businessInfo?.businessName ||
            assignment.order.seller?.store?.name ||
            "Store"
          const riderName = assignment.rider?.user?.name || "Rider"
          await prisma.orderItemStatusHistory.createMany({
            data: atPickupItems.map((i) => ({
              orderItemId: i.id,
              status: OrderStatus.PROCESSING,
              location: storeName,
              note: `Rider ${riderName} arrived at pickup location.`,
            })),
          })
        }
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

      {
        const pickedItems = await prisma.orderItem.findMany({
          where: itemFilter,
          select: { id: true },
        })
        if (pickedItems.length > 0) {
          const storeName =
            assignment.seller?.store?.name ||
            assignment.seller?.businessInfo?.businessName ||
            assignment.order.seller?.store?.name ||
            "Store"
          const riderName = assignment.rider?.user?.name || "Rider"
          await prisma.orderItemStatusHistory.createMany({
            data: pickedItems.map((i) => ({
              orderItemId: i.id,
              status: OrderStatus.SHIPPED,
              location: storeName,
              note: `Package picked up by rider ${riderName}. In transit to destination.`,
            })),
          })
        }
      }

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

      {
        const outItems = await prisma.orderItem.findMany({
          where: itemFilter,
          select: { id: true },
        })
        if (outItems.length > 0) {
          const riderName = assignment.rider?.user?.name || "Rider"
          const customerArea = assignment.order.shippingCity || "Out for delivery"
          await prisma.orderItemStatusHistory.createMany({
            data: outItems.map((i) => ({
              orderItemId: i.id,
              status: OrderStatus.OUT_FOR_DELIVERY,
              location: customerArea,
              note: `Package is out for delivery with rider ${riderName}.${assignment.deliveryOtp ? ` Delivery OTP: ${assignment.deliveryOtp}` : ""}`,
            })),
          })
        }
      }

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
        const deliveredLineItems = await tx.orderItem.findMany({
          where: itemFilter,
          select: { id: true },
        })
        if (deliveredLineItems.length > 0) {
          const riderName = assignment.rider?.user?.name || "Rider"
          const customerArea = assignment.order.shippingCity || "Delivered to customer"
          await tx.orderItemStatusHistory.createMany({
            data: deliveredLineItems.map((i) => ({
              orderItemId: i.id,
              status: OrderStatus.DELIVERED,
              location: customerArea,
              note: `Delivered successfully by rider ${riderName}. Verified with delivery OTP.`,
            })),
          })
        }
        const updatedAssignment = await tx.riderDeliveryAssignment.update({
          where: { id: assignmentId },
          data: {
            status: newStatus,
            deliveredAt: new Date(),
            deliveryProofImage: options?.proofImage || assignment.deliveryProofImage,
          },
        })
        // Settle seller net earnings credit for this seller's lines only
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
      if (
        currentStatus === DeliveryAssignmentStatus.PICKED_UP ||
        currentStatus === DeliveryAssignmentStatus.OUT_FOR_DELIVERY ||
        currentStatus === DeliveryAssignmentStatus.DELIVERED
      ) {
        return {
          success: false,
          message: `Cannot cancel delivery: Items are already ${currentStatus.replace(/_/g, " ")}. Please contact support.`,
        }
      }

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

      const reDispatch = await triggerOrderAutoDispatch(assignment.orderId, assignment.sellerId || undefined, {
        forceRedispatch: true,
        allowReofferRejected: true,
      })
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

  if (!rider.onboardingCompleted) {
    return {
      success: false,
      message: "Selected rider has not completed onboarding. Deliveries cannot be assigned until onboarding is completed.",
    }
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

  // Cancel existing pending or uncollected assignments for this seller and notify previous riders
  const prevAssignments = await prisma.riderDeliveryAssignment.findMany({
    where: {
      orderId,
      sellerId,
      status: {
        in: [
          DeliveryAssignmentStatus.OFFERED,
          DeliveryAssignmentStatus.ACCEPTED,
          DeliveryAssignmentStatus.AT_PICKUP,
        ],
      },
    },
    include: {
      rider: { include: { user: true } },
    },
  })

  if (prevAssignments.length > 0) {
    await prisma.riderDeliveryAssignment.updateMany({
      where: {
        id: { in: prevAssignments.map((p) => p.id) },
      },
      data: {
        status: DeliveryAssignmentStatus.REASSIGNED_BY_ADMIN,
        cancellationReason: `Replaced by manual assignment to rider ${rider.user?.name || rider.id}`,
        cancelledAt: new Date(),
      },
    })

    // Notify previously assigned riders that they were reassigned
    for (const prev of prevAssignments) {
      if (prev.riderId === rider.id) continue
      const rawTokens = prev.rider?.deviceTokens
      const tokens = extractTokens(rawTokens)
      if (tokens.length > 0) {
        sendPushNotification({
          tokens,
          riderId: prev.riderId,
          title: "⚠️ Delivery Assignment Revoked",
          body: `Your delivery assignment for Order #${order.orderNumber} has been reassigned to another rider.`,
          data: {
            type: "ASSIGNMENT_REVOKED",
            orderId: order.id,
            orderNumber: order.orderNumber,
          },
        }).catch(() => null)
      }
      if (prev.rider?.user?.email) {
        sendEmail({
          to: prev.rider.user.email,
          subject: `⚠️ Delivery Assignment Revoked for Order #${order.orderNumber}`,
          text: `Your delivery assignment for Order #${order.orderNumber} has been reassigned by the store/admin. You are now free to accept other deliveries.`,
        }).catch(() => null)
      }
    }
  }

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

  // If order items had self-delivery active, set it back to false since a rider was manually assigned
  await prisma.orderItem.updateMany({
    where: { orderId, sellerId, productId: { not: null }, isSelfDelivery: true },
    data: { isSelfDelivery: false },
  })

  // Advance any PENDING or CONFIRMED items to PROCESSING and log in timeline
  const unconfirmedItems = await prisma.orderItem.findMany({
    where: {
      orderId,
      sellerId,
      productId: { not: null },
      itemStatus: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] },
    },
    select: { id: true },
  })
  if (unconfirmedItems.length > 0) {
    await prisma.orderItem.updateMany({
      where: { id: { in: unconfirmedItems.map((i) => i.id) } },
      data: { itemStatus: OrderStatus.PROCESSING },
    })
    const storeName =
      sellerInfo?.store?.name ||
      sellerInfo?.businessInfo?.businessName ||
      order.seller?.store?.name ||
      "Store"
    await prisma.orderItemStatusHistory.createMany({
      data: unconfirmedItems.map((i) => ({
        orderItemId: i.id,
        status: OrderStatus.PROCESSING,
        location: storeName,
        note: `Rider ${rider.user?.name || "Rider"} assigned for delivery. Preparing package for pickup.`,
      })),
    })
  }

  // Send Push Notification to Manually Assigned Rider
  const rawTokens = rider.deviceTokens
  const tokens = Array.isArray(rawTokens)
    ? rawTokens.map((t: any) => (typeof t === "string" ? t : t?.token)).filter(Boolean)
    : typeof rawTokens === "string"
      ? [rawTokens]
      : []

  if (tokens.length > 0) {
    const sellerItemsForManual = order.items.filter((i) => i.sellerId === sellerId)
    const sellerDeliveryFee = sellerItemsForManual.reduce(
      (sum, item) => sum + (Number(item.shippingAmount) || 0),
      0
    ) || Number(order.shipping || 0)
    const feeFormatted = sellerDeliveryFee.toFixed(2)

    const shopName =
      sellerInfo?.store?.name ||
      sellerInfo?.businessInfo?.businessName ||
      order.seller?.store?.name ||
      "Seller Store"

    const shopAddress =
      [sellerInfo?.businessInfo?.street, sellerInfo?.businessInfo?.city].filter(Boolean).join(", ") ||
      sellerInfo?.store?.address ||
      "Store Address"

    const customerName = order.shippingFullName || "Customer"
    const customerPhone = order.shippingPhone || ""
    const customerAddress =
      [order.shippingAddressLine1, order.shippingAddressLine2, order.shippingCity].filter(Boolean).join(", ") ||
      "Delivery Address"

    sendPushNotification({
      tokens,
      riderId: rider.id,
      title: "🛵 Direct Delivery Assignment",
      body: `You have been directly assigned delivery for Order #${order.orderNumber} from ${shopName} • Earning: NLe ${feeFormatted}.`,
      data: {
        type: "MANUAL_ASSIGN",
        orderId: order.id,
        orderNumber: order.orderNumber,
        assignmentId: assignment.id,
        deliveryFee: feeFormatted,
        deliveryEarning: feeFormatted,
        earning: feeFormatted,
        amount: feeFormatted,
        shopName,
        shopAddress,
        customerName,
        customerAddress,
        customerPhone,
        distanceKm: distanceKm != null ? String(distanceKm) : "",
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
    }).catch((err) => console.debug("[FCM] Manual assign notification failed:", err))
  }

  // Also send direct email alert to the assigned rider
  if (rider.user?.email) {
    const sellerItemsForManual = order.items.filter((i) => i.sellerId === sellerId)
    const sellerDeliveryFee = sellerItemsForManual.reduce(
      (sum, item) => sum + (Number(item.shippingAmount) || 0),
      0
    ) || Number(order.shipping || 0)
    const feeFormatted = sellerDeliveryFee.toFixed(2)

    const shopName =
      sellerInfo?.store?.name ||
      sellerInfo?.businessInfo?.businessName ||
      order.seller?.store?.name ||
      "Seller Store"

    const shopAddress =
      [sellerInfo?.businessInfo?.street, sellerInfo?.businessInfo?.city].filter(Boolean).join(", ") ||
      sellerInfo?.store?.address ||
      "Store Address"

    const customerName = order.shippingFullName || "Customer"
    const customerAddress =
      [order.shippingAddressLine1, order.shippingAddressLine2, order.shippingCity].filter(Boolean).join(", ") ||
      "Delivery Address"

    sendEmail({
      to: rider.user.email,
      subject: `🛵 New Delivery Order Assigned: #${order.orderNumber} (Earning: NLe ${feeFormatted})`,
      text: `Hello ${rider.user.name || "Rider"},\n\nYou have been directly assigned delivery for Order #${order.orderNumber} from ${shopName}.\n\n💰 Delivery Earning: NLe ${feeFormatted}\n🏪 Store: ${shopName} (${shopAddress})\n📍 Delivery Destination: ${customerAddress} (${customerName})\n\nPlease open your MEEEM Rider App to view pickup details.`,
    }).catch(() => null)
  }

  return {
    success: true,
    assignment,
    vehicleWarning,
    vehicleRecommendation: vehicleMatch,
  }
}

/**
 * Stops ongoing automated dispatch / notifications for an order or seller package.
 * Only cancels assignments that are currently in OFFERED status.
 * If an offer is already ACCEPTED by a rider, it will NOT be cancelled.
 */
export async function stopOrderAutoDispatch(
  orderId: string,
  targetSellerId?: string,
  cancelledBy: "ADMIN" | "SELLER" = "SELLER"
) {
  const pendingOffers = await prisma.riderDeliveryAssignment.findMany({
    where: {
      orderId,
      ...(targetSellerId ? { sellerId: targetSellerId } : {}),
      status: DeliveryAssignmentStatus.OFFERED,
    },
  })

  if (pendingOffers.length === 0) {
    return {
      success: true,
      cancelledCount: 0,
      message: "No active pending offers found to stop.",
    }
  }

  await prisma.riderDeliveryAssignment.updateMany({
    where: {
      id: { in: pendingOffers.map((p) => p.id) },
      status: DeliveryAssignmentStatus.OFFERED,
    },
    data: {
      status: DeliveryAssignmentStatus.REASSIGNED_BY_ADMIN,
      cancellationReason: `Notifications stopped by ${cancelledBy.toLowerCase()}`,
      cancelledAt: new Date(),
    },
  })

  return {
    success: true,
    cancelledCount: pendingOffers.length,
    message: `Notifications stopped. ${pendingOffers.length} pending offer(s) cancelled.`,
  }
}

/**
 * Cancels an active or pending rider assignment (OFFERED, ACCEPTED, AT_PICKUP)
 * when a rider fails to show up or needs to be removed by Seller or Admin.
 * Does NOT permit cancellation once items are PICKED_UP or OUT_FOR_DELIVERY.
 */
export async function cancelAcceptedRiderAssignment(
  orderId: string,
  targetSellerId?: string,
  cancelledBy: "ADMIN" | "SELLER" = "SELLER",
  reason: string = "Rider did not show up",
  options?: { autoReassign?: boolean }
) {
  const whereClause: any = {
    orderId,
    ...(targetSellerId ? { sellerId: targetSellerId } : {}),
    status: {
      in: [
        DeliveryAssignmentStatus.OFFERED,
        DeliveryAssignmentStatus.ACCEPTED,
        DeliveryAssignmentStatus.AT_PICKUP,
      ],
    },
  }

  const activeAssignments = await prisma.riderDeliveryAssignment.findMany({
    where: whereClause,
    include: {
      rider: { include: { user: true } },
      order: true,
    },
  })

  if (activeAssignments.length === 0) {
    const inTransit = await prisma.riderDeliveryAssignment.findFirst({
      where: {
        orderId,
        ...(targetSellerId ? { sellerId: targetSellerId } : {}),
        status: {
          in: [
            DeliveryAssignmentStatus.PICKED_UP,
            DeliveryAssignmentStatus.OUT_FOR_DELIVERY,
            DeliveryAssignmentStatus.DELIVERED,
          ],
        },
      },
    })
    if (inTransit) {
      return {
        success: false,
        message: "Cannot cancel rider: items are already picked up or out for delivery.",
      }
    }
    return {
      success: false,
      message: "No active or pending rider assignment found to cancel.",
    }
  }

  const now = new Date()
  const fullReason = `Cancelled by ${cancelledBy.toLowerCase()}: ${reason}`

  for (const assignment of activeAssignments) {
    await prisma.riderDeliveryAssignment.update({
      where: { id: assignment.id },
      data: {
        status: DeliveryAssignmentStatus.REASSIGNED_BY_ADMIN,
        cancellationReason: fullReason,
        cancelledAt: now,
        adminNotes: `Assignment revoked by ${cancelledBy}: ${reason}`,
      },
    })

    // Notify rider via Email
    if (assignment.rider?.user?.email) {
      sendEmail({
        to: assignment.rider.user.email,
        subject: `⚠️ Delivery Assignment Revoked for Order #${assignment.order.orderNumber}`,
        text: `Your delivery assignment for Order #${assignment.order.orderNumber} has been cancelled by the ${cancelledBy.toLowerCase()} (Reason: ${reason}). You are now available for other orders.`,
      }).catch(() => null)
    }

    // Notify rider via Push Notification
    const rawTokens = assignment.rider?.deviceTokens
    const tokens = extractTokens(rawTokens)
    if (tokens.length > 0) {
      sendPushNotification({
        tokens,
        riderId: assignment.rider.id,
        title: "⚠️ Delivery Assignment Revoked",
        body: `Your delivery assignment for Order #${assignment.order.orderNumber} has been revoked by ${cancelledBy.toLowerCase()} (${reason}).`,
        data: {
          type: "ASSIGNMENT_REVOKED",
          orderId: assignment.orderId,
          orderNumber: assignment.order.orderNumber,
        },
      }).catch(() => null)
    }
  }

  let reDispatchResult: any = null
  if (options?.autoReassign) {
    reDispatchResult = await triggerOrderAutoDispatch(orderId, targetSellerId, {
      forceRedispatch: true,
      allowReofferRejected: true,
    }).catch(() => null)
  }

  return {
    success: true,
    cancelledCount: activeAssignments.length,
    message: `Rider assignment cancelled successfully (${fullReason}). Order is ready for re-dispatch or manual assignment.`,
    reDispatch: reDispatchResult,
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
