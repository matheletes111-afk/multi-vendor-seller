import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { verifyMobileAuth } from "@/lib/mobile-auth-server"
import { UserRole } from "@prisma/client"
import { getSellerActiveJob, getJobStatus } from "@/lib/bulk-ai-dimension-queue"

export async function GET(request: NextRequest) {
  let sellerId: string | null = null

  const session = await auth()
  if (session?.user && isProductSeller(session.user)) {
    const seller = await prisma.seller.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    sellerId = seller?.id || null
  } else {
    const mobileAuth = await verifyMobileAuth(request, UserRole.SELLER_PRODUCT)
    if (mobileAuth.success) {
      sellerId = mobileAuth.seller.id
    }
  }

  if (!sellerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get("jobId")

  let job = jobId ? getJobStatus(jobId) : null

  if (!job) {
    job = getSellerActiveJob(sellerId)
  }

  if (!job) {
    return NextResponse.json({ hasActiveJob: false })
  }

  const percentage = job.totalCount > 0 ? Math.round((job.processedCount / job.totalCount) * 100) : 100
  const isCompleted = job.status === "COMPLETED" || job.status === "FAILED"

  return NextResponse.json({
    hasActiveJob: true,
    job: {
      jobId: job.jobId,
      totalCount: job.totalCount,
      processedCount: job.processedCount,
      fallbackCount: job.fallbackCount,
      aiSuccessCount: job.aiSuccessCount,
      percentage,
      status: job.status,
      isCompleted,
    },
  })
}
