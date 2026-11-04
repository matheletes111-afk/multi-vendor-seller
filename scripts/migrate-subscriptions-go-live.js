/**
 * GO-LIVE SUBSCRIPTION DATA MIGRATION SCRIPT
 *
 * Implements Phase 1 (Decision F & Section 9.2):
 * - Grants all existing APPROVED sellers a 90-day (3 months) free period.
 * - Creates their first SubscriptionPurchase ledger row (paymentMethod: "GO_LIVE_FREE_PERIOD").
 * - Preserves any genuine unexpired paid packs.
 * - Safe by default: runs in --dry-run unless --apply is passed.
 * - Exports audit CSV and JSON backup to scripts/logs/.
 *
 * Usage:
 *   node scripts/migrate-subscriptions-go-live.js            # Dry run preview
 *   node scripts/migrate-subscriptions-go-live.js --apply    # Execute DB migration
 *   node scripts/migrate-subscriptions-go-live.js --only=HOTEL --apply
 */

const { PrismaClient, PlanType } = require("@prisma/client")
const fs = require("fs")
const path = require("path")

const prisma = new PrismaClient()

const GO_LIVE_FREE_DAYS = 90
const isApply = process.argv.includes("--apply")
const onlyArg = process.argv.find((a) => a.startsWith("--only="))
const onlyType = onlyArg ? onlyArg.replace("--only=", "").trim().toUpperCase() : null
const sellerIdArg = process.argv.find((a) => a.startsWith("--seller="))
const targetSellerId = sellerIdArg ? sellerIdArg.replace("--seller=", "").trim() : null

