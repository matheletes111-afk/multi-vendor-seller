"use client"

import React, { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
  User,
  Bike,
  FileCheck,
  MapPin,
  Lock,
  Laptop,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  Phone,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  Wallet,
  Building2,
} from "lucide-react"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import { Badge } from "@/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs"
import { DocUploadPreview } from "@/app/riderapp/components/doc-upload-preview"
import { VehicleTypeSelector } from "@/app/riderapp/components/vehicle-type-selector"
import { ZoneLocationPicker } from "@/app/riderapp/components/zone-location-picker"
import { validatePhoneAndCountryCode } from "@/lib/phone-validation"
import { CountryCodeSelect } from "@/ui/country-code-select"
import { ALLOWED_IMAGE_ONLY_ACCEPT, ALLOWED_DOC_ACCEPT } from "@/lib/onboarding-file-validation"

export function RiderSettingsClient({ user: initialUser }: { user: any }) {
  const { update } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Profile Fields
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [phoneCountryCode, setPhoneCountryCode] = useState("+232")
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)

  // Vehicle Fields
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([])
  const [vehicleName, setVehicleName] = useState("")
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [drivingLicenseNo, setDrivingLicenseNo] = useState("")

  // Documents
  const [nationalIdFile, setNationalIdFile] = useState<File | null>(null)
  const [nationalIdUrl, setNationalIdUrl] = useState<string | null>(null)
  const [drivingLicenseFile, setDrivingLicenseFile] = useState<File | null>(null)
  const [drivingLicenseUrl, setDrivingLicenseUrl] = useState<string | null>(null)
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null)
  const [insuranceUrl, setInsuranceUrl] = useState<string | null>(null)

  // Payment & Payout Details
  const [paymentOption, setPaymentOption] = useState<string>("Bank")
  const [bankName, setBankName] = useState("")
  const [accountHolderName, setAccountHolderName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [bbanNumber, setBbanNumber] = useState("")
  const [branchName, setBranchName] = useState("")
  const [bankAddress, setBankAddress] = useState("")
  const [mobileNumber, setMobileNumber] = useState("")
  const [agentNumber, setAgentNumber] = useState("")

  // Delivery Zones
  const [selectedZones, setSelectedZones] = useState<string[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])

  // Security
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Devices
  const [deviceTokens, setDeviceTokens] = useState<any[]>([])
  const [riderStatus, setRiderStatus] = useState<string | null>(null)
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null)

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true)
        const res = await fetch("/api/riderapp/settings")
        if (res.ok) {
          const json = await res.json()
          if (json.user) {
            setName(json.user.name || "")
            setEmail(json.user.email || "")
            setPhone(json.user.phone || "")
            setPhoneCountryCode(json.user.phoneCountryCode || "+232")
            setProfileImageUrl(json.user.image || null)
          }
          if (json.rider) {
            setRiderStatus(json.rider.status)
            setAdminFeedback(json.rider.adminFeedback || null)
            setVehicleTypes(json.rider.vehicleTypes || [])
            setVehicleName(json.rider.vehicleName || "")
            setVehicleNumber(json.rider.vehicleNumber || "")
            setDrivingLicenseNo(json.rider.drivingLicenseNo || "")
            setNationalIdUrl(json.rider.nationalIdDoc || null)
            setDrivingLicenseUrl(json.rider.drivingLicenseDoc || null)
            setInsuranceUrl(json.rider.vehicleInsuranceDoc || null)
            setSelectedZones(json.rider.selectedZones || [])
            setSelectedLocations(json.rider.selectedLocations || [])
            setDeviceTokens(json.rider.deviceTokens || [])
            if (json.rider.paymentOption) setPaymentOption(json.rider.paymentOption)
            if (json.rider.bankName) setBankName(json.rider.bankName)
            if (json.rider.accountHolderName) setAccountHolderName(json.rider.accountHolderName)
            if (json.rider.accountNumber) setAccountNumber(json.rider.accountNumber)
            if (json.rider.bbanNumber) setBbanNumber(json.rider.bbanNumber)
            if (json.rider.branchName) setBranchName(json.rider.branchName)
            if (json.rider.bankAddress) setBankAddress(json.rider.bankAddress)
            if (json.rider.mobileNumber) setMobileNumber(json.rider.mobileNumber)
            if (json.rider.agentNumber) setAgentNumber(json.rider.agentNumber)
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (newPassword) {
      if (newPassword.length < 6) {
        setError("New password must be at least 6 characters.")
        return
      }
      if (newPassword !== confirmPassword) {
        setError("New passwords do not match.")
        return
      }
    }

    if (phone.trim() || phoneCountryCode.trim()) {
      const pVal = validatePhoneAndCountryCode(phone, phoneCountryCode)
      if (!pVal.isValid) {
        setError(pVal.error || "Please enter a valid mobile number and country code.")
        return
      }
    }

    if ((paymentOption === "Orange Money" || paymentOption === "AfriMoney") && !mobileNumber.trim()) {
      setError(`Please enter your mobile phone number registered with ${paymentOption}.`)
      return
    }

    setSaving(true)

    try {
      const selectedVehicle = vehicleTypes[0] || "2_WHEELER"
      const formData = new FormData()
      formData.append("name", name.trim())
      formData.append("email", email.trim())
      formData.append("phone", phone.trim())
      formData.append("phoneCountryCode", phoneCountryCode.trim())
      formData.append("vehicleType", selectedVehicle)
      formData.append("vehicleTypes", JSON.stringify([selectedVehicle]))
      formData.append("vehicleName", vehicleName.trim())
      formData.append("vehicleNumber", vehicleNumber.trim())
      formData.append("drivingLicenseNo", drivingLicenseNo.trim())
      formData.append("selectedZones", JSON.stringify(selectedZones))
      formData.append("selectedLocations", JSON.stringify(selectedLocations))

      // Payment & Payout Details
      formData.append("paymentOption", paymentOption)
      formData.append("bankName", bankName.trim())
      formData.append("accountHolderName", accountHolderName.trim())
      formData.append("accountNumber", accountNumber.trim())
      formData.append("bbanNumber", bbanNumber.trim())
      formData.append("branchName", branchName.trim())
      formData.append("bankAddress", bankAddress.trim())
      formData.append("mobileNumber", mobileNumber.trim())
      formData.append("agentNumber", agentNumber.trim())

      if (currentPassword && newPassword) {
        formData.append("currentPassword", currentPassword)
        formData.append("newPassword", newPassword.trim())
      }

      if (profileImageFile) {
        formData.append("profileImage", profileImageFile)
      } else if (profileImageUrl) {
        formData.append("profileImageUrl", profileImageUrl)
      }

      if (nationalIdFile) {
        formData.append("nationalIdDoc", nationalIdFile)
      } else if (nationalIdUrl) {
        formData.append("nationalIdDocUrl", nationalIdUrl)
      }

      if (drivingLicenseFile) {
        formData.append("drivingLicenseDoc", drivingLicenseFile)
      } else if (drivingLicenseUrl) {
        formData.append("drivingLicenseDocUrl", drivingLicenseUrl)
      }

      if (insuranceFile) {
        formData.append("vehicleInsuranceDoc", insuranceFile)
      } else if (insuranceUrl) {
        formData.append("vehicleInsuranceDocUrl", insuranceUrl)
      }

      let res: Response
      try {
        res = await fetch("/api/riderapp/settings", {
          method: "POST",
          body: formData,
        })
      } catch (networkErr: any) {
        const netMsg = networkErr?.message || ""
        if (
          netMsg.includes("Failed to fetch") ||
          netMsg.includes("Load failed") ||
          netMsg.includes("NetworkError") ||
          netMsg.includes("too large")
        ) {
          throw new Error(
            "Upload failed (Network/File Size issue). Please ensure each uploaded document or photo is under 2.5 MB and your connection is stable, then try again."
          )
        }
        throw networkErr
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to update settings.")
      }

      const newPfp = data.rider?.profileImage || profileImageUrl
      if (data.rider?.profileImage) {
        setProfileImageUrl(data.rider.profileImage)
      }
      setProfileImageFile(null)

      setSuccess("Settings updated successfully!")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")

      if (update) {
        await update({
          name: name.trim(),
          image: newPfp,
        })
      }
    } catch (err: any) {
      let msg = err.message || "An unexpected error occurred."
      if (
        msg.includes("Failed to fetch") ||
        msg.includes("Load failed") ||
        msg.includes("NetworkError") ||
        msg.includes("too large")
      ) {
        msg =
          "Upload failed (Network/File Size issue). Please ensure each uploaded document or photo is under 2.5 MB and your connection is stable, then try again."
      }
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
        <p className="text-sm font-semibold text-foreground">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <span className="p-2 bg-blue-600/10 text-blue-600 rounded-xl">⚙️</span>
          Rider Account Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal profile, vehicle fleet details, verification documents, active delivery zones, and password.
        </p>
      </div>

      {/* Rejection notice if present */}
      {riderStatus === "REJECTED" && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-200 space-y-1 shadow-xs">
          <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4" />
            Correction Notice from Admin
          </div>
          <p>{adminFeedback || "Please review your documents and details and re-save to submit for review."}</p>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs border border-red-200 dark:border-red-900/50 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full rounded-2xl bg-muted/60 p-1.5 h-auto">
            <TabsTrigger value="profile" className="text-xs py-2 rounded-xl">Profile</TabsTrigger>
            <TabsTrigger value="vehicle" className="text-xs py-2 rounded-xl">Vehicle</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs py-2 rounded-xl">Documents</TabsTrigger>
            <TabsTrigger value="payout" className="text-xs py-2 rounded-xl">Payout & Bank</TabsTrigger>
            <TabsTrigger value="zones" className="text-xs py-2 rounded-xl">Delivery Zones</TabsTrigger>
            <TabsTrigger value="security" className="text-xs py-2 rounded-xl">Security & Devices</TabsTrigger>
          </TabsList>

          {/* PROFILE TAB */}
          <TabsContent value="profile" className="p-6 bg-card rounded-3xl border shadow-xs space-y-5 mt-4">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                Personal Profile
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Update your contact information and display photo.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Full Name</Label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Email Address (Optional)</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rider@example.com"
                  className="rounded-xl text-xs h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-[105px_1fr] gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Country Code</Label>
                <CountryCodeSelect
                  value={phoneCountryCode}
                  onChange={(code) => setPhoneCountryCode(code)}
                  className="rounded-xl text-xs h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Mobile Number</Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl text-xs h-10"
                />
              </div>
            </div>

            <div className="pt-2">
              <DocUploadPreview
                label="Profile Photo"
                description="Upload a clear portrait picture (JPG, PNG, WebP, HEIC)."
                accept={ALLOWED_IMAGE_ONLY_ACCEPT}
                cameraFacingMode="user"
                cameraGuideType="circle"
                cropAspectRatio="1:1"
                value={profileImageUrl}
                onChange={(file, preview) => {
                  setProfileImageFile(file)
                  setProfileImageUrl(preview || null)
                }}
              />
            </div>
          </TabsContent>

          {/* VEHICLE TAB */}
          <TabsContent value="vehicle" className="p-6 bg-card rounded-3xl border shadow-xs space-y-5 mt-4">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Bike className="w-4 h-4 text-blue-600" />
                Vehicle & Fleet Details
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select your operated vehicle types (multi-select 2, 3, or 4 wheeler).
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Operated Vehicle Types</Label>
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
                  className="rounded-xl text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Vehicle Plate Number</Label>
                <Input
                  type="text"
                  placeholder="e.g. SL-204-AB"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="rounded-xl text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Driving License Number</Label>
                <Input
                  type="text"
                  placeholder="e.g. DL-889021"
                  value={drivingLicenseNo}
                  onChange={(e) => setDrivingLicenseNo(e.target.value)}
                  className="rounded-xl text-xs h-10"
                />
              </div>
            </div>
          </TabsContent>

          {/* DOCUMENTS TAB */}
          <TabsContent value="documents" className="p-6 bg-card rounded-3xl border shadow-xs space-y-5 mt-4">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600" />
                Identity & Verification Documents
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inspect or replace uploaded identification documents with live PDF and image previews.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
              <DocUploadPreview
                label="National ID / Passport / Voter Card"
                accept={ALLOWED_DOC_ACCEPT}
                cameraFacingMode="environment"
                cameraGuideType="document"
                cropAspectRatio="free"
                value={nationalIdUrl}
                onChange={(file, preview) => {
                  setNationalIdFile(file)
                  setNationalIdUrl(preview || null)
                }}
              />

              <DocUploadPreview
                label="Driving License Document"
                accept={ALLOWED_DOC_ACCEPT}
                cameraFacingMode="environment"
                cameraGuideType="document"
                cropAspectRatio="free"
                value={drivingLicenseUrl}
                onChange={(file, preview) => {
                  setDrivingLicenseFile(file)
                  setDrivingLicenseUrl(preview || null)
                }}
              />

              <DocUploadPreview
                label="Vehicle Insurance / Registration"
                accept={ALLOWED_DOC_ACCEPT}
                cameraFacingMode="environment"
                cameraGuideType="document"
                cropAspectRatio="free"
                value={insuranceUrl}
                onChange={(file, preview) => {
                  setInsuranceFile(file)
                  setInsuranceUrl(preview || null)
                }}
              />
            </div>
          </TabsContent>

          {/* PAYOUT & PAYMENT TAB */}
          <TabsContent value="payout" className="p-6 bg-card rounded-3xl border shadow-xs space-y-5 mt-4">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Wallet className="w-4 h-4 text-blue-600" />
                Payout & Bank Details
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure where you receive earnings and tips from completed deliveries.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="settingsPaymentOption" className="text-xs font-semibold">
                  Payment Option *
                </Label>
                <select
                  id="settingsPaymentOption"
                  value={paymentOption}
                  onChange={(e) => setPaymentOption(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Bank">Bank</option>
                  <option value="Orange Money">Orange Money</option>
                  <option value="AfriMoney">AfriMoney</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Choose Bank for direct bank wire transfer, or Orange Money / AfriMoney for instant mobile wallet payouts.
                </p>
              </div>

              {paymentOption === "Bank" ? (
                <div className="space-y-4 p-4 rounded-2xl bg-muted/40 border animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 pb-1 border-b text-xs font-bold text-foreground">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Commercial Bank Account Information</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Bank Name *</Label>
                      <Input
                        type="text"
                        placeholder="e.g. Rokel Commercial Bank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="rounded-xl text-xs h-10 bg-background"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Account Holder Name *</Label>
                      <Input
                        type="text"
                        placeholder="Full name on bank account"
                        value={accountHolderName}
                        onChange={(e) => setAccountHolderName(e.target.value)}
                        className="rounded-xl text-xs h-10 bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Account Number *</Label>
                      <Input
                        type="text"
                        placeholder="e.g. 0102938475"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="rounded-xl text-xs h-10 bg-background"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">BBAN Number</Label>
                      <Input
                        type="text"
                        placeholder="Basic Bank Account Number (Optional)"
                        value={bbanNumber}
                        onChange={(e) => setBbanNumber(e.target.value)}
                        className="rounded-xl text-xs h-10 bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Branch Name / IFSC</Label>
                      <Input
                        type="text"
                        placeholder="e.g. Siaka Stevens Street Branch"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        className="rounded-xl text-xs h-10 bg-background"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Bank Address</Label>
                      <Input
                        type="text"
                        placeholder="e.g. Freetown, Sierra Leone"
                        value={bankAddress}
                        onChange={(e) => setBankAddress(e.target.value)}
                        className="rounded-xl text-xs h-10 bg-background"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3 pb-2 border-b border-amber-500/20">
                    <div className="w-9 h-9 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      {paymentOption === "Orange Money" ? "OM" : "AM"}
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-foreground">
                        {paymentOption} Mobile Wallet
                      </h5>
                      <p className="text-[11px] text-muted-foreground">
                        Fast automated mobile money payout directly to your mobile wallet.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Registered Mobile Number *</Label>
                      <Input
                        type="tel"
                        placeholder="e.g. 076123456 or +232 76 123456"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        className="rounded-xl text-xs h-10 bg-background"
                      />
                      <p className="text-[11px] text-muted-foreground">Phone number registered with {paymentOption}.</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        Agent / Merchant Code <span className="text-muted-foreground font-normal">(Optional)</span>
                      </Label>
                      <Input
                        type="text"
                        placeholder="e.g. AG-88231 (Optional)"
                        value={agentNumber}
                        onChange={(e) => setAgentNumber(e.target.value)}
                        className="rounded-xl text-xs h-10 bg-background"
                      />
                      <p className="text-[11px] text-muted-foreground">If you operate an agent/merchant till code.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ZONES TAB */}
          <TabsContent value="zones" className="p-6 bg-card rounded-3xl border shadow-xs space-y-5 mt-4">
            <ZoneLocationPicker
              selectedLocations={selectedLocations}
              onChange={(locs, zones) => {
                setSelectedLocations(locs)
                setSelectedZones(zones)
              }}
            />
          </TabsContent>

          {/* SECURITY & DEVICES TAB */}
          <TabsContent value="security" className="p-6 bg-card rounded-3xl border shadow-xs space-y-6 mt-4">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600" />
                Password & Security
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Change your account password or review registered devices.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Current Password</Label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="rounded-xl text-xs h-10 pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowCurrentPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">New Password</Label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="rounded-xl text-xs h-10 pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowNewPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="rounded-xl text-xs h-10 pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                <Laptop className="w-4 h-4 text-blue-600" />
                Active Devices & Notification Tokens
              </h4>

              <div className="space-y-2">
                {deviceTokens.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No active devices registered yet.</p>
                ) : (
                  deviceTokens.map((dev, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl border bg-muted/20 text-xs">
                      <div>
                        <span className="font-semibold text-foreground capitalize">
                          {dev.platform.replace("_", " ")}
                        </span>
                        <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[280px]">
                          {dev.token}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        Last active: {new Date(dev.lastActiveAt).toLocaleDateString()}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs h-11 px-8 shadow-sm gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving Changes...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save All Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
