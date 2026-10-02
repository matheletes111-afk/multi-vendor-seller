"use client"

import { Suspense, useState, useEffect } from "react"
import { getCsrfToken } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { AlertCircle, Eye, EyeOff, ShieldCheck, Lock, ArrowRight, RefreshCw, Mail, Smartphone } from "lucide-react"

function BackofficeLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  useEffect(() => {
    getCsrfToken().then(setCsrfToken)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/backoffice/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          csrfToken: csrfToken ?? undefined,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Authentication failed.")
      }

      // Successful staff login -> redirect to first permitted module
      const target = json.redirectUrl || searchParams.get("callbackUrl") || "/admin"
      router.push(target)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Failed to log in.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      <div className="w-full max-w-md space-y-8 animate-in fade-in duration-500">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-3xl bg-blue-500/10 border border-blue-400/20 text-blue-400 shadow-inner mb-2">
            <ShieldCheck className="h-8 w-8" />
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
              Backoffice Staff Portal
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Administrative & Operational Access Only
            </p>
          </div>
        </div>

        {/* Card Form */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/50 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-red-950/50 border border-red-800/60 text-red-200 text-xs font-semibold flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Staff Email or Phone
              </Label>
              <Input
                type="text"
                required
                autoComplete="username"
                placeholder="staff.name@meeemsl.com or +232 77 123456"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-2xl h-12 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Password
                </Label>
                <Link
                  href="/backoffice/forgot-password"
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl h-12 font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Backoffice</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                <span className="bg-slate-900 px-3 text-slate-500">Or Continue With</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                asChild
                className="rounded-2xl h-11 text-xs font-bold bg-slate-950/40 border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <Link href={`/backoffice/login/email-otp${searchParams.get("callbackUrl") ? `?callbackUrl=${encodeURIComponent(searchParams.get("callbackUrl")!)}` : ""}`}>
                  <Mail className="h-4 w-4 text-blue-400" />
                  <span>Email OTP</span>
                </Link>
              </Button>

              <Button
                type="button"
                variant="outline"
                asChild
                className="rounded-2xl h-11 text-xs font-bold bg-slate-950/40 border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <Link href={`/backoffice/login/phone-otp${searchParams.get("callbackUrl") ? `?callbackUrl=${encodeURIComponent(searchParams.get("callbackUrl")!)}` : ""}`}>
                  <Smartphone className="h-4 w-4 text-emerald-400" />
                  <span>SMS OTP</span>
                </Link>
              </Button>
            </div>
          </form>

          <div className="pt-2 text-center border-t border-slate-800/80">
            <span className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <Lock className="h-3 w-3" />
              Secured with End-to-End Role Based Authentication
            </span>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-600">
          &copy; {new Date().getFullYear()} Meeem Platform Inc. All rights reserved.
        </div>
      </div>
    </div>
  )
}

export default function BackofficeLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading Staff Portal...</div>}>
      <BackofficeLoginForm />
    </Suspense>
  )
}
