import { runSubscriptionLifecycleSweep } from "../src/lib/subscription-lifecycle"

async function main() {
  const isDryRun = process.argv.includes("--dry-run")
  console.log(`[Subscription Lifecycle Sweep] Starting sweep (dryRun=${isDryRun})...`)

  const res = await runSubscriptionLifecycleSweep({ dryRun: isDryRun })

  console.log("=== Subscription Lifecycle Sweep Completed ===")
  console.log(`Timestamp: ${res.timestamp}`)
  console.log(`Expired Overdue: ${res.expiredCount}`)
  console.log(`Promoted Queued: ${res.promotedCount}`)
  console.log(`Reminders Sent:`, res.remindersSent)

  if (res.details.length > 0) {
    console.log(`Details (${res.details.length} actions):`)
    for (const d of res.details) {
      console.log(` - [${d.action}] ${d.sellerType} ${d.storeName} (${d.sellerId}): ${d.notes || ""}`)
    }
  }

  if (res.errors.length > 0) {
    console.error("Errors encountered:", res.errors)
  }

  process.exit(res.success ? 0 : 1)
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})

