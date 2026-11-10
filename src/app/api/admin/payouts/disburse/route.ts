import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { Prisma } from "@prisma/client"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      payoutRequestId,
      sellerSector,
      sellerId,
      amount,
      payoutMethod,
      payoutAccountSnapshot,
      payoutReference,
      adminNote,
      orderItemId,
      orderId,
      bookingId,
      foodOrderId,
    } = body

    // 1. Validation of Required Fields
    if (!payoutReference || typeof payoutReference !== "string" || !payoutReference.trim()) {
      return NextResponse.json(
        { success: false, error: "Transaction ID / Reference Number is required." },
        { status: 400 }
      )
    }

    if (!payoutMethod || typeof payoutMethod !== "string" || !payoutMethod.trim()) {
      return NextResponse.json(
        { success: false, error: "Payout Method is required (e.g. AfriMoney, Orange Money, Bank Transfer)." },
        { status: 400 }
      )
    }

    if (!payoutAccountSnapshot || typeof payoutAccountSnapshot !== "string" || !payoutAccountSnapshot.trim()) {
      return NextResponse.json(
        { success: false, error: "Recipient Account Snapshot is required." },
        { status: 400 }
      )
    }

    const disburseAmount = Number(amount)
    if (isNaN(disburseAmount) || disburseAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Disbursed amount must be a positive number greater than SLE 0.00." },
        { status: 400 }
      )
    }

    if (!sellerSector || !["PRODUCT", "SERVICE", "HOTEL", "RESTAURANT", "RIDER"].includes(sellerSector)) {
      return NextResponse.json(
        { success: false, error: "Valid seller sector is required (PRODUCT, SERVICE, HOTEL, RESTAURANT, RIDER)." },
        { status: 400 }
      )
    }

    if (!sellerId || typeof sellerId !== "string") {
      return NextResponse.json(
        { success: false, error: "Seller ID is required." },
        { status: 400 }
      )
    }

    const trimmedReference = payoutReference.trim()
    const trimmedMethod = payoutMethod.trim()
    const trimmedSnapshot = payoutAccountSnapshot.trim()
    const trimmedNote = adminNote?.trim() || null

    // 2. Perform Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {
      let currentBalance = 0

      // Check and update balance according to sector
      if (sellerSector === "PRODUCT" || sellerSector === "SERVICE") {
        const seller = await tx.seller.findUnique({
          where: { id: sellerId },
          select: { id: true, netBalance: true },
        })
        if (!seller) throw new Error("Seller profile not found.")
        currentBalance = Number(seller.netBalance)

        if (currentBalance < disburseAmount) {
          throw new Error(
            `Insufficient seller balance. Current balance is SLE ${currentBalance.toFixed(2)}, but disbursement amount is SLE ${disburseAmount.toFixed(2)}.`
          )
        }

        // Decrement seller balance
        await tx.seller.update({
          where: { id: sellerId },
          data: {
            netBalance: { decrement: new Prisma.Decimal(disburseAmount) },
          },
        })

        // Create DEBIT balance transaction
        await tx.sellerBalanceTransaction.create({
          data: {
            sellerId,
            amount: new Prisma.Decimal(disburseAmount),
            kind: "DEBIT",
            reason: "PAYOUT_DISBURSED",
            orderItemId: orderItemId || null,
            orderId: orderId || null,
            note: `Disbursed SLE ${disburseAmount.toFixed(2)} via ${trimmedMethod}. Ref: ${trimmedReference}${
              trimmedNote ? ` | Note: ${trimmedNote}` : ""
            }`,
          },
        })

        // If order lines need updating
        if (orderItemId) {
          await tx.orderItem.updateMany({
            where: { id: orderItemId },
            data: {
              settlementStatus: "PAID_OUT",
              payoutDisbursedAt: new Date(),
              payoutReference: trimmedReference,
              payoutMethod: trimmedMethod,
              payoutAccountSnapshot: trimmedSnapshot,
              payoutNote: trimmedNote,
            },
          })
        } else if (orderId) {
          await tx.orderItem.updateMany({
            where: {
              orderId,
              sellerId,
              settlementStatus: "YET_TO_PAY",
            },
            data: {
              settlementStatus: "PAID_OUT",
              payoutDisbursedAt: new Date(),
              payoutReference: trimmedReference,
              payoutMethod: trimmedMethod,
              payoutAccountSnapshot: trimmedSnapshot,
              payoutNote: trimmedNote,
            },
          })
        } else {
          // Central disbursement for this product/service seller
          await tx.orderItem.updateMany({
            where: {
              sellerId,
              settlementStatus: "YET_TO_PAY",
            },
            data: {
              settlementStatus: "PAID_OUT",
              payoutDisbursedAt: new Date(),
              payoutReference: trimmedReference,
              payoutMethod: trimmedMethod,
              payoutAccountSnapshot: trimmedSnapshot,
              payoutNote: trimmedNote,
            },
          })
        }
      } else if (sellerSector === "HOTEL") {
        const hotelSeller = await tx.hotelSeller.findUnique({
          where: { id: sellerId },
          select: { id: true, netBalance: true },
        })
        if (!hotelSeller) throw new Error("Hotel seller profile not found.")
        currentBalance = Number(hotelSeller.netBalance)

        if (currentBalance < disburseAmount) {
          throw new Error(
            `Insufficient hotel seller balance. Current balance is SLE ${currentBalance.toFixed(2)}, but disbursement amount is SLE ${disburseAmount.toFixed(2)}.`
          )
        }

        // Decrement hotel seller balance
        await tx.hotelSeller.update({
          where: { id: sellerId },
          data: {
            netBalance: { decrement: new Prisma.Decimal(disburseAmount) },
          },
        })

        // Create DEBIT balance transaction
        await tx.hotelBalanceTransaction.create({
          data: {
            hotelSellerId: sellerId,
            amount: new Prisma.Decimal(disburseAmount),
            kind: "DEBIT",
            reason: "PAYOUT_DISBURSED",
            bookingId: bookingId || null,
            note: `Disbursed SLE ${disburseAmount.toFixed(2)} via ${trimmedMethod}. Ref: ${trimmedReference}${
              trimmedNote ? ` | Note: ${trimmedNote}` : ""
            }`,
          },
        })

        // If hotel booking needs updating
        if (bookingId) {
          await tx.hotelBooking.updateMany({
            where: { id: bookingId },
            data: {
              settlementStatus: "PAID_OUT",
              payoutDisbursedAt: new Date(),
              payoutReference: trimmedReference,
              payoutMethod: trimmedMethod,
              payoutAccountSnapshot: trimmedSnapshot,
              payoutNote: trimmedNote,
            },
          })
        } else {
          // Central disbursement for this hotel seller
          await tx.hotelBooking.updateMany({
            where: {
              hotel: { hotelSellerId: sellerId },
              settlementStatus: "YET_TO_PAY",
            },
            data: {
              settlementStatus: "PAID_OUT",
              payoutDisbursedAt: new Date(),
              payoutReference: trimmedReference,
              payoutMethod: trimmedMethod,
              payoutAccountSnapshot: trimmedSnapshot,
              payoutNote: trimmedNote,
            },
          })
        }
      } else if (sellerSector === "RESTAURANT") {
        const restaurantSeller = await tx.restaurantSeller.findUnique({
          where: { id: sellerId },
          select: { id: true, netBalance: true },
        })
        if (!restaurantSeller) throw new Error("Restaurant seller profile not found.")
        currentBalance = Number(restaurantSeller.netBalance)

        if (currentBalance < disburseAmount) {
          throw new Error(
            `Insufficient restaurant seller balance. Current balance is SLE ${currentBalance.toFixed(2)}, but disbursement amount is SLE ${disburseAmount.toFixed(2)}.`
          )
        }

        // Decrement restaurant seller balance
        await tx.restaurantSeller.update({
          where: { id: sellerId },
          data: {
            netBalance: { decrement: new Prisma.Decimal(disburseAmount) },
          },
        })

        // Create DEBIT balance transaction
        await tx.restaurantBalanceTransaction.create({
          data: {
            restaurantSellerId: sellerId,
            amount: new Prisma.Decimal(disburseAmount),
            kind: "DEBIT",
            reason: "PAYOUT_DISBURSED",
            foodOrderId: foodOrderId || null,
            note: `Disbursed SLE ${disburseAmount.toFixed(2)} via ${trimmedMethod}. Ref: ${trimmedReference}${
              trimmedNote ? ` | Note: ${trimmedNote}` : ""
            }`,
          },
        })

        // If food order needs updating
        if (foodOrderId) {
          await tx.foodOrder.updateMany({
            where: { id: foodOrderId },
            data: {
              settlementStatus: "PAID_OUT",
              payoutDisbursedAt: new Date(),
              payoutReference: trimmedReference,
              payoutMethod: trimmedMethod,
              payoutAccountSnapshot: trimmedSnapshot,
              payoutNote: trimmedNote,
            },
          })
        } else {
          // Central disbursement for this restaurant seller
          await tx.foodOrder.updateMany({
            where: {
              restaurantSellerId: sellerId,
              settlementStatus: "YET_TO_PAY",
            },
            data: {
              settlementStatus: "PAID_OUT",
              payoutDisbursedAt: new Date(),
              payoutReference: trimmedReference,
              payoutMethod: trimmedMethod,
              payoutAccountSnapshot: trimmedSnapshot,
              payoutNote: trimmedNote,
            },
          })
        }
      } else if (sellerSector === "RIDER") {
        const rider = await tx.rider.findUnique({
          where: { id: sellerId },
          select: { id: true, netBalance: true },
        })
        if (!rider) throw new Error("Rider profile not found.")
        currentBalance = Number(rider.netBalance)

        if (currentBalance < disburseAmount) {
          throw new Error(
            `Insufficient rider balance. Current balance is SLE ${currentBalance.toFixed(2)}, but disbursement amount is SLE ${disburseAmount.toFixed(2)}.`
          )
        }

        // Decrement rider balance
        await tx.rider.update({
          where: { id: sellerId },
          data: {
            netBalance: { decrement: new Prisma.Decimal(disburseAmount) },
          },
        })

        // Create DEBIT balance transaction
        await tx.riderBalanceTransaction.create({
          data: {
            riderId: sellerId,
            amount: new Prisma.Decimal(disburseAmount),
            kind: "DEBIT",
            reason: "PAYOUT_DISBURSED",
            orderId: orderId || null,
            note: `Disbursed SLE ${disburseAmount.toFixed(2)} via ${trimmedMethod}. Ref: ${trimmedReference}${
              trimmedNote ? ` | Note: ${trimmedNote}` : ""
            }`,
          },
        })

        // Update all yet-to-pay delivery assignments for this rider to PAID_OUT
        await tx.riderDeliveryAssignment.updateMany({
          where: {
            riderId: sellerId,
            settlementStatus: "YET_TO_PAY",
          },
          data: {
            settlementStatus: "PAID_OUT",
            payoutDisbursedAt: new Date(),
            payoutReference: trimmedReference,
            payoutMethod: trimmedMethod,
            payoutAccountSnapshot: trimmedSnapshot,
            payoutNote: trimmedNote,
          },
        })
      }

      // 3. Update or Create SellerPayoutRequest
      let payoutRequest = null
      if (payoutRequestId) {
        payoutRequest = await tx.sellerPayoutRequest.update({
          where: { id: payoutRequestId },
          data: {
            status: "DISBURSED",
            requestedAmount: disburseAmount,
            payoutReference: trimmedReference,
            payoutMethod: trimmedMethod,
            payoutAccountSnapshot: trimmedSnapshot,
            adminNote: trimmedNote,
            disbursedAt: new Date(),
            disbursedByAdminId: session.user.id,
          },
        })
      } else {
        // Direct admin disbursement without prior pending request
        // Check if an existing PENDING request exists for this seller to avoid orphaned pending requests
        const existingPending = await tx.sellerPayoutRequest.findFirst({
          where: {
            sellerSector,
            sellerId,
            status: "PENDING",
          },
          orderBy: { requestedAt: "desc" },
        })

        if (existingPending) {
          payoutRequest = await tx.sellerPayoutRequest.update({
            where: { id: existingPending.id },
            data: {
              status: "DISBURSED",
              requestedAmount: disburseAmount,
              payoutReference: trimmedReference,
              payoutMethod: trimmedMethod,
              payoutAccountSnapshot: trimmedSnapshot,
              adminNote: trimmedNote,
              disbursedAt: new Date(),
              disbursedByAdminId: session.user.id,
            },
          })
        } else {
          payoutRequest = await tx.sellerPayoutRequest.create({
            data: {
              sellerSector,
              sellerId,
              requestedAmount: disburseAmount,
              status: "DISBURSED",
              payoutReference: trimmedReference,
              payoutMethod: trimmedMethod,
              payoutAccountSnapshot: trimmedSnapshot,
              adminNote: trimmedNote,
              disbursedAt: new Date(),
              disbursedByAdminId: session.user.id,
            },
          })
        }
      }

      return {
        remainingBalance: currentBalance - disburseAmount,
        payoutRequest,
      }
    })

    return NextResponse.json({
      success: true,
      message: `Payout of SLE ${disburseAmount.toFixed(2)} successfully disbursed. Transaction ID: ${trimmedReference}.`,
      data: result,
    })
  } catch (error: any) {
    console.error("Admin POST /api/admin/payouts/disburse error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to disburse payout." },
      { status: 500 }
    )
  }
}

