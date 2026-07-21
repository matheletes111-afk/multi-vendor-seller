import { prisma } from "../src/lib/prisma"

async function main() {
  console.log("--------------------------------------------------")
  console.log("Starting Ad Duration Extension Script...")
  console.log("--------------------------------------------------")

  // Calculate target date: 5 months from today
  const now = new Date()
  const targetEndDate = new Date(now)
  targetEndDate.setMonth(targetEndDate.getMonth() + 5)

  console.log(`Current Date: ${now.toISOString()}`)
  console.log(`Target Extended End Date: ${targetEndDate.toISOString()} (5 months from now)\n`)

  // 1. Fetch all SellerAd records
  const ads = await prisma.sellerAd.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      startAt: true,
      endAt: true,
      sellerId: true,
    },
  })

  console.log(`Found ${ads.length} total SellerAd record(s) in database.`)

  if (ads.length === 0) {
    console.log("No SellerAd records found to update.")
  } else {
    let updatedCount = 0

    for (const ad of ads) {
      console.log(`\n- Processing Ad ID: ${ad.id}`)
      console.log(`  Title: "${ad.title}"`)
      console.log(`  Current Status: ${ad.status}`)
      console.log(`  Current End Date: ${ad.endAt.toISOString()}`)

      // Determine new status: Activate if it was ENDED, PAUSED, or PENDING_APPROVAL
      const newStatus = ad.status === "REJECTED" ? "REJECTED" : "ACTIVE"

      await prisma.sellerAd.update({
        where: { id: ad.id },
        data: {
          endAt: targetEndDate,
          status: newStatus,
        },
      })

      console.log(`  Updated End Date -> ${targetEndDate.toISOString()}`)
      console.log(`  Updated Status   -> ${newStatus}`)
      updatedCount++
    }

    console.log(`\nSuccessfully updated ${updatedCount} SellerAd record(s).`)
  }

  // 2. Also update AdManagement table if any exist
  const adManagements = await prisma.adManagement.findMany()
  if (adManagements.length > 0) {
    console.log(`\nUpdating ${adManagements.length} AdManagement record(s) to isActive = true...`)
    await prisma.adManagement.updateMany({
      data: { isActive: true },
    })
    console.log("AdManagement records activated.")
  }

  console.log("--------------------------------------------------")
  console.log("Script completed successfully!")
  console.log("--------------------------------------------------")
}

main()
  .catch((err) => {
    console.error("Error executing script:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
