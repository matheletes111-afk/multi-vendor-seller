"use client"

import { Suspense, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { CountryCodeSelect } from "@/ui/country-code-select"
import { AlertCircle, KeyRound, ArrowRight, RefreshCw, ArrowLeft, Mail, Phone } from "lucide-react"

function BackofficeForgotPasswordForm() {
  const router = useRouter()
  const [method, setMethod] = useState<"email" | "phone">("email")
  const [email, setEmail] = useState("")
  const [countryCode, setCountryCode] = useState("+232")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    let identifier = ""
    if (method === "email") {
      identifier = email.trim()
      if (!identifier) {
        setError("Please enter your registered staff email.")
        return
      }
    } else {
      const rawPhone = phone.trim()
      if (!rawPhone) {
        setError("Please enter your registered phone number.")
        return
      }
      if (!rawPhone.startsWith("+")) {
        const digits = rawPhone.replace(/\D/g, "")
        const noLeadingZero = digits.replace(/^0+/, "")
        const ccDigits = countryCode.replace(/\D/g, "")
        if (noLeadingZero.startsWith(ccDigits)) {
          identifier = `+${noLeadingZero}`
        } else {
          identifier = `${countryCode}${noLeadingZero}`
        }
      } else {
        identifier = rawPhone
      }
    }

    setLoading(true)
    try {
      const res = await fetch("/api/backoffice/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch password reset code.")
      }

      router.push(`/backoffice/reset-password?identifier=${encodeURIComponent(data.identifier || identifier)}`)
    } catch (err: any) {
      setError(err.message || "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      <div className="w-full max-w-md space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-3xl bg-blue-500/10 border border-blue-400/20 text-blue-400 shadow-inner mb-2">
            <KeyRound className="h-8 w-8" />
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
              Staff Password Recovery
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Receive a verification code to securely reset your staff account password
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/50 space-y-6">
          {/* Method selector */}
          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800">
            <button
              type="button"
              onClick={() => { setMethod("email"); setError("") }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                method === "email"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Via Email</span>
            </button>
            <button
              type="button"
              onClick={() => { setMethod("phone"); setError("") }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                method === "phone"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Phone className="h-3.5 w-3.5" />
              <span>Via SMS Phone</span>
            </button>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-red-950/50 border border-red-800/60 text-red-200 text-xs font-semibold flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {method === "email" ? (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Registered Staff Email
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
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Registered Mobile Number
                </Label>
                <div className="grid grid-cols-[115px_1fr] gap-2">
                  <CountryCodeSelect
                    value={countryCode}
                    onChange={(code) => setCountryCode(code)}
                    disabled={loading}
                    className="h-12 rounded-2xl text-xs bg-slate-950/60 border-slate-800 text-white"
                  />
                  <Input
                    type="tel"
                    placeholder="76 123456"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading}
                    required
                    className="rounded-2xl h-12 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-blue-500 text-sm font-medium"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl h-12 font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Requesting Code...</span>
                </>
              ) : (
                <>
                  <span>Send Recovery Code</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-2 text-center border-t border-slate-800/80">
            <Link
              href="/backoffice/login"
              className="text-xs font-bold text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Login</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BackofficeForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>}>
      <BackofficeForgotPasswordForm />
    </Suspense>
  )
}
