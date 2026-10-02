"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { AlertCircle, Mail, ArrowRight, RefreshCw, ShieldCheck, ArrowLeft } from "lucide-react"

function BackofficeEmailOtpRequestForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || ""
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/backoffice/auth/email-otp/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch OTP.")
      }

      const q = new URLSearchParams({
        email: email.trim(),
        ...(callbackUrl && { callbackUrl }),
      })
      router.push(`/backoffice/login/email-otp/verify?${q.toString()}`)
    } catch (err: any) {
      setError(err.message || "Failed to send OTP.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      <div className="w-full max-w-md space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-3xl bg-blue-500/10 border border-blue-400/20 text-blue-400 shadow-inner mb-2">
            <Mail className="h-8 w-8" />
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
              Email OTP Login
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              We'll send a 6-digit verification code to your official staff email
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

          <form onSubmit={handleSendOtp} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Staff Email Address
              </Label>
              <Input
                type="email"
                required
                autoComplete="email"
                placeholder="staff.name@meeemsl.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="rounded-2xl h-12 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-blue-500 text-sm"
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
                  <span>Dispatching OTP...</span>
                </>
              ) : (
                <>
                  <span>Send Login Code</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-2 text-center border-t border-slate-800/80">
            <Link
              href={`/backoffice/login${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
              className="text-xs font-bold text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Password Login</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BackofficeEmailOtpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>}>
      <BackofficeEmailOtpRequestForm />
    </Suspense>
  )
}
