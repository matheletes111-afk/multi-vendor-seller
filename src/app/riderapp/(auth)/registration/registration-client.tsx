"use client"

import React, { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Bike, Mail, Lock, User, Phone, ArrowRight, AlertCircle, RefreshCw, CheckCircle2, Eye, EyeOff } from "lucide-react"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import { CountryCodeSelect } from "@/ui/country-code-select"

export function RiderRegistrationClient() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phoneCountryCode, setPhoneCountryCode] = useState("+232")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [agreed, setAgreed] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    if (!agreed) {
      setError("Please agree to the Rider Terms and Guidelines.")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/riderapp/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          phoneCountryCode: phoneCountryCode.trim(),
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Registration failed. Please try again.")
      }

      setIsSubmitted(true)
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-sm border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Verify Your Email Address
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              We have sent a verification link to <strong>{email}</strong>. Please check your inbox and click the verification button to activate your rider account.
            </p>

            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl text-xs text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-900/50">
              💡 After verifying, log in to set up your delivery areas and profile.
            </div>

            <div className="pt-2">
              <Link href="/riderapp/login">
                <Button className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs">
                  Proceed to Rider Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
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
            Rider Registration
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Become a MEEEM Delivery Rider
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Sign up to deliver goods, food, and parcels across your preferred local zones.
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-sm border border-slate-200 dark:border-slate-800 rounded-3xl space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs border border-red-200 dark:border-red-900/50 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Full Name *
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="e.g. John Kamara"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                  className="pl-10 h-11 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email Address *
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

            <div className="grid grid-cols-[105px_1fr] gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Code *
                </Label>
                <CountryCodeSelect
                  value={phoneCountryCode}
                  onChange={(code) => setPhoneCountryCode(code)}
                  disabled={loading}
                  className="h-11 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mobile Number *
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="tel"
                    placeholder="76 123456"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-9 h-11 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Password *
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
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

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Confirm Password *
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pl-10 pr-10 h-11 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5"
              />
              <span>
                I agree to the{" "}
                <Link href="/terms-and-conditions" className="text-blue-600 underline">
                  Terms & Conditions
                </Link>{" "}
                and{" "}
                <Link href="/privacy-policy" className="text-blue-600 underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 mt-3"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Register as Rider
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-center">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Already registered?{" "}
              <Link
                href="/riderapp/login"
                className="font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
