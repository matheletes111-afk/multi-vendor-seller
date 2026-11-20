"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { getCsrfToken } from "next-auth/react"
import {
  Mail,
  Lock,
  Phone,
  Smartphone,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import { CountryCodeSelect } from "@/ui/country-code-select"
import { cn } from "@/lib/utils"
import { getSafeRedirectUrl } from "@/lib/safe-redirect"
import { LoginOtpSection } from "@/components/auth/login-otp-section"
import { TurnstileWidget } from "@/components/auth/turnstile-widget"

type LoginMethod = "password" | "sms" | "email"

function formatE164Phone(rawPhone: string, countryCode: string): string {
  const cleaned = rawPhone.trim()
  if (!cleaned) return ""
  if (cleaned.startsWith("+")) return cleaned.replace(/[\s\-()]/g, "")
  const digits = cleaned.replace(/\D/g, "").replace(/^0+/, "")
  const ccDigits = countryCode.replace(/\D/g, "")
  if (digits.startsWith(ccDigits) && digits.length >= ccDigits.length + 6) {
    return `+${digits}`
  }
  return `${countryCode}${digits}`
}

function looksLikeLocalPhone(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes("@") || trimmed.startsWith("+") || /[a-zA-Z]/.test(trimmed)) {
    return false
  }
  return /\d/.test(trimmed)
}

