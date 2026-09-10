"use client"
import React, { useEffect } from "react"
import { Button } from "@/ui/button"
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react"
import Link from "next/link"

export default function RestaurantSellerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("RestaurantSellerDetailPage error:", error)
  }, [error])

  return (
    <div className="p-8 max-w-[800px] mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
      <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-sm">
        <AlertCircle className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
          Failed to load restaurant seller details
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          {error?.message || "An unexpected error occurred while loading this restaurant partner record."}
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="outline"
          onClick={() => reset()}
          className="rounded-2xl gap-2 font-bold text-xs uppercase tracking-wider h-11 px-5"
        >
          <RotateCcw className="h-4 w-4" /> Try Again
        </Button>
        <Link href="/admin/restaurant-sellers">
          <Button
            className="rounded-2xl gap-2 font-bold text-xs uppercase tracking-wider h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Sellers
          </Button>
        </Link>
      </div>
    </div>
  )
}