async function run() {
  const now = new Date()
  const defaultFreeEnd = new Date(now.getTime() + GO_LIVE_FREE_DAYS * 24 * 60 * 60 * 1000)

  console.log("================================================================================")
  console.log(`MEEEM SL - GO-LIVE SUBSCRIPTION MIGRATION (${GO_LIVE_FREE_DAYS} DAYS FREE PERIOD)`)
  console.log("================================================================================")
  console.log(`Execution Mode: ${isApply ? ">>> APPLY (LIVE WRITES TO DATABASE) <<<" : "DRY RUN (Preview Only, No DB Writes)"}`)
  console.log(`Timestamp:      ${now.toISOString()}`)
  console.log(`Filter Type:    ${onlyType || "ALL (PRODUCT_SERVICE, HOTEL, RESTAURANT)"}`)
  if (targetSellerId) console.log(`Target Seller:  ${targetSellerId}`)
  console.log("--------------------------------------------------------------------------------\n")

  // Fetch Free Plans for all 3 categories
  const [prodFreePlan, hotelFreePlan, restFreePlan] = await Promise.all([
    prisma.plan.findFirst({ where: { price: 0, type: PlanType.PRODUCT_SERVICE }, orderBy: { duration: "desc" } }),
    prisma.plan.findFirst({ where: { price: 0, type: PlanType.HOTEL }, orderBy: { duration: "desc" } }),
    prisma.plan.findFirst({ where: { price: 0, type: PlanType.RESTAURANT }, orderBy: { duration: "desc" } }),
  ])

  if (!prodFreePlan || !hotelFreePlan || !restFreePlan) {
    throw new Error(
      `Missing free plan configuration in DB: Product=${!!prodFreePlan}, Hotel=${!!hotelFreePlan}, Rest=${!!restFreePlan}`
    )
  }

  const logsDir = path.join(__dirname, "logs")
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }

  const timestamp = now.toISOString().replace(/[:.]/g, "-")
  const csvFile = path.join(logsDir, `migration-subscriptions-${timestamp}.csv`)
  const jsonBackupFile = path.join(logsDir, `backup-subscriptions-${timestamp}.json`)

  const auditRows = [
    "SellerType,SellerId,SellerName,Email,PreviousPlan,PreviousStatus,PreviousEnd,NewPlan,NewStatus,NewEnd,ActionTaken",
  ]
  const backupData = []

  let totalScanned = 0
  let totalMigrated = 0
  let totalSkipped = 0
  let totalErrors = 0

  // ────────────────────────────────────────────────────────────────────────────
  // 1. PRODUCT & SERVICE SELLERS
  // ────────────────────────────────────────────────────────────────────────────
  if (!onlyType || onlyType === "PRODUCT_SERVICE") {
    console.log("Processing Product & Service Sellers (Approved Only)...")
    const sellers = await prisma.seller.findMany({
      where: {
        isApproved: true,
        ...(targetSellerId ? { id: targetSellerId } : {}),
      },
      include: {
        user: true,
        store: true,
        subscription: { include: { plan: true } },
        subscriptionPurchases: { select: { id: true, status: true, paymentMethod: true } },
      },
    })

    console.log(`  Found ${sellers.length} approved product/service sellers.`)

    for (const s of sellers) {
      totalScanned++
      try {
        const hasExistingLedger = s.subscriptionPurchases && s.subscriptionPurchases.length > 0
        if (hasExistingLedger) {
          totalSkipped++
          auditRows.push(
            `PRODUCT_SERVICE,${s.id},"${s.store?.name || s.user?.name || ""}",${s.user?.email || ""},${s.subscription?.plan?.name || "NONE"},${s.subscription?.status || "NONE"},${s.subscription?.currentPeriodEnd ? s.subscription.currentPeriodEnd.toISOString() : "NONE"},${s.subscription?.plan?.name || "NONE"},${s.subscription?.status || "NONE"},${s.subscription?.currentPeriodEnd ? s.subscription.currentPeriodEnd.toISOString() : "NONE"},SKIPPED_ALREADY_MIGRATED`
          )
          continue
        }

        backupData.push({
          sellerType: "PRODUCT_SERVICE",
          sellerId: s.id,
          subscription: s.subscription,
        })

        const prevEnd = s.subscription?.currentPeriodEnd ? new Date(s.subscription.currentPeriodEnd) : null
        const isPaidAndFurther = prevEnd && prevEnd > defaultFreeEnd && s.subscription?.paidPrice && s.subscription.paidPrice > 0
        const finalEnd = isPaidAndFurther ? prevEnd : defaultFreeEnd
        const finalPlan = isPaidAndFurther && s.subscription?.plan ? s.subscription.plan : prodFreePlan

        if (isApply) {
          await prisma.$transaction(async (tx) => {
            await tx.subscriptionPurchase.create({
              data: {
                sellerType: PlanType.PRODUCT_SERVICE,
                sellerId: s.id,
                planId: finalPlan.id,
                planSnapshot: {
                  id: finalPlan.id,
                  name: finalPlan.name,
                  displayName: finalPlan.displayName,
                  price: finalPlan.price,
                  duration: GO_LIVE_FREE_DAYS,
                },
                durationDays: GO_LIVE_FREE_DAYS,
                price: 0,
                paidPrice: 0,
                status: "ACTIVE",
                periodStart: now,
                periodEnd: finalEnd,
                activatedAt: now,
                paymentMethod: "GO_LIVE_FREE_PERIOD",
                paidAt: now,
                note: `Go-live 90-day free period migration (Applied on ${now.toISOString()})`,
              },
            })

            await tx.subscription.upsert({
              where: { sellerId: s.id },
              create: {
                sellerId: s.id,
                planId: finalPlan.id,
                paidPrice: 0,
                paidAt: now,
                paymentMethod: "GO_LIVE_FREE_PERIOD",
                status: "ACTIVE",
                currentPeriodStart: now,
                currentPeriodEnd: finalEnd,
              },
              update: {
                planId: finalPlan.id,
                status: "ACTIVE",
                currentPeriodStart: now,
                currentPeriodEnd: finalEnd,
              },
            })
          })
        }

        totalMigrated++
        auditRows.push(
          `PRODUCT_SERVICE,${s.id},"${s.store?.name || s.user?.name || ""}",${s.user?.email || ""},${s.subscription?.plan?.name || "NONE"},${s.subscription?.status || "NONE"},${prevEnd ? prevEnd.toISOString() : "NONE"},${finalPlan.name},ACTIVE,${finalEnd.toISOString()},MIGRATED_90_DAYS_FREE`
        )
      } catch (err) {
        totalErrors++
        console.error(`  Error processing seller ${s.id}:`, err)
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 2. HOTEL SELLERS
  // ────────────────────────────────────────────────────────────────────────────
  if (!onlyType || onlyType === "HOTEL") {
    console.log("\nProcessing Hotel Sellers (Approved Only)...")
    const hotelSellers = await prisma.hotelSeller.findMany({
      where: {
        isApproved: true,
        ...(targetSellerId ? { id: targetSellerId } : {}),
      },
      include: {
        user: true,
        hotels: true,
        subscription: { include: { plan: true } },
        subscriptionPurchases: { select: { id: true, status: true } },
      },
    })

    console.log(`  Found ${hotelSellers.length} approved hotel sellers.`)

    for (const h of hotelSellers) {
      totalScanned++
      try {
        const hasExistingLedger = h.subscriptionPurchases && h.subscriptionPurchases.length > 0
        if (hasExistingLedger) {
          totalSkipped++
          continue
        }

        backupData.push({
          sellerType: "HOTEL",
          sellerId: h.id,
          subscription: h.subscription,
        })

        const prevEnd = h.subscription?.currentPeriodEnd ? new Date(h.subscription.currentPeriodEnd) : null
        const isPaidAndFurther = prevEnd && prevEnd > defaultFreeEnd && h.subscription?.paidPrice && h.subscription.paidPrice > 0
        const finalEnd = isPaidAndFurther ? prevEnd : defaultFreeEnd
        const finalPlan = isPaidAndFurther && h.subscription?.plan ? h.subscription.plan : hotelFreePlan

        if (isApply) {
          await prisma.$transaction(async (tx) => {
            await tx.subscriptionPurchase.create({
              data: {
                sellerType: PlanType.HOTEL,
                hotelSellerId: h.id,
                planId: finalPlan.id,
                planSnapshot: {
                  id: finalPlan.id,
                  name: finalPlan.name,
                  displayName: finalPlan.displayName,
                  price: finalPlan.price,
                  duration: GO_LIVE_FREE_DAYS,
                },
                durationDays: GO_LIVE_FREE_DAYS,
                price: 0,
                paidPrice: 0,
                status: "ACTIVE",
                periodStart: now,
                periodEnd: finalEnd,
                activatedAt: now,
                paymentMethod: "GO_LIVE_FREE_PERIOD",
                paidAt: now,
                note: `Go-live 90-day free period migration (Applied on ${now.toISOString()})`,
              },
            })

            await tx.hotelSubscription.upsert({
              where: { hotelSellerId: h.id },
              create: {
                hotelSellerId: h.id,
                planId: finalPlan.id,
                paidPrice: 0,
                paidAt: now,
                paymentMethod: "GO_LIVE_FREE_PERIOD",
                status: "ACTIVE",
                currentPeriodStart: now,
                currentPeriodEnd: finalEnd,
              },
              update: {
                planId: finalPlan.id,
                status: "ACTIVE",
                currentPeriodStart: now,
                currentPeriodEnd: finalEnd,
              },
            })
          })
        }

        totalMigrated++
        auditRows.push(
          `HOTEL,${h.id},"${h.hotels?.[0]?.name || h.user?.name || ""}",${h.user?.email || ""},${h.subscription?.plan?.name || "NONE"},${h.subscription?.status || "NONE"},${prevEnd ? prevEnd.toISOString() : "NONE"},${finalPlan.name},ACTIVE,${finalEnd.toISOString()},MIGRATED_90_DAYS_FREE`
        )
      } catch (err) {
        totalErrors++
        console.error(`  Error processing hotel seller ${h.id}:`, err)
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 3. RESTAURANT SELLERS
  // ────────────────────────────────────────────────────────────────────────────
  if (!onlyType || onlyType === "RESTAURANT") {
    console.log("\nProcessing Restaurant Sellers (Approved Only)...")
    const restSellers = await prisma.restaurantSeller.findMany({
      where: {
        isApproved: true,
        ...(targetSellerId ? { id: targetSellerId } : {}),
      },
      include: {
        user: true,
        subscription: { include: { plan: true } },
        subscriptionPurchases: { select: { id: true, status: true } },
      },
    })

    console.log(`  Found ${restSellers.length} approved restaurant sellers.`)

    for (const r of restSellers) {
      totalScanned++
      try {
        const hasExistingLedger = r.subscriptionPurchases && r.subscriptionPurchases.length > 0
        if (hasExistingLedger) {
          totalSkipped++
          continue
        }

        backupData.push({
          sellerType: "RESTAURANT",
          sellerId: r.id,
          subscription: r.subscription,
        })

        const prevEnd = r.subscription?.currentPeriodEnd ? new Date(r.subscription.currentPeriodEnd) : null
        const isPaidAndFurther = prevEnd && prevEnd > defaultFreeEnd && r.subscription?.paidPrice && r.subscription.paidPrice > 0
        const finalEnd = isPaidAndFurther ? prevEnd : defaultFreeEnd
        const finalPlan = isPaidAndFurther && r.subscription?.plan ? r.subscription.plan : restFreePlan

        if (isApply) {
          await prisma.$transaction(async (tx) => {
            await tx.subscriptionPurchase.create({
              data: {
                sellerType: PlanType.RESTAURANT,
                restaurantSellerId: r.id,
                planId: finalPlan.id,
                planSnapshot: {
                  id: finalPlan.id,
                  name: finalPlan.name,
                  displayName: finalPlan.displayName,
                  price: finalPlan.price,
                  duration: GO_LIVE_FREE_DAYS,
                },
                durationDays: GO_LIVE_FREE_DAYS,
                price: 0,
                paidPrice: 0,
                status: "ACTIVE",
                periodStart: now,
                periodEnd: finalEnd,
                activatedAt: now,
                paymentMethod: "GO_LIVE_FREE_PERIOD",
                paidAt: now,
                note: `Go-live 90-day free period migration (Applied on ${now.toISOString()})`,
              },
            })

            await tx.restaurantSubscription.upsert({
              where: { restaurantSellerId: r.id },
              create: {
                restaurantSellerId: r.id,
                planId: finalPlan.id,
                paidPrice: 0,
                paidAt: now,
                paymentMethod: "GO_LIVE_FREE_PERIOD",
                status: "ACTIVE",
                currentPeriodStart: now,
                currentPeriodEnd: finalEnd,
              },
              update: {
                planId: finalPlan.id,
                status: "ACTIVE",
                currentPeriodStart: now,
                currentPeriodEnd: finalEnd,
              },
            })
          })
        }

        totalMigrated++
        auditRows.push(
          `RESTAURANT,${r.id},"${r.user?.name || ""}",${r.user?.email || ""},${r.subscription?.plan?.name || "NONE"},${r.subscription?.status || "NONE"},${prevEnd ? prevEnd.toISOString() : "NONE"},${finalPlan.name},ACTIVE,${finalEnd.toISOString()},MIGRATED_90_DAYS_FREE`
        )
      } catch (err) {
        totalErrors++
        console.error(`  Error processing restaurant seller ${r.id}:`, err)
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Write Audit CSV & Backup JSON
  // ────────────────────────────────────────────────────────────────────────────
  fs.writeFileSync(csvFile, auditRows.join("\n"), "utf8")
  fs.writeFileSync(jsonBackupFile, JSON.stringify(backupData, null, 2), "utf8")

  console.log("\n--------------------------------------------------------------------------------")
  console.log("MIGRATION SUMMARY")
  console.log("--------------------------------------------------------------------------------")
  console.log(`Total Approved Sellers Scanned: ${totalScanned}`)
  console.log(`Total To Migrate / Migrated:     ${totalMigrated}`)
  console.log(`Total Skipped (Already Ledged):  ${totalSkipped}`)
  console.log(`Total Errors Encountered:        ${totalErrors}`)
  console.log(`Audit CSV Report Saved:          ${csvFile}`)
  console.log(`JSON Rollback Backup Saved:      ${jsonBackupFile}`)
  console.log("--------------------------------------------------------------------------------")

  if (!isApply) {
    console.log("\n[DRY RUN COMPLETE] Zero database writes performed.")
    console.log("To apply these changes to the live database, run:")
    console.log("  node scripts/migrate-subscriptions-go-live.js --apply\n")
  } else {
    console.log("\n[APPLY COMPLETE] All changes written to database successfully.\n")
  }

  await prisma.$disconnect()
}

run().catch(async (e) => {
  console.error("Migration Fatal Error:", e)
  await prisma.$disconnect()
  process.exit(1)
})

