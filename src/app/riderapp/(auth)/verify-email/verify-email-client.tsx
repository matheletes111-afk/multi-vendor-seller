"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Bike } from "lucide-react"
import { Button } from "@/ui/button"

export function RiderVerifyEmailClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const email = searchParams.get("email")

  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !email) {
      setError("Invalid or missing verification parameters.")
      setLoading(false)
      return
    }

    async function verify() {
      try {
        const res = await fetch("/api/riderapp/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, email }),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || "Email verification failed.")
        }

        setSuccess(true)
      } catch (err: any) {
        setError(err.message || "Failed to verify email.")
      } finally {
        setLoading(false)
      }
    }

    verify()
  }, [token, email])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <Link href="/" className="inline-block">
            <Image
              src="/images/logo.png"
              alt="MEEEM"
              width={140}
              height={42}
              className="h-10 w-auto object-contain dark:brightness-200"
            />
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-sm border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-5">
          {loading ? (
            <div className="py-8 space-y-4">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Verifying your email address...
              </p>
            </div>
          ) : success ? (
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Email Verified Successfully!
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Your email address <strong>{email}</strong> is now verified. You can sign in to your rider portal.
              </p>
              <div className="pt-2">
                <Link href={`/riderapp/login?email=${encodeURIComponent(email || "")}`}>
                  <Button className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2">
                    Sign In to Rider Portal
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Verification Failed
              </h3>
              <p className="text-xs text-red-600 dark:text-red-400">
                {error || "The link is invalid or expired."}
              </p>
              <div className="pt-2">
                <Link href="/riderapp/login">
                  <Button variant="outline" className="w-full h-11 rounded-xl text-xs">
                    Return to Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
