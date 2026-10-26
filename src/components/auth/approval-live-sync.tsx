"use client"

import React, { useEffect, useState, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Clock, AlertCircle, RefreshCw, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"

export interface ApprovalStatusPayload {
  isApproved: boolean
  isSuspended: boolean
  status: string
  onboardingCompleted: boolean
  adminFeedback: string | null
}

interface ApprovalLiveSyncProps {
  role: "SELLER_PRODUCT" | "SELLER_SERVICE" | "SELLER_HOTEL" | "SELLER_RESTAURANT" | "RIDER"
  initialApproved?: boolean
  initialStatus?: string
  settingsPath: string
  dashboardPath: string
  onStatusChange?: (payload: ApprovalStatusPayload) => void
}

export function ApprovalLiveSync({
  role,
  initialApproved = false,
  initialStatus = "PENDING",
  settingsPath,
  dashboardPath,
  onStatusChange,
}: ApprovalLiveSyncProps) {
  const router = useRouter()
  const { data: session, update } = useSession()

  const [isApproved, setIsApproved] = useState<boolean>(
    Boolean(initialApproved || (session?.user as any)?.isApproved)
  )
  const [status, setStatus] = useState<string>(
    initialStatus || (session?.user as any)?.status || (isApproved ? "APPROVED" : "PENDING")
  )
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null)
  const [approvedNotice, setApprovedNotice] = useState<boolean>(false)
  const [checking, setChecking] = useState<boolean>(false)

  const isApprovedRef = useRef(isApproved)
  isApprovedRef.current = isApproved

  const statusRef = useRef(status)
  statusRef.current = status

  const isUpdatingSessionRef = useRef(false)

  const onStatusChangeRef = useRef(onStatusChange)
  onStatusChangeRef.current = onStatusChange

  const checkLiveStatus = useCallback(async () => {
    try {
      setChecking(true)
      const res = await fetch("/api/auth/live-status", {
        headers: { "Cache-Control": "no-cache" },
      })
      if (!res.ok) return

      const data: ApprovalStatusPayload = await res.json()
      if (!data) return

      // Handle suspended accounts
      if (data.isSuspended) {
        let prefix = "/product-seller"
        if (role === "SELLER_SERVICE") prefix = "/service-seller"
        else if (role === "SELLER_HOTEL") prefix = "/hotel-seller"
        else if (role === "SELLER_RESTAURANT") prefix = "/restaurant-seller"
        else if (role === "RIDER") prefix = "/riderapp"
        window.location.href = `${prefix}/login?error=AccountSuspended`
        return
      }

      const prevApproved = isApprovedRef.current
      const prevStatus = statusRef.current

      const approvalChanged = data.isApproved !== prevApproved
      const statusChanged = data.status !== prevStatus

      if (approvalChanged || statusChanged) {
        setIsApproved(data.isApproved)
        setStatus(data.status)
        setAdminFeedback(data.adminFeedback)

        // Sync NextAuth JWT session cookie in the background
        if (!isUpdatingSessionRef.current) {
          isUpdatingSessionRef.current = true
          try {
            await update({
              isApproved: data.isApproved,
              status: data.status,
              isSuspended: data.isSuspended,
              onboardingCompleted: data.onboardingCompleted,
            })
          } catch (e) {
            console.error("Session update error:", e)
          } finally {
            isUpdatingSessionRef.current = false
          }
        }

        // Notify parent / siblings via callback & custom DOM event
        if (onStatusChangeRef.current) {
          onStatusChangeRef.current(data)
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("approval:status_changed", { detail: data })
          )
        }

        // Trigger celebratory notice when transitioning from unapproved to approved
        if (data.isApproved && !prevApproved) {
          setApprovedNotice(true)
          router.refresh()
        }
      }
    } catch (err) {
      console.warn("[LiveSync] Status check error:", err)
    } finally {
      setChecking(false)
    }
  }, [role, router, update])

  // Run on mount once
  useEffect(() => {
    checkLiveStatus()
  }, [checkLiveStatus])

  // Polling loop while pending approval
  useEffect(() => {
    if (isApproved) return

    const interval = setInterval(() => {
      checkLiveStatus()
    }, 4000)

    return () => {
      clearInterval(interval)
    }
  }, [isApproved, checkLiveStatus])

  // Re-check on tab focus / visibility so status changes or suspensions are detected immediately
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkLiveStatus()
      }
    }

    const onFocus = () => {
      checkLiveStatus()
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("focus", onFocus)

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("focus", onFocus)
    }
  }, [checkLiveStatus])

  return (
    <>
      {/* Real-time Approval Success Toast Banner */}
      {approvedNotice && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-top duration-500 shadow-2xl">
          <div className="p-4 bg-emerald-600 text-white rounded-2xl flex items-start gap-3 border border-emerald-400">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="font-bold text-sm">Account Approved by Admin!</div>
              <p className="text-xs text-emerald-100">
                Congratulations! Your account has been reviewed and approved. All panel features, products, orders, and revenue tools are now active.
              </p>
              <div className="pt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs bg-white text-emerald-700 hover:bg-emerald-50 rounded-lg font-bold"
                  onClick={() => {
                    setApprovedNotice(false)
                    router.push(dashboardPath)
                  }}
                >
                  Go to Overview
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-white hover:bg-emerald-700 rounded-lg"
                  onClick={() => setApprovedNotice(false)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
            <button
              onClick={() => setApprovedNotice(false)}
              className="text-white/80 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Persistent pending indicator when unapproved */}
      {!isApproved && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              Account Pending Admin Approval
            </div>
            <span className="text-muted-foreground hidden sm:inline">•</span>
            <span className="text-muted-foreground">
              Your profile is currently under review. Profile & Store Settings are fully accessible. Other sections will unlock automatically once approved.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300">
              Live Auto-Sync Active
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950 rounded-md"
              disabled={checking}
              onClick={checkLiveStatus}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${checking ? "animate-spin" : ""}`} />
              Check Now
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