export function RiderLoginClient() {
  const searchParams = useSearchParams()
  const callbackUrl = getSafeRedirectUrl(searchParams.get("callbackUrl"), "/riderapp")

  const initialMode = (() => {
    const mode = searchParams.get("mode")
    if (mode === "sms" || mode === "email" || mode === "password") return mode
    return "password" as LoginMethod
  })()

  const [loginMethod, setLoginMethod] = useState<LoginMethod>(initialMode)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  // Shared alert/verification state
  const [error, setError] = useState<string | null>(() => {
    const err = searchParams.get("error")
    if (err === "AccountSuspended") return "Your rider account has been suspended. Please contact support."
    if (err === "InvalidRole") return "Invalid credentials for Rider Portal."
    return null
  })
  const [needsVerification, setNeedsVerification] = useState(false)
  const [verificationTarget, setVerificationTarget] = useState<{ email?: string; phone?: string }>({})
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Password login state
  const [identifier, setIdentifier] = useState(searchParams.get("email") || "")
  const [passwordCountryCode, setPasswordCountryCode] = useState("+232")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [otpChallenge, setOtpChallenge] = useState<{
    preAuthToken: string
    maskedPhone?: string | null
    maskedEmail?: string | null
    channels: Array<"SMS" | "EMAIL">
  } | null>(null)

  // Passwordless OTP login state (shared step controller for SMS OTP & Email OTP)
  const [smsCountryCode, setSmsCountryCode] = useState("+232")
  const [smsPhone, setSmsPhone] = useState("")
  const [emailOtpAddress, setEmailOtpAddress] = useState(searchParams.get("email") || "")
  const [otpSentTarget, setOtpSentTarget] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState("")
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpResendCooldown, setOtpResendCooldown] = useState(0)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)

  useEffect(() => {
    getCsrfToken().then(setCsrfToken)
  }, [])

  useEffect(() => {
    if (otpResendCooldown <= 0) return
    const timer = setInterval(() => {
      setOtpResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [otpResendCooldown])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token)
  }, [])

  const switchMethod = (method: LoginMethod) => {
    setLoginMethod(method)
    setError(null)
    setNeedsVerification(false)
    setResendSuccess(null)
    setOtpSentTarget(null)
    setOtpCode("")
    setTurnstileToken("")
    setTurnstileResetKey((k) => k + 1)
  }

  const completeOtpSessionLogin = async (params: {
    otpLoginToken: string
    email?: string | null
    phone?: string | null
    identifier: string
  }) => {
    const loginRes = await fetch("/api/riderapp/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: params.email || undefined,
        phone: params.phone || undefined,
        identifier: params.identifier,
        otpLoginToken: params.otpLoginToken,
        callbackUrl,
        csrfToken: csrfToken ?? undefined,
      }),
    })
    const loginData = await loginRes.json().catch(() => ({}))
    if (!loginRes.ok) {
      throw new Error(loginData.error || "Failed to complete login session.")
    }
    window.location.href = getSafeRedirectUrl(loginData?.url || callbackUrl, "/riderapp")
  }

  const handleResendVerification = async () => {
    const emailTarget = verificationTarget.email || (identifier.includes("@") ? identifier.trim().toLowerCase() : undefined)
    const phoneTarget =
      verificationTarget.phone || (!identifier.includes("@") && identifier.trim() ? identifier.trim() : undefined)
    if (resendCooldown > 0 || resendLoading || (!emailTarget && !phoneTarget)) return

    setResendLoading(true)
    setResendSuccess(null)
    setError(null)
    try {
      const res = await fetch("/api/riderapp/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailTarget,
          phone: phoneTarget,
          phoneCountryCode: phoneTarget ? passwordCountryCode : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to resend verification code.")
      setResendSuccess(data.message || "A new 6-digit verification code has been sent.")
      setResendCooldown(60)
    } catch (err: any) {
      setError(err.message || "Failed to resend verification code.")
    } finally {
      setResendLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNeedsVerification(false)
    setResendSuccess(null)
    setPasswordLoading(true)

    try {
      const trimmed = identifier.trim()
      const isEmail = trimmed.includes("@")
      const res = await fetch("/api/riderapp/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: isEmail ? trimmed.toLowerCase() : undefined,
          phone: !isEmail ? trimmed : undefined,
          phoneCountryCode: !isEmail ? passwordCountryCode : undefined,
          password,
          callbackUrl,
          csrfToken: csrfToken ?? undefined,
        }),
        credentials: "include",
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (data.needsVerification) {
          setNeedsVerification(true)
          setVerificationTarget({ email: data.email, phone: data.phone })
        }
        throw new Error(data.error || "Login failed. Check your credentials.")
      }

      if (data.requiresOtp && data.preAuthToken) {
        setOtpChallenge({
          preAuthToken: data.preAuthToken,
          maskedPhone: data.maskedPhone,
          maskedEmail: data.maskedEmail,
          channels: data.channels || ["SMS"],
        })
        return
      }

      if (data.url) {
        window.location.href = getSafeRedirectUrl(data.url, "/riderapp")
        return
      }

      window.location.href = callbackUrl
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleSendPasswordlessOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError(null)
    setNeedsVerification(false)
    setResendSuccess(null)

    const isSms = loginMethod === "sms"
    const targetValue = isSms
      ? formatE164Phone(smsPhone, smsCountryCode)
      : emailOtpAddress.trim().toLowerCase()

    if (!targetValue) {
      setError(isSms ? "Please enter your mobile number." : "Please enter your email address.")
      return
    }

    setOtpLoading(true)
    try {
      const endpoint = isSms
        ? "/api/riderapp/auth/phone-otp/send-otp"
        : "/api/riderapp/auth/email-otp/send-otp"
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(turnstileToken ? { "x-turnstile-token": turnstileToken } : {}),
        },
        body: JSON.stringify(
          isSms
            ? { phone: targetValue, turnstileToken }
            : { email: targetValue, turnstileToken }
        ),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.needsVerification) {
          setNeedsVerification(true)
          setVerificationTarget({ email: targetValue })
        }
        setTurnstileResetKey((k) => k + 1)
        throw new Error(data.error || "Failed to send OTP.")
      }

      setOtpSentTarget(targetValue)
      setOtpCode("")
      setOtpResendCooldown(60)
      setResendSuccess(data.message || `6-digit OTP sent to ${targetValue}.`)
      setTurnstileToken("")
      setTurnstileResetKey((k) => k + 1)
    } catch (err: any) {
      setError(err.message || "Failed to send OTP. Please try again.")
    } finally {
      setOtpLoading(false)
    }
  }

  const handleVerifyPasswordlessOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResendSuccess(null)

    if (!otpSentTarget) {
      setError("Please request an OTP first.")
      return
    }
    if (otpCode.trim().length !== 6) {
      setError("Please enter the 6-digit OTP code.")
      return
    }

    setOtpLoading(true)
    try {
      const isSms = loginMethod === "sms"
      const verifyEndpoint = isSms
        ? "/api/riderapp/auth/phone-otp/verify-otp"
        : "/api/riderapp/auth/email-otp/verify-otp"
      const verifyRes = await fetch(verifyEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSms
            ? { phone: otpSentTarget, otp: otpCode.trim() }
            : { email: otpSentTarget, otp: otpCode.trim() }
        ),
      })
      const verifyData = await verifyRes.json().catch(() => ({}))
      if (!verifyRes.ok || !verifyData.otpLoginToken) {
        throw new Error(verifyData.error || "Invalid or expired OTP.")
      }

      await completeOtpSessionLogin({
        otpLoginToken: verifyData.otpLoginToken,
        email: verifyData.email || (!isSms ? otpSentTarget : null),
        phone: verifyData.phone || (isSms ? otpSentTarget : null),
        identifier: verifyData.email || verifyData.phone || otpSentTarget,
      })
    } catch (err: any) {
      setError(err.message || "Verification failed. Please try again.")
    } finally {
      setOtpLoading(false)
    }
  }

  const showPasswordCountryCode = looksLikeLocalPhone(identifier)
  const verifyEmailHref = verificationTarget.email
    ? `/riderapp/verify-email?email=${encodeURIComponent(verificationTarget.email)}`
    : verificationTarget.phone
    ? `/riderapp/verify-email?phone=${encodeURIComponent(verificationTarget.phone)}`
    : "/riderapp/verify-email"

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
            Delivery Rider Portal
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Sign in to your rider account
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Choose Password, SMS OTP, or Email OTP to access your delivery dashboard
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-sm border border-slate-200 dark:border-slate-800 rounded-3xl space-y-5">
          {otpChallenge ? (
            <LoginOtpSection
              preAuthToken={otpChallenge.preAuthToken}
              maskedPhone={otpChallenge.maskedPhone}
              maskedEmail={otpChallenge.maskedEmail}
              channels={otpChallenge.channels}
              roleTitle="Delivery Rider"
              verifyEndpoint="/api/riderapp/auth/verify-2fa"
              resendEndpoint="/api/riderapp/auth/resend-2fa"
              callbackUrl={callbackUrl}
              csrfToken={csrfToken}
              onSuccess={(url) => {
                window.location.href = getSafeRedirectUrl(url, "/riderapp")
              }}
              onBackToLogin={() => {
                setOtpChallenge(null)
                setError(null)
              }}
            />
          ) : (
            <>
              {/* 3-Way Sign-In Method Switcher */}
              <div
                className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1"
                role="tablist"
                aria-label="Rider login methods"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginMethod === "password"}
                  onClick={() => switchMethod("password")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-semibold transition-all",
                    loginMethod === "password"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>Password</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginMethod === "sms"}
                  onClick={() => switchMethod("sms")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-semibold transition-all",
                    loginMethod === "sms"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span>SMS OTP</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginMethod === "email"}
                  onClick={() => switchMethod("email")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-semibold transition-all",
                    loginMethod === "email"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span>Email OTP</span>
                </button>
              </div>

              {searchParams.get("reset") === "1" && (
                <div className="p-3.5 rounded-2xl bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 text-xs border border-green-200 dark:border-green-900/50 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Password reset successful. Please sign in with your new password.</span>
                </div>
              )}

              {searchParams.get("registered") === "true" && !searchParams.get("verified") && (
                <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs border border-blue-200 dark:border-blue-900/50 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Please check your email or mobile to verify your rider account before signing in.</span>
                </div>
              )}

              {searchParams.get("verified") === "1" && (
                <div className="p-3.5 rounded-2xl bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 text-xs border border-green-200 dark:border-green-900/50 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Account verified successfully. You can sign in now.</span>
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
                    <div className="ml-6 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={resendLoading || resendCooldown > 0}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline text-left disabled:opacity-50"
                      >
                        {resendCooldown > 0
                          ? `Resend code available in ${resendCooldown}s`
                          : resendLoading
                          ? "Resending code..."
                          : "Resend verification code"}
                      </button>
                      <Link
                        href={verifyEmailHref}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
                      >
                        Enter verification OTP
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Mode 1: Email / Mobile Number + Password (with 2FA OTP) */}
              {loginMethod === "password" && (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Email or Mobile Number
                    </Label>
                    <div className={cn("flex gap-2", !showPasswordCountryCode && "block")}>
                      {showPasswordCountryCode && (
                        <div className="w-[115px] shrink-0">
                          <CountryCodeSelect
                            value={passwordCountryCode}
                            onChange={(code) => setPasswordCountryCode(code)}
                            disabled={passwordLoading}
                            className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-xs"
                          />
                        </div>
                      )}
                      <div className="relative flex-1">
                        {showPasswordCountryCode ? (
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        ) : (
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        )}
                        <Input
                          type="text"
                          placeholder="rider@example.com or 76 123456"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          required
                          disabled={passwordLoading}
                          className="pl-10 h-11 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                        />
                      </div>
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
                        disabled={passwordLoading}
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
                    disabled={passwordLoading}
                    className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 mt-2"
                  >
                    {passwordLoading ? (
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
              )}

              {/* Mode 2 & Mode 3: Passwordless SMS OTP / Email OTP */}
              {(loginMethod === "sms" || loginMethod === "email") && !otpSentTarget && (
                <form onSubmit={handleSendPasswordlessOtp} className="space-y-4">
                  {loginMethod === "sms" ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Registered Mobile Number
                      </Label>
                      <div className="grid grid-cols-[115px_1fr] gap-2">
                        <CountryCodeSelect
                          value={smsCountryCode}
                          onChange={(code) => setSmsCountryCode(code)}
                          disabled={otpLoading}
                          className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-xs"
                        />
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            type="tel"
                            placeholder="76 123456 or 9876543210"
                            value={smsPhone}
                            onChange={(e) => setSmsPhone(e.target.value)}
                            required
                            disabled={otpLoading}
                            className="pl-10 h-11 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        We&apos;ll send a 6-digit login code to your mobile via SMS.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Registered Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="email"
                          placeholder="rider@example.com"
                          value={emailOtpAddress}
                          onChange={(e) => setEmailOtpAddress(e.target.value)}
                          required
                          disabled={otpLoading}
                          className="pl-10 h-11 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        We&apos;ll send a 6-digit one-time login code to your email.
                      </p>
                    </div>
                  )}

                  <TurnstileWidget onVerify={handleTurnstileVerify} resetKey={turnstileResetKey} />

                  <Button
                    type="submit"
                    disabled={otpLoading}
                    className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    {otpLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Sending OTP...
                      </>
                    ) : (
                      <>
                        {loginMethod === "sms" ? (
                          <Smartphone className="w-4 h-4" />
                        ) : (
                          <Mail className="w-4 h-4" />
                        )}
                        {loginMethod === "sms" ? "Send SMS OTP" : "Send Email OTP"}
                      </>
                    )}
                  </Button>
                </form>
              )}

              {(loginMethod === "sms" || loginMethod === "email") && otpSentTarget && (
                <form onSubmit={handleVerifyPasswordlessOtp} className="space-y-4">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {loginMethod === "sms" ? "SMS OTP sent to:" : "Email OTP sent to:"}
                      </p>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {otpSentTarget}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSentTarget(null)
                        setOtpCode("")
                        setError(null)
                        setResendSuccess(null)
                        setTurnstileToken("")
                        setTurnstileResetKey((k) => k + 1)
                      }}
                      className="text-[11px] font-semibold text-blue-600 hover:underline shrink-0"
                    >
                      Change
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      6-Digit Verification Code
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      disabled={otpLoading}
                      className="h-12 rounded-xl text-center text-base font-bold tracking-[0.4em] bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={otpLoading || otpCode.length !== 6}
                    className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    {otpLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Verifying & Signing In...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        Verify OTP & Sign In
                      </>
                    )}
                  </Button>

                  {otpResendCooldown <= 0 && (
                    <TurnstileWidget onVerify={handleTurnstileVerify} resetKey={turnstileResetKey} />
                  )}

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => handleSendPasswordlessOtp()}
                      disabled={otpLoading || otpResendCooldown > 0}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:no-underline hover:underline"
                    >
                      {otpResendCooldown > 0
                        ? `Resend OTP available in ${otpResendCooldown}s`
                        : "Didn't receive code? Resend OTP"}
                    </button>
                  </div>
                </form>
              )}

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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
