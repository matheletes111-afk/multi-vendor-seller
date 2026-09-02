"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { getCsrfToken, signIn } from "next-auth/react"
import { Bike, Mail, Lock, Phone, ArrowRight, AlertCircle, RefreshCw, CheckCircle2, Eye, EyeOff } from "lucide-react"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import { cn } from "@/lib/utils"

export function RiderLoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get("email") || "")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState<string | null>(() => {
    const err = searchParams.get("error")
    if (err === "AccountSuspended") return "Your rider account has been suspended. Please contact support."
    if (err === "InvalidRole") return "Invalid credentials for Rider Portal."
    return null
  })

  useEffect(() => {
    getCsrfToken().then(setCsrfToken)
  }, [])

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || resendLoading || !email.trim()) return
    setResendLoading(true)
    setResendSuccess(null)
    try {
      const res = await fetch("/api/riderapp/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to resend verification code.")
      setResendSuccess(data.message || "A new 6-digit verification code has been sent.")
      setResendCooldown(60)
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err: any) {
      setError(err.message || "Failed to resend verification code.")
    } finally {
      setResendLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNeedsVerification(false)
    setResendSuccess(null)
    setLoading(true)

    try {
      const res = await fetch("/api/riderapp/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          csrfToken: csrfToken ?? undefined,
        }),
        credentials: "include",
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.needsVerification) {
          setNeedsVerification(true)
        }
        throw new Error(data.error || "Failed to sign in. Please check your credentials.")
      }

      // Hard redirect ensures session cookie is immediately sent with subsequent SSR / middleware requests
      const targetUrl = data.url || (data.isFirstLogin || !data.onboardingCompleted
        ? "/riderapp/onboarding"
        : "/riderapp")

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

          {resendSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{resendSuccess}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs border border-red-200 dark:border-red-900/50 flex flex-col gap-1.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {needsVerification && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading || resendCooldown > 0}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline text-left ml-6 disabled:opacity-50"
                >
                  {resendCooldown > 0
                    ? `Resend code available in ${resendCooldown}s`
                    : resendLoading
                    ? "Resending code..."
                    : "Resend verification code to your email"}
                </button>
              )}
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
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pl-10 pr-10 h-11 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
                  Sign In with Password
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 text-[11px] font-semibold">
                Or sign in with
              </span>
            </div>
          </div>

          <Link href="/riderapp/login/phone-otp" className="block">
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-semibold text-xs transition-all flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Sign In via Mobile SMS OTP
            </Button>
          </Link>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center space-y-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Want to earn with MEEEM?{" "}
              <Link
                href="/riderapp/registration"
                className="font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Register as a Delivery Rider
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
