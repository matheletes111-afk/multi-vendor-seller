import { prisma } from "@/lib/prisma"
import { estimateProductDimensions } from "@/lib/ai-dimensions"

export interface BulkAIJobItem {
  variantId: string
  productName: string
  variantName: string
  imageUrl?: string
}

export interface BulkAIJob {
  jobId: string
  sellerId: string
  totalCount: number
  processedCount: number
  fallbackCount: number
  aiSuccessCount: number
  status: "RUNNING" | "COMPLETED" | "FAILED"
  createdAt: number
  updatedAt: number
}

// Global in-memory job store
const activeJobs = new Map<string, BulkAIJob>()
const sellerJobs = new Map<string, string>() // sellerId -> jobId

export function getSellerActiveJob(sellerId: string): BulkAIJob | null {
  const jobId = sellerJobs.get(sellerId)
  if (!jobId) return null
  const job = activeJobs.get(jobId)
  if (!job) return null

  // If completed for more than 10 minutes, clean up
  if (job.status === "COMPLETED" && Date.now() - job.updatedAt > 10 * 60 * 1000) {
    activeJobs.delete(jobId)
    sellerJobs.delete(sellerId)
    return null
  }

  return job
}

export function getJobStatus(jobId: string): BulkAIJob | null {
  return activeJobs.get(jobId) || null
}

export function startBulkAIDimensionJob(sellerId: string, items: BulkAIJobItem[]): string {
  const jobId = `bulk_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  
  const job: BulkAIJob = {
    jobId,
    sellerId,
    totalCount: items.length,
    processedCount: 0,
    fallbackCount: 0,
    aiSuccessCount: 0,
    status: items.length === 0 ? "COMPLETED" : "RUNNING",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  activeJobs.set(jobId, job)
  sellerJobs.set(sellerId, jobId)

  if (items.length > 0) {
    // Process queue asynchronously in background (non-blocking)
    processQueueAsync(job, items).catch((err) => {
      console.error(`[BulkAIJob ${jobId}] Unhandled queue error:`, err)
      job.status = "FAILED"
      job.updatedAt = Date.now()
    })
  }

  return jobId
}

async function processQueueAsync(job: BulkAIJob, items: BulkAIJobItem[]) {
  const BATCH_SIZE = 2 // Process 2 variants at a time
  const BATCH_DELAY_MS = 600 // 600ms delay between batches to respect rate limits

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)

    await Promise.all(
      batch.map(async (item) => {
        try {
          const res = await estimateProductDimensions({
            productName: item.productName,
            variantName: item.variantName,
            imageUrl: item.imageUrl,
          })

          if (res.success && res.dimensions) {
            const { weight, height, width, depth } = res.dimensions
            await prisma.productVariant.update({
              where: { id: item.variantId },
              data: {
                weight: weight > 0 ? weight : null,
                height: height >= 0 ? height : 0,
                width: width >= 0 ? width : 0,
                depth: depth >= 0 ? depth : 0,
              },
            })

            if (res.warning) {
              job.fallbackCount++
            } else {
              job.aiSuccessCount++
            }
          } else {
            job.fallbackCount++
          }
        } catch (err) {
          console.warn(`[BulkAIJob ${job.jobId}] Error estimating variant ${item.variantId}:`, err)
          job.fallbackCount++
        } finally {
          job.processedCount++
          job.updatedAt = Date.now()
        }
      })
    )

    if (i + BATCH_SIZE < items.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
    }
  }

  job.status = "COMPLETED"
  job.updatedAt = Date.now()
  console.log(`[BulkAIJob ${job.jobId}] Completed processing ${job.totalCount} items. (AI: ${job.aiSuccessCount}, Fallback: ${job.fallbackCount})`)
}
