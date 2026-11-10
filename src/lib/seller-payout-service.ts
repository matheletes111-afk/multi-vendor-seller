import { prisma } from "@/lib/prisma"

export type SellerSector = "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT" | "RIDER"

function formatAccountSnapshot(bank: any): string {
  if (!bank) return "No bank or mobile money details provided"
  const parts: string[] = []
  if (bank.paymentOption) parts.push(`Method: ${bank.paymentOption}`)
  if (bank.bankName) parts.push(`Bank: ${bank.bankName}`)
  if (bank.accountHolderName) parts.push(`Holder: ${bank.accountHolderName}`)
  if (bank.accountNumber) parts.push(`Acc: ${bank.accountNumber}`)
  if (bank.mobileNumber) parts.push(`Mobile: ${bank.mobileNumber}`)
  if (bank.mobileMoneyOption) parts.push(`Wallet: ${bank.mobileMoneyOption}`)
  return parts.join(" • ") || "No bank details on file"
}

export async function requestSellerPayout({
  sellerSector,
  userId,
  sellerNote,
}: {
  sellerSector: SellerSector
  userId: string
  sellerNote?: string
}) {
  let sellerId: string
  let netBalance: number
  let bankDetails: any = null

  if (sellerSector === "PRODUCT" || sellerSector === "SERVICE") {
    const seller = await prisma.seller.findUnique({
      where: { userId },
      include: { bankDetails: true },
    })
    if (!seller) throw new Error("Seller profile not found")
    sellerId = seller.id
    netBalance = Number(seller.netBalance)
    bankDetails = seller.bankDetails
  } else if (sellerSector === "HOTEL") {
    const seller = await prisma.hotelSeller.findUnique({
      where: { userId },
      include: { bankDetails: true },
    })
    if (!seller) throw new Error("Hotel seller profile not found")
    sellerId = seller.id
    netBalance = Number(seller.netBalance)
    bankDetails = seller.bankDetails
  } else if (sellerSector === "RESTAURANT") {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
      include: { bankDetails: true },
    })
    if (!seller) throw new Error("Restaurant seller profile not found")
    sellerId = seller.id
    netBalance = Number(seller.netBalance)
    bankDetails = seller.bankDetails
  } else if (sellerSector === "RIDER") {
    const rider = await prisma.rider.findUnique({
      where: { userId },
    })
    if (!rider) throw new Error("Rider profile not found")
    sellerId = rider.id
    netBalance = Number(rider.netBalance)
    bankDetails = {
      paymentOption: rider.paymentOption,
      preferredPayoutMethod: rider.preferredPayoutMethod,
      bankName: rider.bankName,
      accountHolderName: rider.accountHolderName,
      accountNumber: rider.accountNumber,
      mobileNumber: rider.mobileNumber,
      mobileMoneyOption: rider.mobileMoneyOption,
    }
  } else {
    throw new Error("Invalid seller sector")
  }

  if (netBalance <= 0) {
    throw new Error("Insufficient balance. Your current net balance must be greater than SLE 0.00.")
  }

  const existingPending = await prisma.sellerPayoutRequest.findFirst({
    where: {
      sellerSector,
      sellerId,
      status: "PENDING",
    },
  })

  if (existingPending) {
    throw new Error("A payout request is already pending disbursement by Admin.")
  }

  const payoutMethod =
    bankDetails?.paymentOption ||
    bankDetails?.preferredPayoutMethod ||
    bankDetails?.mobileMoneyOption ||
    "AfriMoney / Bank"

  const payoutAccountSnapshot = formatAccountSnapshot(bankDetails)

  const payoutRequest = await prisma.sellerPayoutRequest.create({
    data: {
      sellerSector,
      sellerId,
      requestedAmount: netBalance,
      sellerNote: sellerNote?.trim() || null,
      payoutMethod,
      payoutAccountSnapshot,
      status: "PENDING",
    },
  })

  if (sellerSector === "PRODUCT" || sellerSector === "SERVICE") {
    await prisma.orderItem.updateMany({
      where: {
        sellerId,
        settlementStatus: "YET_TO_PAY",
      },
      data: {
        payoutRequestedAt: new Date(),
      },
    }).catch(() => null)
  } else if (sellerSector === "RIDER") {
    await prisma.riderDeliveryAssignment.updateMany({
      where: {
        riderId: sellerId,
        settlementStatus: "YET_TO_PAY",
      },
      data: {
        payoutRequestedAt: new Date(),
      },
    }).catch(() => null)
  }

  return payoutRequest
}

export async function getSellerPayoutStatus({
  sellerSector,
  userId,
}: {
  sellerSector: SellerSector
  userId: string
}) {
  let sellerId: string
  let netBalance: number
  let bankDetails: any = null

  if (sellerSector === "PRODUCT" || sellerSector === "SERVICE") {
    const seller = await prisma.seller.findUnique({
      where: { userId },
      include: { bankDetails: true },
    })
    if (!seller) throw new Error("Seller profile not found")
    sellerId = seller.id
    netBalance = Number(seller.netBalance)
    bankDetails = seller.bankDetails
  } else if (sellerSector === "HOTEL") {
    const seller = await prisma.hotelSeller.findUnique({
      where: { userId },
      include: { bankDetails: true },
    })
    if (!seller) throw new Error("Hotel seller profile not found")
    sellerId = seller.id
    netBalance = Number(seller.netBalance)
    bankDetails = seller.bankDetails
  } else if (sellerSector === "RESTAURANT") {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
      include: { bankDetails: true },
    })
    if (!seller) throw new Error("Restaurant seller profile not found")
    sellerId = seller.id
    netBalance = Number(seller.netBalance)
    bankDetails = seller.bankDetails
  } else if (sellerSector === "RIDER") {
    const rider = await prisma.rider.findUnique({
      where: { userId },
    })
    if (!rider) throw new Error("Rider profile not found")
    sellerId = rider.id
    netBalance = Number(rider.netBalance)
    bankDetails = {
      paymentOption: rider.paymentOption,
      preferredPayoutMethod: rider.preferredPayoutMethod,
      bankName: rider.bankName,
      accountHolderName: rider.accountHolderName,
      accountNumber: rider.accountNumber,
      mobileNumber: rider.mobileNumber,
      mobileMoneyOption: rider.mobileMoneyOption,
    }
  } else {
    throw new Error("Invalid seller sector")
  }

  const [pendingRequest, history] = await Promise.all([
    prisma.sellerPayoutRequest.findFirst({
      where: {
        sellerSector,
        sellerId,
        status: "PENDING",
      },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.sellerPayoutRequest.findMany({
      where: {
        sellerSector,
        sellerId,
      },
      orderBy: { requestedAt: "desc" },
      take: 20,
    }),
  ])

  return {
    netBalance,
    payoutMethod: bankDetails?.paymentOption || bankDetails?.preferredPayoutMethod || "AfriMoney / Bank",
    payoutAccountSnapshot: formatAccountSnapshot(bankDetails),
    pendingRequest,
    history,
  }
}

