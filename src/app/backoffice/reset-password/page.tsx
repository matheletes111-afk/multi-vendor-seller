"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { AlertCircle, Lock, ArrowRight, RefreshCw, CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react"

function BackofficeResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const identifier = (searchParams.get("identifier") || "").trim()

  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!identifier) {
      setError("Account identifier is missing. Please start again from forgot password.")
      return
    }
    if (otp.trim().length !== 6) {
      setError("Please enter the 6-digit verification code.")
      return
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please verify and re-enter.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/backoffice/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          otp: otp.trim(),
          newPassword,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password.")
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!identifier || resending) return
    setError("")
    setResendSuccess(false)
    setResending(true)
    try {
      const res = await fetch("/api/backoffice/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to resend code.")
      setResendSuccess(true)
      setTimeout(() => setResendSuccess(false), 4000)
    } catch (err: any) {
      setError(err.message || "Failed to resend code.")
    } finally {
      setResending(false)
    }
  }

  if (!identifier) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center space-y-4">
          <p className="text-slate-300 text-sm">Missing account identifier. Please start from the recovery request page.</p>
          <Button asChild className="rounded-2xl font-bold bg-blue-600 hover:bg-blue-500">
            <Link href="/backoffice/forgot-password">Go to Password Recovery</Link>
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
            <Lock className="h-8 w-8" />
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
              Create New Password
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Enter the recovery code sent to <strong className="text-blue-300">{identifier}</strong>
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/50 space-y-6">
          {success ? (
            <div className="text-center space-y-4 py-4 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-white">Password Reset Complete!</h3>
                <p className="text-xs text-slate-400">
                  Your new backoffice password has been securely updated. You can now sign in to your dashboard.
                </p>
              </div>
              <Button asChild className="w-full rounded-2xl h-12 font-bold bg-blue-600 hover:bg-blue-500 text-white mt-4 shadow-lg shadow-blue-600/30">
                <Link href="/backoffice/login">Sign in with New Password</Link>
              </Button>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-4 rounded-2xl bg-red-950/50 border border-red-800/60 text-red-200 text-xs font-semibold flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {resendSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-200 text-xs font-semibold flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>A new recovery code has been dispatched.</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    6-Digit Recovery Code
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    disabled={loading}
                    className="rounded-2xl h-12 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-700 text-center tracking-[0.4em] font-mono font-bold text-xl focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    New Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={loading}
                      className="rounded-2xl h-12 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-blue-500 pr-11 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      required
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      className="rounded-2xl h-12 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-blue-500 pr-11 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl h-12 font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <span>Reset & Save Password</span>
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
                  {resending ? "Sending..." : "Resend Code"}
                </button>
                <Link
                  href="/backoffice/forgot-password"
                  className="text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 font-medium"
                >
                  Change identifier
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BackofficeResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>}>
      <BackofficeResetPasswordForm />
    </Suspense>
  )
}
