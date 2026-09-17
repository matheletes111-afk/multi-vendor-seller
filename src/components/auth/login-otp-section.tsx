"use client"

import React, { useState, useEffect, useRef } from "react"
import { ShieldCheck, ArrowLeft, RefreshCw, Smartphone, Mail, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/ui/button"
import { Alert, AlertDescription } from "@/ui/alert"

export interface LoginOtpSectionProps {
  preAuthToken: string
  maskedPhone?: string | null
  maskedEmail?: string | null
  channels: Array<"SMS" | "EMAIL">
  roleTitle?: string
  verifyEndpoint: string
  resendEndpoint: string
  callbackUrl?: string
  csrfToken?: string | null
  onSuccess: (redirectUrl: string) => void
  onBackToLogin: () => void
}

export function LoginOtpSection({
  preAuthToken: initialPreAuthToken,
  maskedPhone,
  maskedEmail,
  channels,
  roleTitle = "Account",
  verifyEndpoint,
  resendEndpoint,
  callbackUrl,
  csrfToken,
  onSuccess,
  onBackToLogin,
}: LoginOtpSectionProps) {
  const [preAuthToken, setPreAuthToken] = useState(initialPreAuthToken)
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(60)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Focus first input box on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleDigitChange = (index: number, value: string) => {
    setError(null)
    const clean = value.replace(/\D/g, "")
    if (!clean) {
      const newDigits = [...digits]
      newDigits[index] = ""
      setDigits(newDigits)
      return
    }

    // If pasted multiple digits
    if (clean.length > 1) {
      const newDigits = [...digits]
      const pasted = clean.slice(0, 6).split("")
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || ""
      }
      setDigits(newDigits)
      const nextIndex = Math.min(pasted.length, 5)
      inputRefs.current[nextIndex]?.focus()
      return
    }

    const newDigits = [...digits]
    newDigits[index] = clean.slice(-1)
    setDigits(newDigits)

    // Auto advance to next box
    if (index < 5 && clean) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (!pasted) return
    const newDigits = ["", "", "", "", "", ""]
    pasted.split("").forEach((ch, idx) => {
      newDigits[idx] = ch
    })
    setDigits(newDigits)
    const nextIdx = Math.min(pasted.length, 5)
    inputRefs.current[nextIdx]?.focus()
  }

  const otpValue = digits.join("")

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (otpValue.length !== 6) {
      setError("Please enter the complete 6-digit verification code.")
      return
    }

    setError(null)
    setSuccessMessage(null)
    setLoading(true)

    try {
      const res = await fetch(verifyEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preAuthToken,
          otp: otpValue,
          callbackUrl,
          csrfToken: csrfToken ?? undefined,
        }),
        credentials: "include",
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (data.sessionExpired) {
          setError(data.error || "Verification session expired. Please sign in again.")
          setTimeout(() => onBackToLogin(), 2000)
          return
        }
        setError(data.error || "Invalid verification code. Please try again.")
        return
      }

      setSuccessMessage("Verification successful! Signing in...")
      setTimeout(() => {
        onSuccess(data.url || callbackUrl || "/")
      }, 500)
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0 || resendLoading) return
    setResendLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const res = await fetch(resendEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preAuthToken }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (data.sessionExpired) {
          setError(data.error || "Session expired. Please sign in again.")
          setTimeout(() => onBackToLogin(), 2000)
          return
        }
        setError(data.error || "Failed to resend code. Please try again.")
        return
      }

      const newPreAuthToken = data.preAuthToken || data.data?.preAuthToken
      if (newPreAuthToken) {
        setPreAuthToken(newPreAuthToken)
      }
      const newCooldown = data.resendCooldown ?? data.data?.resendCooldown ?? 60
      setCooldown(newCooldown)
      setDigits(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
      setSuccessMessage(data.message || "A new 6-digit verification code has been sent.")
    } catch {
      setError("Network error while requesting new code.")
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm dark:bg-blue-950/50 dark:text-blue-400">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
          Two-Step Verification
        </h2>
        <p className="mt-1.5 text-xs text-gray-500 sm:text-sm dark:text-gray-400">
          We sent a 6-digit security code to verify your {roleTitle} account
        </p>
      </div>

      {/* Destination Badges */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3.5 text-xs sm:text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-300">
        <p className="font-medium text-gray-600 dark:text-gray-400 mb-2">Code delivered to:</p>
        <div className="flex flex-wrap gap-2">
          {maskedPhone && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-mono text-xs font-semibold text-blue-700 shadow-sm border border-gray-200/80 dark:bg-gray-800 dark:text-blue-300 dark:border-gray-700">
              <Smartphone className="h-3.5 w-3.5 text-blue-500" />
              {maskedPhone}
            </span>
          )}
          {maskedEmail && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-mono text-xs font-semibold text-emerald-700 shadow-sm border border-gray-200/80 dark:bg-gray-800 dark:text-emerald-300 dark:border-gray-700">
              <Mail className="h-3.5 w-3.5 text-emerald-500" />
              {maskedEmail}
            </span>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="py-2.5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-green-200 bg-green-50 py-2.5 text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300">
          <AlertDescription className="text-xs sm:text-sm font-medium">{successMessage}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleVerify} className="space-y-5">
        {/* 6-Digit OTP Boxes */}
        <div>
          <label className="mb-2 block text-center text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-400">
            Enter 6-Digit Code
          </label>
          <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={loading}
                className="h-12 w-11 rounded-xl border border-gray-300 bg-white text-center text-xl font-bold text-gray-900 shadow-sm transition-all focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:h-14 sm:w-13 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-blue-400"
              />
            ))}
          </div>
        </div>

        {/* Resend Action */}
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="text-gray-500 dark:text-gray-400">Didn&apos;t receive code?</span>
          {cooldown > 0 ? (
            <span className="font-mono text-xs font-medium text-gray-400">
              Resend in {cooldown}s
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading}
              className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:underline disabled:opacity-50"
            >
              {resendLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3" />
                  Resend Code
                </>
              )}
            </button>
          )}
        </div>

        {/* Verify Button */}
        <Button
          type="submit"
          disabled={loading || otpValue.length !== 6}
          className="w-full rounded-xl py-2.5 font-medium shadow-md transition-all"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying...
            </span>
          ) : (
            "Verify & Sign In"
          )}
        </Button>

        {/* Back to Login */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onBackToLogin}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to email / password login
          </button>
        </div>
      </form>
    </div>
  )
}
