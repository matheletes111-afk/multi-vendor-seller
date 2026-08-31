/**
 * Standalone CLI / Cron script to send onboarding & missing document reminder emails
 * to pending sellers (Product, Service, Hotel, Restaurant).
 *
 * Usage:
 *   npx ts-node scripts/send-onboarding-reminders.ts
 *   npx ts-node scripts/send-onboarding-reminders.ts --dry-run
 *   npx ts-node scripts/send-onboarding-reminders.ts --type=HOTEL --limit=50
 */

import { runSellerOnboardingReminderSweep } from "../src/lib/seller-onboarding-reminder"
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
  const freeMonthsArg = parseInt(args.find((a) => a.startsWith("--months="))?.split("=")[1] || "2", 10)

  console.log("==================================================")
  console.log("🚀 MEEEM Seller Onboarding Reminder Cron Runner")
  console.log("==================================================")
  console.log(`Mode: ${isDryRun ? "🧪 DRY RUN (No emails will be sent)" : "✉️ LIVE EXECUTION"}`)
  console.log(`Seller Type: ${typeArg || "ALL"}`)
  console.log(`Batch Limit: ${limitArg}`)
  console.log(`Promo Free Months: ${freeMonthsArg}`)
  console.log("--------------------------------------------------")

  const startTime = Date.now()
  const result = await runSellerOnboardingReminderSweep({
    dryRun: isDryRun,
    sellerType: typeArg || "ALL",
    limit: limitArg,
    freeMonths: freeMonthsArg,
  })
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log("\n📊 Execution Summary:")
  console.log(`- Total Incomplete Sellers Found: ${result.stats.pendingTotal}`)
  console.log(`- Breakdown: Product: ${result.stats.byType.product}, Service: ${result.stats.byType.service}, Hotel: ${result.stats.byType.hotel}, Restaurant: ${result.stats.byType.restaurant}`)
  if (!isDryRun) {
    console.log(`- Emails Successfully Sent: ${result.stats.sentTotal}`)
    console.log(`- Emails Failed: ${result.stats.failedTotal}`)
  }
  console.log(`- Skipped (No Email on record): ${result.stats.skippedNoEmail}`)
  console.log(`- Execution Duration: ${duration}s`)

  if (result.sellers.length > 0) {
    console.log("\n📋 Recipient Details:")
    result.sellers.forEach((s, idx) => {
      console.log(`  [${idx + 1}] ${s.sellerType} | ${s.businessName || s.userName || "Unknown"} <${s.userEmail}>`)
      console.log(`      Missing Docs (${s.missingDocuments.length}): ${s.missingDocuments.join(", ") || "None"}`)
      if (s.missingSteps.length > 0) {
        console.log(`      Missing Steps: ${s.missingSteps.join(", ")}`)
      }
      if (!isDryRun) {
        console.log(`      Status: ${s.emailSent ? "✅ Sent" : `❌ Failed (${s.error})`}`)
      }
    })
  }

  console.log("\n==================================================")
  console.log("✅ Finished.")
}

main()
  .catch((err) => {
    console.error("Fatal error executing onboarding reminder cron:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
