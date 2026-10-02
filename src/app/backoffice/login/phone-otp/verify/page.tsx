"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getCsrfToken } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { AlertCircle, Smartphone, ArrowRight, RefreshCw, CheckCircle2, ArrowLeft } from "lucide-react"

function BackofficePhoneOtpVerifyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const phone = (searchParams.get("phone") || "").trim()
  const callbackUrl = searchParams.get("callbackUrl") || ""
  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  useEffect(() => {
    getCsrfToken().then(setCsrfToken)
  }, [])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!phone) {
      setError("Phone number is missing. Please start again.")
      return
    }
    if (otp.trim().length !== 6) {
      setError("Please enter the 6-digit verification code.")
      return
    }

    setLoading(true)
    try {
      // 1. Verify phone OTP
      const verifyRes = await fetch("/api/backoffice/auth/phone-otp/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: otp.trim() }),
      })
      const verifyData = await verifyRes.json().catch(() => ({}))

      if (!verifyRes.ok || !verifyData.otpLoginToken) {
        throw new Error(verifyData.error || "Invalid or expired OTP.")
      }

      // 2. Authorize backoffice session
      const loginRes = await fetch("/api/backoffice/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: verifyData.email || phone,
          otpLoginToken: verifyData.otpLoginToken,
          callbackUrl: callbackUrl || verifyData.loginUrl || "/admin",
          csrfToken: csrfToken ?? undefined,
        }),
      })

      const loginData = await loginRes.json().catch(() => ({}))
      if (!loginRes.ok) {
        throw new Error(loginData.error || "Failed to establish backoffice session.")
      }

      const target = loginData.redirectUrl || verifyData.loginUrl || callbackUrl || "/admin"
      router.push(target)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Verification failed.")
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!phone || resending) return
    setError("")
    setResendSuccess(false)
    setResending(true)
    try {
      const res = await fetch("/api/backoffice/auth/phone-otp/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to resend SMS code.")
      setResendSuccess(true)
      setTimeout(() => setResendSuccess(false), 4000)
    } catch (err: any) {
      setError(err.message || "Failed to resend SMS code.")
    } finally {
      setResending(false)
    }
  }

  if (!phone) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center space-y-4">
          <p className="text-slate-300 text-sm">Missing phone number. Please start from the phone OTP request page.</p>
          <Button asChild className="rounded-2xl font-bold bg-blue-600 hover:bg-blue-500">
            <Link href="/backoffice/login/phone-otp">Go to Phone OTP Login</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      <div className="w-full max-w-md space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-3xl bg-blue-500/10 border border-blue-400/20 text-blue-400 shadow-inner mb-2">
            <Smartphone className="h-8 w-8" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <Image
              src="/images/logo.png"
              alt="Meeem Logo"
              width={160}
              height={44}
              className="h-10 w-auto object-contain brightness-0 invert"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Enter SMS Verification Code
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              We sent a 6-digit code via SMS to <strong className="text-blue-300 font-semibold">{phone}</strong>
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/50 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-red-950/50 border border-red-800/60 text-red-200 text-xs font-semibold flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {resendSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-200 text-xs font-semibold flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>A new SMS code has been sent.</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                6-Digit SMS Code
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoComplete="one-time-code"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                disabled={loading}
                className="rounded-2xl h-14 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-700 text-center tracking-[0.5em] font-mono font-bold text-2xl focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl h-12 font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Verifying SMS Code...</span>
                </>
              ) : (
                <>
                  <span>Verify & Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || loading}
              className="font-bold text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
            >
              {resending ? "Sending..." : "Resend SMS"}
            </button>
            <Link
              href="/backoffice/login/phone-otp"
              className="text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="h-3 w-3" />
              Change number
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BackofficePhoneOtpVerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>}>
      <BackofficePhoneOtpVerifyForm />
    </Suspense>
  )
}
