/**
 * Standalone CLI / Cron script to send the 7-day progressive drip emails
 * to active & onboarded sellers (Product, Service, Hotel, Restaurant).
 *
 * Usage:
 *   npx ts-node scripts/send-daily-drip.ts
 *   npx ts-node scripts/send-daily-drip.ts --dry-run
 *   npx ts-node scripts/send-daily-drip.ts --type=PRODUCT --limit=25
 */

import { runSellerDailyDripSweep } from "../src/lib/seller-daily-drip"
import { prisma } from "../src/lib/prisma"

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes("--dry-run") || args.includes("-d")
  const typeArg = args.find((a) => a.startsWith("--type="))?.split("=")[1]?.toUpperCase() as
    | "ALL"
    | "PRODUCT"
    | "SERVICE"
    | "HOTEL"
    | "RESTAURANT"
    | undefined
  const limitArg = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "100", 10)

  console.log("==================================================")
  console.log("🚀 MEEEM Seller Daily Drip (7-Day Journey) Runner")
  console.log("==================================================")
  console.log(`Mode: ${isDryRun ? "🧪 DRY RUN (No emails sent)" : "✉️ LIVE EXECUTION"}`)
  console.log(`Seller Type: ${typeArg || "ALL"}`)
  console.log(`Batch Limit: ${limitArg}`)
  console.log("--------------------------------------------------")

  const startTime = Date.now()
  const result = await runSellerDailyDripSweep({
    dryRun: isDryRun,
    sellerType: typeArg || "ALL",
    limit: limitArg,
  })
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log("\n📊 Execution Summary:")
  console.log(`- Active Onboarded Sellers Scanned: ${result.stats.scannedActiveSellers}`)
  console.log(`- Eligible to Process: ${result.stats.processedCount}`)
  console.log(`- Successfully Sent: ${result.stats.sentCount}`)
  console.log(`- Failed: ${result.stats.failedCount}`)
  console.log(`- Skipped (Already Sent Today): ${result.stats.skippedAlreadySentToday}`)
  console.log(`- Skipped (Completed 7-Day Cycle): ${result.stats.skippedCycleCompleted}`)
  console.log(`- Breakdown: Product: ${result.stats.byType.product}, Service: ${result.stats.byType.service}, Hotel: ${result.stats.byType.hotel}, Restaurant: ${result.stats.byType.restaurant}`)
  console.log(`- Duration: ${duration}s`)

  if (result.items.length > 0) {
    console.log("\n📋 Recipient Details:")
    result.items.forEach((item, idx) => {
      console.log(`  [${idx + 1}] Day ${item.dayNumber} | ${item.sellerType} | ${item.businessName || item.userName || "Merchant"} <${item.userEmail}>`)
      console.log(`      Subject: ${item.subject}`)
      console.log(`      Status: ${item.status}${item.error ? ` (Error: ${item.error})` : ""}`)
    })
  }

  console.log("\n==================================================")
  console.log("✅ Finished.")
}

main()
  .catch((err) => {
    console.error("Fatal error executing seller daily drip:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
