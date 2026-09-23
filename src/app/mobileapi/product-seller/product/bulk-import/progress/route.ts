import { NextRequest, NextResponse } from "next/server"
import { verifyMobileAuth } from "@/lib/mobile-auth-server"
import { UserRole } from "@prisma/client"
import { getSellerActiveJob, getJobStatus } from "@/lib/bulk-ai-dimension-queue"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/product-seller/product/bulk-import/progress
 * Check real-time progress of bulk AI dimensions packaging enrichment.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyMobileAuth(request, UserRole.SELLER_PRODUCT)
  if (!auth.success) return auth.errorResponse

  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get("jobId")

  let job = jobId ? getJobStatus(jobId) : null
  if (!job) {
    job = getSellerActiveJob(auth.seller.id)
  }

  if (!job) {
    return NextResponse.json({
      success: true,
      hasActiveJob: false,
      data: null,
    })
  }

  const percentage = job.totalCount > 0 ? Math.round((job.processedCount / job.totalCount) * 100) : 100
  const isCompleted = job.status === "COMPLETED" || job.status === "FAILED"

  const jobDetails = {
    jobId: job.jobId,
    totalCount: job.totalCount,
    processedCount: job.processedCount,
    fallbackCount: job.fallbackCount,
    aiSuccessCount: job.aiSuccessCount,
    percentage,
    status: job.status,
    isCompleted,
  }

  return NextResponse.json({
    success: true,
    hasActiveJob: true,
    data: jobDetails,
    job: jobDetails,
  })
}
