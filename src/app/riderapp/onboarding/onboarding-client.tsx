"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Image from "next/image"
import Link from "next/link"
import {
  Bike,
  Lock,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  MapPin,
  FileCheck,
  Truck,
  Sparkles,
} from "lucide-react"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import { Badge } from "@/ui/badge"
import { DocUploadPreview } from "@/app/riderapp/components/doc-upload-preview"
import { VehicleTypeSelector } from "@/app/riderapp/components/vehicle-type-selector"
import { ZoneLocationPicker } from "@/app/riderapp/components/zone-location-picker"
import { cn } from "@/lib/utils"
import { validatePhoneAndCountryCode } from "@/lib/phone-validation"
import { CountryCodeSelect } from "@/ui/country-code-select"

export function RiderOnboardingClient({ user: initialUser }: { user: any }) {
  const router = useRouter()
  const { data: session, update } = useSession()

  const [loadingInitial, setLoadingInitial] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<number>(1)

  // Step 1: Password
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const isFirstLogin = initialUser?.isFirstLogin ?? true

  // Step 2: Profile & Vehicle
  const [name, setName] = useState(initialUser?.name || "")
  const [phone, setPhone] = useState("")
  const [phoneCountryCode, setPhoneCountryCode] = useState("+232")
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(initialUser?.image || null)
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(["2_WHEELER"])
  const [vehicleName, setVehicleName] = useState("")
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [drivingLicenseNo, setDrivingLicenseNo] = useState("")

  // Step 3: Documents
  const [nationalIdFile, setNationalIdFile] = useState<File | null>(null)
  const [nationalIdUrl, setNationalIdUrl] = useState<string | null>(null)
  const [drivingLicenseFile, setDrivingLicenseFile] = useState<File | null>(null)
  const [drivingLicenseUrl, setDrivingLicenseUrl] = useState<string | null>(null)
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null)
  const [insuranceUrl, setInsuranceUrl] = useState<string | null>(null)

  // Step 4: Zones & Locations
  const [selectedZones, setSelectedZones] = useState<string[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])

  // Rejection feedback if applicable
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null)
  const [riderStatus, setRiderStatus] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/riderapp/settings")
        if (res.ok) {
          const data = await res.json()
          if (data.user) {
            if (data.user.name) setName(data.user.name)
            if (data.user.phone) setPhone(data.user.phone)
            if (data.user.phoneCountryCode) setPhoneCountryCode(data.user.phoneCountryCode)
            if (data.user.image) setProfileImageUrl(data.user.image)
          }
          if (data.rider) {
            setRiderStatus(data.rider.status)
            setAdminFeedback(data.rider.adminFeedback || null)
            if (data.rider.vehicleTypes?.length) setVehicleTypes(data.rider.vehicleTypes)
            if (data.rider.vehicleName) setVehicleName(data.rider.vehicleName)
            if (data.rider.vehicleNumber) setVehicleNumber(data.rider.vehicleNumber)
            if (data.rider.drivingLicenseNo) setDrivingLicenseNo(data.rider.drivingLicenseNo)
            if (data.rider.nationalIdDoc) setNationalIdUrl(data.rider.nationalIdDoc)
            if (data.rider.drivingLicenseDoc) setDrivingLicenseUrl(data.rider.drivingLicenseDoc)
            if (data.rider.vehicleInsuranceDoc) setInsuranceUrl(data.rider.vehicleInsuranceDoc)
            if (data.rider.selectedZones?.length) setSelectedZones(data.rider.selectedZones)
            if (data.rider.selectedLocations?.length) setSelectedLocations(data.rider.selectedLocations)
          }
        }
      } catch (err) {
        console.error("Failed to load initial rider data:", err)
      } finally {
        setLoadingInitial(false)
      }
    }

    loadData()
  }, [])

  const handleNextStep = () => {
    setError(null)
    if (currentStep === 1) {
      if (newPassword || confirmPassword) {
        if (newPassword.length < 6) {
          setError("Password must be at least 6 characters.")
          return
        }
        if (newPassword !== confirmPassword) {
          setError("Passwords do not match.")
          return
        }
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      if (!name.trim()) {
        setError("Please enter your full name.")
        return
      }
      if (!phone.trim()) {
        setError("Please enter your mobile phone number.")
        return
      }
      const pVal = validatePhoneAndCountryCode(phone, phoneCountryCode)
      if (!pVal.isValid) {
        setError(pVal.error || "Please enter a valid mobile number and country code.")
        return
      }
      if (vehicleTypes.length === 0 || !vehicleTypes[0]) {
        setError("Please select the single vehicle type you operate.")
        return
      }
      setCurrentStep(3)
    } else if (currentStep === 3) {
      setCurrentStep(4)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (selectedLocations.length === 0) {
      setError("Please select at least one delivery location in Step 4.")
      return
    }

    const pVal = validatePhoneAndCountryCode(phone, phoneCountryCode)
    if (!pVal.isValid) {
      setError(pVal.error || "Please enter a valid mobile number and country code.")
      return
    }

    setSubmitting(true)

    try {
      const selectedVehicle = vehicleTypes[0] || "2_WHEELER"
      const formData = new FormData()
      if (newPassword && newPassword.trim().length >= 6) {
        formData.append("newPassword", newPassword.trim())
      }
      formData.append("name", name.trim())
      formData.append("phone", pVal.cleanedPhone || phone.trim())
      formData.append("phoneCountryCode", pVal.cleanedCountryCode || phoneCountryCode.trim())
      formData.append("vehicleType", selectedVehicle)
      formData.append("vehicleTypes", JSON.stringify([selectedVehicle]))
      formData.append("vehicleName", vehicleName.trim())
      formData.append("vehicleNumber", vehicleNumber.trim())
      formData.append("drivingLicenseNo", drivingLicenseNo.trim())
      formData.append("selectedZones", JSON.stringify(selectedZones))
      formData.append("selectedLocations", JSON.stringify(selectedLocations))

      if (profileImageFile) {
        formData.append("profileImage", profileImageFile)
      }
      if (nationalIdFile) {
        formData.append("nationalIdDoc", nationalIdFile)
      }
      if (drivingLicenseFile) {
        formData.append("drivingLicenseDoc", drivingLicenseFile)
      }
      if (insuranceFile) {
        formData.append("vehicleInsuranceDoc", insuranceFile)
      }

      const res = await fetch("/api/riderapp/onboarding", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to save onboarding details.")
      }

      // Update NextAuth session
      if (update) {
        await update({
          name: name.trim(),
          image: profileImageUrl,
          onboardingCompleted: true,
          isFirstLogin: false,
        })
      }

      router.push("/riderapp")
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
      setSubmitting(false)
    }
  }

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Preparing your rider setup...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-sm">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Rider Onboarding & Area Setup
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Complete your profile, upload verification documents, and choose your active delivery zones.
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 font-medium"
          >
            ← Back to Marketplace
          </Link>
        </div>

        {/* Rejection Notice Banner */}
        {riderStatus === "REJECTED" && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-200 space-y-1 shadow-xs">
            <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300 text-sm">
              <AlertCircle className="w-4 h-4" />
              Correction Required Before Approval
            </div>
            <p className="leading-relaxed">
              {adminFeedback || "Your previous submission required corrections. Please update the requested information and re-submit for review."}
            </p>
          </div>
        )}

        {/* Stepper Indicator */}
        <div className="grid grid-cols-4 gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          {[
            { step: 1, label: "Security", icon: Lock },
            { step: 2, label: "Profile & Vehicle", icon: User },
            { step: 3, label: "Documents", icon: FileCheck },
            { step: 4, label: "Delivery Zones", icon: MapPin },
          ].map((s) => {
            const Icon = s.icon
            const isDone = currentStep > s.step
            const isCurrent = currentStep === s.step
            return (
              <button
                key={s.step}
                type="button"
                onClick={() => setCurrentStep(s.step)}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all select-none",
                  isCurrent
                    ? "bg-blue-600 text-white shadow-xs"
                    : isDone
                    ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                    : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.step}</span>
              </button>
            )
          })}
        </div>

        {/* Form Container */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 mb-6">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* STEP 1: PASSWORD */}
            {currentStep === 1 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Lock className="w-5 h-5 text-blue-600" />
                    Step 1: Set Your Account Password
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFirstLogin
                      ? "Create your personal secure password to replace your temporary login password."
                      : "Update your account password or leave blank to keep your current password."}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">New Password</Label>
                    <Input
                      type="password"
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="rounded-xl text-xs h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Confirm Password</Label>
                    <Input
                      type="password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="rounded-xl text-xs h-11"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl text-xs text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-900/40">
                  🔒 Your password will be encrypted and used for all future logins on web and mobile devices.
                </div>
              </div>
            )}

            {/* STEP 2: PROFILE & VEHICLES */}
            {currentStep === 2 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600" />
                    Step 2: Profile & Vehicle Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Provide your contact info and select the types of vehicles you deliver with.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Full Name *</Label>
                    <Input
                      type="text"
                      placeholder="e.g. Samuel Koroma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="rounded-xl text-xs h-11"
                    />
                  </div>

                  <div className="grid grid-cols-[105px_1fr] gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Code *</Label>
                      <CountryCodeSelect
                        value={phoneCountryCode}
                        onChange={(code) => setPhoneCountryCode(code)}
                        className="rounded-xl text-xs h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Mobile Number *</Label>
                      <Input
                        type="tel"
                        placeholder="e.g. 088994462 or 76123456"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        className="rounded-xl text-xs h-11"
                      />
                    </div>
                  </div>
                </div>

                {/* Profile Photo Upload */}
                <div className="space-y-1.5 pt-1">
                  <DocUploadPreview
                    label="Rider Profile Photo"
                    description="Clear headshot/portrait photo for customer and merchant identification."
                    accept="image/jpeg,image/png,image/webp"
                    value={profileImageUrl}
                    onChange={(file, preview) => {
                      setProfileImageFile(file)
                      if (preview) setProfileImageUrl(preview)
                    }}
                  />
                </div>

                {/* Vehicle Types Multi-Select */}
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>Operated Vehicle Types *</span>
                    <span className="text-muted-foreground font-normal text-[11px]">
                      (Select all that apply: 2, 3, or 4 wheeler)
                    </span>
                  </Label>
                  <VehicleTypeSelector
                    selectedTypes={vehicleTypes}
                    onChange={setVehicleTypes}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Vehicle Brand / Model</Label>
                    <Input
                      type="text"
                      placeholder="e.g. Honda CB Shine 125"
                      value={vehicleName}
                      onChange={(e) => setVehicleName(e.target.value)}
                      className="rounded-xl text-xs h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Vehicle Plate Number</Label>
                    <Input
                      type="text"
                      placeholder="e.g. SL-984-BD"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      className="rounded-xl text-xs h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Driving License Number</Label>
                    <Input
                      type="text"
                      placeholder="e.g. DL-449102"
                      value={drivingLicenseNo}
                      onChange={(e) => setDrivingLicenseNo(e.target.value)}
                      className="rounded-xl text-xs h-11"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: DOCUMENTS */}
            {currentStep === 3 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-blue-600" />
                    Step 3: Verification Documents
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Upload your valid identification documents. PDF and image formats are supported with live preview.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                  <DocUploadPreview
                    label="National ID / Passport / Voter Card"
                    description="Front side or full page scan (PDF or Image)."
                    value={nationalIdUrl}
                    onChange={(file, preview) => {
                      setNationalIdFile(file)
                      if (preview) setNationalIdUrl(preview)
                    }}
                  />

                  <DocUploadPreview
                    label="Driving License Document"
                    description="Valid rider/driver license (PDF or Image)."
                    value={drivingLicenseUrl}
                    onChange={(file, preview) => {
                      setDrivingLicenseFile(file)
                      if (preview) setDrivingLicenseUrl(preview)
                    }}
                  />

                  <DocUploadPreview
                    label="Vehicle Insurance / Registration"
                    description="Proof of insurance or vehicle registration (PDF or Image)."
                    value={insuranceUrl}
                    onChange={(file, preview) => {
                      setInsuranceFile(file)
                      if (preview) setInsuranceUrl(preview)
                    }}
                  />
                </div>
              </div>
            )}

            {/* STEP 4: ZONAL LOCATIONS */}
            {currentStep === 4 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    Step 4: Delivery Zones & Service Areas
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select the zones and individual neighborhoods where you are available to fulfill deliveries.
                  </p>
                </div>

                <ZoneLocationPicker
                  selectedLocations={selectedLocations}
                  onChange={(locs, zones) => {
                    setSelectedLocations(locs)
                    setSelectedZones(zones)
                  }}
                />
              </div>
            )}

            {/* Bottom Nav Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-800">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep((s) => s - 1)}
                  className="rounded-xl text-xs h-11 gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Previous Step
                </Button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs h-11 gap-1.5"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs h-11 px-6 gap-2 shadow-sm"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Submitting Onboarding...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Complete Setup & Enter Dashboard
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
