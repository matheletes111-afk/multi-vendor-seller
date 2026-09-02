"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Mail, KeyRound } from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"

export function RiderVerifyEmailClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const emailParam = searchParams.get("email")

  const [loading, setLoading] = useState(Boolean(token && emailParam))
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [inputEmail, setInputEmail] = useState(emailParam || "")
  const [inputOtp, setInputOtp] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Auto-verify if token & email are provided in URL
  useEffect(() => {
    if (!token || !emailParam) {
      setLoading(false)
      return
    }

    async function verify() {
      try {
        const res = await fetch("/api/riderapp/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, email: emailParam }),
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
  }, [token, emailParam])

  // Manual OTP submission
  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputEmail.trim() || !inputOtp.trim()) return
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch("/api/riderapp/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inputEmail.trim().toLowerCase(), otp: inputOtp.trim() }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Invalid or expired verification code.")
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || "Failed to verify code.")
    } finally {
      setSubmitting(false)
    }
  }

  // Resend OTP
  const handleResend = async () => {
    const targetEmail = inputEmail.trim().toLowerCase()
    if (!targetEmail || resendCooldown > 0 || resendLoading) return
    setResendLoading(true)
    setResendMessage(null)
    setError(null)

    try {
      const res = await fetch("/api/riderapp/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to resend code.")

      setResendMessage(data.message || "A new 6-digit code has been sent.")
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
      setError(err.message || "Failed to resend code.")
    } finally {
      setResendLoading(false)
    }
  }

  const verifiedEmail = inputEmail.trim() || emailParam || ""

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
                Your email address <strong>{verifiedEmail}</strong> is now verified. You can sign in to your rider portal.
              </p>
              <div className="pt-2">
                <Link href={`/riderapp/login?verified=1&email=${encodeURIComponent(verifiedEmail)}`}>
                  <Button className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2">
                    Sign In to Rider Portal
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-left">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center mx-auto mb-2">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Verify Your Rider Account
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Enter your email and the 6-digit verification code sent to your inbox.
                </p>
              </div>

              {resendMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-900/50">
                  {resendMessage}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs border border-red-200 dark:border-red-900/50 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleManualVerify} className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="email"
                      value={inputEmail}
                      onChange={(e) => setInputEmail(e.target.value)}
                      placeholder="rider@example.com"
                      required
                      className="pl-10 h-10 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    6-Digit Verification Code
                  </Label>
                  <Input
                    type="text"
                    maxLength={6}
                    value={inputOtp}
                    onChange={(e) => setInputOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    required
                    className="h-10 text-center tracking-widest font-mono text-base rounded-xl font-bold"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting || inputOtp.length < 6}
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs mt-2"
                >
                  {submitting ? "Verifying..." : "Verify & Continue"}
                </Button>
              </form>

              <div className="pt-2 text-center space-y-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading || resendCooldown > 0 || !inputEmail.trim()}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : resendLoading
                    ? "Sending new code..."
                    : "Didn't get the code? Resend"}
                </button>

                <div>
                  <Link href="/riderapp/login" className="text-xs text-slate-500 hover:text-slate-700">
                    Return to Login
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
