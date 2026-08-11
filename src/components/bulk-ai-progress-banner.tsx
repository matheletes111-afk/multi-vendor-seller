"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Sparkles, CheckCircle2, AlertCircle } from "lucide-react"

export interface JobProgressData {
  jobId: string
  totalCount: number
  processedCount: number
  fallbackCount: number
  aiSuccessCount: number
  percentage: number
  status: "RUNNING" | "COMPLETED" | "FAILED"
  isCompleted: boolean
}

export function BulkAIProgressBanner({
  jobId,
  onCompleted,
}: {
  jobId?: string | null
  onCompleted?: () => void
}) {
  const [job, setJob] = useState<JobProgressData | null>(null)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const completedFiredRef = useRef(false)

  const fetchProgress = useCallback(async () => {
    try {
      const url = jobId
        ? `/api/product-seller/products/bulk-import/progress?jobId=${jobId}`
        : `/api/product-seller/products/bulk-import/progress`
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      if (data.hasActiveJob && data.job) {
        setJob(data.job)
        if (data.job.isCompleted && !completedFiredRef.current) {
          completedFiredRef.current = true
          onCompleted?.()
        }
      } else {
        setJob(null)
      }
    } catch {
      // Ignore network polling glitches
    } finally {
      setLoading(false)
    }
  }, [jobId, onCompleted])

  useEffect(() => {
    setDismissed(false)
    completedFiredRef.current = false
    setLoading(true)
    fetchProgress()
  }, [jobId, fetchProgress])

  useEffect(() => {
    if (!job || job.isCompleted || dismissed) return

    const interval = setInterval(() => {
      fetchProgress()
    }, 3000)

    return () => clearInterval(interval)
  }, [job, dismissed, fetchProgress])

  if (loading || !job || dismissed) return null

  return (
    <div className="mb-6 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 p-4 shadow-sm backdrop-blur-xs transition-all animate-in fade-in slide-in-from-top-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
            {job.isCompleted ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : job.status === "FAILED" ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <Sparkles className="h-5 w-5 animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                {job.isCompleted
                  ? "AI Dimensions Enrichment Complete"
                  : job.status === "FAILED"
                  ? "AI Dimension Task Failed"
                  : "AI Dimension Enrichment in Progress"}
              </h4>
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                {job.percentage}%
              </span>
            </div>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              {job.isCompleted
                ? `Finished processing all ${job.totalCount} product variants (${job.aiSuccessCount} AI enriched, ${job.fallbackCount} smart fallbacks).`
                : `Estimating weight & package dimensions: ${job.processedCount} of ${job.totalCount} products processed...`}
            </p>
          </div>
        </div>

        {job.isCompleted && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="self-end sm:self-center text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline px-3 py-1 rounded-lg border border-blue-500/20 bg-background/50"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Progress Bar Track */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted/50 border border-blue-500/10">
        <div
          className={`h-full transition-all duration-500 ease-out rounded-full ${
            job.isCompleted
              ? "bg-emerald-500"
              : job.status === "FAILED"
              ? "bg-destructive"
              : "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
          }`}
          style={{ width: `${Math.max(5, job.percentage)}%` }}
        />
      </div>
    </div>
  )
}
