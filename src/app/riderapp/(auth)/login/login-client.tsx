"use client"

import React, { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Bike, Mail, Lock, ArrowRight, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import { cn } from "@/lib/utils"

export function RiderLoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get("email") || "")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    const err = searchParams.get("error")
    if (err === "AccountSuspended") return "Your rider account has been suspended. Please contact support."
    if (err === "InvalidRole") return "Invalid credentials for Rider Portal."
    return null
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/riderapp/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to sign in. Please check your credentials.")
      }

      // Hard redirect ensures session cookie is immediately sent with subsequent SSR / middleware requests
      const targetUrl = data.isFirstLogin || !data.onboardingCompleted
        ? "/riderapp/onboarding"
        : (data.url || "/riderapp")

      window.location.href = targetUrl
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
      setLoading(false)
    }
  }

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

        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wider mb-2">
            <Bike className="w-4 h-4" />
            Delivery Rider Portal
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Sign in to your rider account
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Access your active deliveries, manage delivery zones, and track earnings.
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-sm border border-slate-200 dark:border-slate-800 rounded-3xl space-y-6">
          {searchParams.get("reset") === "1" && (
            <div className="p-3.5 rounded-2xl bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 text-xs border border-green-200 dark:border-green-900/50 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span>Password reset successful. Please sign in with your new password.</span>
            </div>
          )}

          {searchParams.get("registered") === "true" && !searchParams.get("verified") && (
            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs border border-blue-200 dark:border-blue-900/50 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>Please check your email to verify your rider account before signing in.</span>
            </div>
          )}

          {searchParams.get("verified") === "1" && (
            <div className="p-3.5 rounded-2xl bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 text-xs border border-green-200 dark:border-green-900/50 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span>Email verified successfully. You can sign in now.</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs border border-red-200 dark:border-red-900/50 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="email"
                  placeholder="rider@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="pl-10 h-11 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </Label>
                <Link
                  href="/riderapp/forgot-password"
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pl-10 h-11 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  Sign In to Rider Portal
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center space-y-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Want to deliver with MEEEM?{" "}
              <Link
                href="/riderapp/registration"
                className="font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Register as a Rider
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
