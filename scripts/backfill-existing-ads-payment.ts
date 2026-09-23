import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Checking for existing ads to backfill paymentStatus...")
  
  // Update any existing ads that are already ACTIVE or have spentAmount > 0
  const activeAdsResult = await prisma.sellerAd.updateMany({
    where: {
      status: "ACTIVE",
      paymentStatus: "PENDING",
    },
    data: {
      paymentStatus: "COMPLETED",
      paymentMethod: "LEGACY_PRE_FLOAT",
      paidAt: new Date(),
    },
  })

  console.log(`Updated ${activeAdsResult.count} ACTIVE ads to COMPLETED paymentStatus.`)

  // Check total ads by paymentStatus
  const statusCounts = await prisma.sellerAd.groupBy({
    by: ["paymentStatus", "status"],
    _count: true,
  })

  console.log("Ad distribution summary:", statusCounts)
}

main()
  .catch((e) => {
    console.error("Backfill error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
