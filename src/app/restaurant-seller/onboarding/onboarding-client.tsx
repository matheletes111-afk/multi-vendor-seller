"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import Checkbox from "@/ui/checkbox-v2"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { PageLoader } from "@/components/ui/page-loader"
import { ProfilePictureInput } from "@/components/profile-picture-input"
import { FileText, Image as ImageIcon, CheckCircle2, ChevronLeft, ChevronRight, Upload, Check, User, LogOut } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"

type Step = 2 | 3 | 4 | 5 | 6 | 7

const CUISINES = [
  "Italian", "Indian", "Chinese", "Japanese", "Mexican", "Thai", "French", "American", "Mediterranean", "Other"
]

const SERVICE_TYPES = [
  "Delivery", "Dine-in", "Takeaway"
]

export function RestaurantOnboardingClient() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seller, setSeller] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState<Step>(2)
  const [error, setError] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, { file: File, url: string }>>({})
  const [agreements, setAgreements] = useState({
    agreedToTerms: false,
    agreedToCommission: false,
    agreedToPrivacy: false
  })
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [haveGst, setHaveGst] = useState(false)

  useEffect(() => {
    if (seller) {
      if (seller.agreement) {
        setAgreements({
          agreedToTerms: !!seller.agreement.agreedToTerms,
          agreedToCommission: !!seller.agreement.agreedToCommission,
          agreedToPrivacy: !!seller.agreement.agreedToPrivacy
        })
      }
      if (seller.onboardingStep) {
        setCurrentStep(seller.onboardingStep as Step)
      }
      if (seller.businessInfo) {
        setHaveGst(!!seller.businessInfo.haveGst)
      }
      if (seller.primaryCuisine) {
        try {
          const c = JSON.parse(seller.primaryCuisine)
          if (Array.isArray(c)) setSelectedCuisines(c)
        } catch { /* ignore */ }
      }
      if (seller.serviceTypes) {
        try {
          const s = JSON.parse(seller.serviceTypes)
          if (Array.isArray(s)) setSelectedServices(s)
        } catch { /* ignore */ }
      }
    }
  }, [seller])

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/restaurant-seller/onboarding")
        if (!res.ok) throw new Error("Failed to load seller data")
        const sellerData = await res.json()
        setSeller(sellerData)

        if (sellerData.onboardingCompleted) {
          router.push("/restaurant-seller")
          return
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const formData = new FormData(e.currentTarget as HTMLFormElement)
    formData.append("step", currentStep.toString())

    try {
      let res: Response
      if (currentStep === 4) {
          formData.delete("cuisines")
          selectedCuisines.forEach(c => formData.append("cuisines", c))
          formData.delete("services")
          selectedServices.forEach(s => formData.append("services", s))
      }

      if (currentStep === 6) {
        const data = {
          step: 6,
          data: {
            agreedToTerms: formData.get("agreedToTerms") === "on",
            agreedToCommission: formData.get("agreedToCommission") === "on",
            agreedToPrivacy: formData.get("agreedToPrivacy") === "on"
          }
        }
        res = await fetch("/api/restaurant-seller/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        })
      } else {
        res = await fetch("/api/restaurant-seller/onboarding", {
          method: "POST",
          body: formData
        })
      }

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Failed to save step")

      if (result.completed) {
        await update({ onboardingCompleted: true, onboardingStep: 7 })
        setCurrentStep(7)
        return
      }

      const updatedRes = await fetch("/api/restaurant-seller/onboarding")
      const updatedData = await updatedRes.json()
      setSeller(updatedData)

      if (currentStep < 6) {
        setCurrentStep((currentStep + 1) as Step)
      }
      window.scrollTo(0, 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    if (currentStep > 2) {
      setCurrentStep((currentStep - 1) as Step)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const rawFile = e.target.files?.[0]
    if (rawFile) {
      let file: File = rawFile
      if (["logo", "banner", "mainPhoto"].includes(key)) {
        try {
          const { compressImage } = await import("@/lib/image-compressor")
          const compressed = await compressImage(rawFile)
          file = compressed
          
          const dataTransfer = new DataTransfer()
          dataTransfer.items.add(compressed)
          e.target.files = dataTransfer.files
        } catch (err) {
          console.error("Compression error:", err)
        }
      }
      const url = URL.createObjectURL(file)
      setPreviews(prev => {
        if (prev[key]) URL.revokeObjectURL(prev[key].url)
        return { ...prev, [key]: { file, url } }
      })
    }
  }

  const renderFilePreview = (key: string, url?: string, label?: string) => {
    const local = previews[key]
    const displayUrl = local ? local.url : url
    if (!displayUrl) return null

    const isImage = (local?.file.type.startsWith("image/")) || (url?.match(/\.(jpg|jpeg|png|webp|gif)$/i))

    return (
      <div className="mt-3 flex items-center gap-3 p-3 border rounded-xl bg-primary/5 border-primary/20">
        {isImage ? (
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border shadow-sm">
            <img src={displayUrl} alt={label} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-red-50 flex items-center justify-center border border-red-100 text-red-600">
            <FileText className="h-8 w-8" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate text-primary">{label}</p>
          <p className="text-[10px] text-muted-foreground truncate italic">
            {local ? `Selected: ${local.file.name}` : "File already uploaded"}
          </p>
        </div>
      </div>
    )
  }

  if (loading) return <PageLoader message="Preparing your onboarding..." />

  const steps = [
    { id: 2, title: "Business Info" },
    { id: 3, title: "KYC & License" },
    { id: 4, title: "Outlet Setup" },
    { id: 5, title: "Bank Details" },
    { id: 6, title: "Agreement" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-200 via-amber-50 to-orange-100/50 flex items-center justify-center p-0 md:p-4">
      <div className="bg-white md:rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col md:flex-row overflow-hidden min-h-[700px] border border-amber-100/50">
        {/* Sidebar */}
        <div className="w-full md:w-80 bg-gradient-to-b from-amber-950 to-slate-900 p-8 flex flex-col text-white">
          <div className="mb-12">
            <Image src="/images/logo.png" alt="Logo" width={150} height={50} className="h-10 w-auto invert" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-8 text-amber-50">Restaurant Onboarding</h2>
            <nav className="space-y-6">
              {steps.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-4">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all",
                    currentStep > step.id ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" :
                      currentStep === step.id ? "bg-white text-amber-950 border-2 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]" : "bg-amber-900/30 text-amber-300/60 border border-amber-800/30"
                  )}>
                    {currentStep > step.id ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={cn("text-sm transition-colors", currentStep === step.id ? "font-bold text-white" : currentStep > step.id ? "text-amber-200" : "text-amber-300/60")}>
                    {step.title}
                  </span>
                </div>
              ))}
            </nav>
          </div>
          <div className="mt-auto pt-8 border-t border-amber-900/40">
            <Button variant="ghost" className="w-full justify-start gap-3 text-amber-300 hover:text-white hover:bg-amber-900/30 rounded-xl" onClick={() => signOut({ callbackUrl: "/" })}>
              <LogOut className="h-5 w-5" /> Logout
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-12 overflow-y-auto max-h-screen md:max-h-[850px]">
          {error && <Alert variant="destructive" className="mb-6"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="max-w-2xl mx-auto">
            {currentStep === 2 && (
              <form onSubmit={handleNext} className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold">Business Information</h1>
                  <p className="text-slate-500 mt-2">Legal business details for your restaurant entity.</p>
                </div>
                <div className="p-6 border-2 border-dashed rounded-3xl bg-slate-50 flex flex-col items-center">
                  <Label className="mb-4 font-bold">Profile Picture *</Label>
                  <ProfilePictureInput currentImage={seller.user?.image} fileInputName="profileImage" urlInputName="image" />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Legal Business Name *</Label>
                    <Input id="businessName" name="businessName" defaultValue={seller.businessInfo?.businessName || ""} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessType">Business Type *</Label>
                      <Select name="businessType" defaultValue={seller.businessInfo?.businessType || "Individual"}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Individual">Individual</SelectItem>
                          <SelectItem value="Proprietor">Proprietor</SelectItem>
                          <SelectItem value="Partnership">Partnership</SelectItem>
                          <SelectItem value="Company">Company</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taxIdNumber">TIN / PAN Number *</Label>
                      <Input id="taxIdNumber" name="taxIdNumber" defaultValue={seller.businessInfo?.taxIdNumber || ""} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="managerName">Owner / Manager Name *</Label>
                      <Input id="managerName" name="managerName" defaultValue={seller.businessInfo?.managerName || ""} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pocContact">POC Contact Number *</Label>
                      <Input id="pocContact" name="pocContact" defaultValue={seller.businessInfo?.pocContact || ""} required />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="haveGst"
                        name="haveGst"
                        value="true"
                        checked={haveGst}
                        onChange={(e: any) => setHaveGst(e.target.checked)}
                      />
                      <Label htmlFor="haveGst" className="font-bold cursor-pointer text-slate-700">Does your business have GST?</Label>
                    </div>

                    {haveGst && (
                      <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 animate-in fade-in slide-in-from-top-1">
                        <div className="space-y-2">
                          <Label htmlFor="gstInvNo">GST Number *</Label>
                          <Input id="gstInvNo" name="gstInvNo" defaultValue={seller.businessInfo?.gstInvNo || ""} required={haveGst} placeholder="22AAAAA0000A1Z5" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="gstCustomerName">GST Customer Name *</Label>
                          <Input id="gstCustomerName" name="gstCustomerName" defaultValue={seller.businessInfo?.gstCustomerName || ""} required={haveGst} placeholder="Legal Entity Name" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="landmark">Landmark *</Label>
                    <Input id="landmark" name="landmark" defaultValue={seller.businessInfo?.landmark || ""} required />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input id="city" name="city" defaultValue={seller.businessInfo?.city || ""} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="district">Area *</Label>
                      <Input id="district" name="district" defaultValue={seller.businessInfo?.district || ""} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State *</Label>
                      <Input id="state" name="state" defaultValue={seller.businessInfo?.state || ""} required />
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="busRegCert">Business Registration Certificate *</Label>
                    <Input id="busRegCert" name="busRegCert" type="file" accept=".pdf,.jpg,.jpeg,.png" required={!seller.businessInfo?.busRegCertUrl} onChange={(e) => handleFileChange(e, "busRegCert")} />
                    {renderFilePreview("busRegCert", seller.businessInfo?.busRegCertUrl, "Reg Certificate")}
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="cityCouncilCert">City Council Certificate *</Label>
                    <Input id="cityCouncilCert" name="cityCouncilCert" type="file" accept=".pdf,.jpg,.jpeg,.png" required={!seller.businessInfo?.cityCouncilCertUrl} onChange={(e) => handleFileChange(e, "cityCouncilCert")} />
                    {renderFilePreview("cityCouncilCert", seller.businessInfo?.cityCouncilCertUrl, "City Council Certificate")}
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="gstTinCert">GST TIN Certificate *</Label>
                    <Input id="gstTinCert" name="gstTinCert" type="file" accept=".pdf,.jpg,.jpeg,.png" required={!seller.businessInfo?.gstTinCertUrl} onChange={(e) => handleFileChange(e, "gstTinCert")} />
                    {renderFilePreview("gstTinCert", seller.businessInfo?.gstTinCertUrl, "GST TIN Certificate")}
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="addressProof">Proof of Address (Edsa, Guma, etc.) *</Label>
                    <Input id="addressProof" name="addressProof" type="file" accept=".pdf,.jpg,.jpeg,.png" required={!seller.businessInfo?.addressProofUrl} onChange={(e) => handleFileChange(e, "addressProof")} />
                    {renderFilePreview("addressProof", seller.businessInfo?.addressProofUrl, "Proof of Address")}
                  </div>
                </div>
                <div className="mt-8 flex justify-end">
                  <Button type="submit" disabled={saving} className="rounded-full px-8 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-200/50 transition-all hover:scale-[1.02]">{saving ? "Saving..." : "Next Step"}</Button>
                </div>
              </form>
            )}

            {currentStep === 3 && (
              <form onSubmit={handleNext} className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold">Identity & License</h1>
                  <p className="text-slate-500 mt-2">Verification documents and Food License.</p>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="idType">ID Type *</Label>
                      <Select name="idType" defaultValue={seller.kyc?.idType || "National ID Card"}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="National ID Card">National ID Card</SelectItem>
                          <SelectItem value="Passport">Passport</SelectItem>
                          <SelectItem value="Driver's License">Driver's License</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idNumber">ID Number *</Label>
                      <Input id="idNumber" name="idNumber" defaultValue={seller.kyc?.idNumber || ""} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>ID Front *</Label>
                      <Input name="idFront" type="file" accept="image/*" onChange={(e) => handleFileChange(e, "idFront")} />
                      {renderFilePreview("idFront", seller.kyc?.idFrontUrl, "ID Front")}
                    </div>
                    <div className="space-y-2">
                      <Label>ID Back</Label>
                      <Input name="idBack" type="file" accept="image/*" onChange={(e) => handleFileChange(e, "idBack")} />
                      {renderFilePreview("idBack", seller.kyc?.idBackUrl, "ID Back")}
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t bg-amber-50 p-6 rounded-3xl border border-amber-100">
                    <Label className="text-amber-900 font-bold">Food License (FSSAI/etc.) *</Label>
                    <div className="mt-2 space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="foodLicenseNumber" className="text-xs text-amber-700">License Number</Label>
                        <Input id="foodLicenseNumber" name="foodLicenseNumber" defaultValue={seller.kyc?.foodLicenseNumber || ""} required className="bg-white border-amber-200" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-amber-700">Upload License Copy</Label>
                        <Input name="foodLicense" type="file" accept=".pdf,image/*" onChange={(e) => handleFileChange(e, "foodLicense")} className="bg-white border-amber-200" />
                        {renderFilePreview("foodLicense", seller.kyc?.foodLicenseUrl, "Food License")}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <Label>Selfie Verification *</Label>
                    <Input name="selfie" type="file" accept="image/*" onChange={(e) => handleFileChange(e, "selfie")} />
                    {renderFilePreview("selfie", seller.kyc?.selfieUrl, "Selfie")}
                  </div>
                </div>
                <div className="mt-8 flex justify-between">
                  <Button type="button" variant="ghost" onClick={handleBack} disabled={saving} className="rounded-full px-6 hover:bg-slate-100">Back</Button>
                  <Button type="submit" disabled={saving} className="rounded-full px-8 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-200/50 transition-all hover:scale-[1.02]">{saving ? "Saving..." : "Next Step"}</Button>
                </div>
              </form>
            )}

            {currentStep === 4 && (
              <form onSubmit={handleNext} className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold">Outlet Setup</h1>
                  <p className="text-slate-500 mt-2">Details about your restaurant outlet.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="estimateRestaurantCount">Estimate Restaurant Count *</Label>
                    <Input id="estimateRestaurantCount" name="estimateRestaurantCount" type="number" defaultValue={seller.estimateRestaurantCount || ""} required />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Primary Cuisines (Multi-select) *</Label>
                      <div className="grid grid-cols-1 gap-2 p-4 bg-slate-50 rounded-2xl border max-h-48 overflow-y-auto">
                        {CUISINES.map(cat => (
                          <label key={cat} className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={selectedCuisines.includes(cat)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedCuisines([...selectedCuisines, cat])
                                else setSelectedCuisines(selectedCuisines.filter(c => c !== cat))
                              }}
                            />
                            <span className="text-sm">{cat}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Service Types *</Label>
                      <div className="grid grid-cols-1 gap-2 p-4 bg-slate-50 rounded-2xl border">
                        {SERVICE_TYPES.map(type => (
                          <label key={type} className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={selectedServices.includes(type)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedServices([...selectedServices, type])
                                else setSelectedServices(selectedServices.filter(s => s !== type))
                              }}
                            />
                            <span className="text-sm">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>Restaurant Logo *</Label>
                      <Input name="logo" type="file" accept="image/*" onChange={(e) => handleFileChange(e, "logo")} />
                      {renderFilePreview("logo", seller.logo, "Logo")}
                    </div>
                    <div className="space-y-2">
                      <Label>Restaurant Banner *</Label>
                      <Input name="banner" type="file" accept="image/*" onChange={(e) => handleFileChange(e, "banner")} />
                      {renderFilePreview("banner", seller.banner, "Banner")}
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <Label>Main Restaurant Photo *</Label>
                    <Input name="mainPhoto" type="file" accept="image/*" onChange={(e) => handleFileChange(e, "mainPhoto")} />
                    {renderFilePreview("mainPhoto", seller.mainPhoto, "Main Photo")}
                  </div>
                </div>
                <div className="mt-8 flex justify-between">
                  <Button type="button" variant="ghost" onClick={handleBack} disabled={saving} className="rounded-full px-6 hover:bg-slate-100">Back</Button>
                  <Button type="submit" disabled={saving || selectedCuisines.length === 0 || selectedServices.length === 0} className="rounded-full px-8 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-200/50 transition-all hover:scale-[1.02]">{saving ? "Saving..." : "Next Step"}</Button>
                </div>
              </form>
            )}

            {currentStep === 5 && (
              <form onSubmit={handleNext} className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold">Bank Details</h1>
                  <p className="text-slate-500 mt-2">Where you want to receive payments.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name *</Label>
                    <Input id="bankName" name="bankName" defaultValue={seller.bankDetails?.bankName || ""} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountHolderName">Account Holder Name *</Label>
                    <Input id="accountHolderName" name="accountHolderName" defaultValue={seller.bankDetails?.accountHolderName || ""} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">Account Number *</Label>
                      <Input id="accountNumber" name="accountNumber" defaultValue={seller.bankDetails?.accountNumber || ""} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bbanNumber">BBAN Number *</Label>
                      <Input id="bbanNumber" name="bbanNumber" defaultValue={seller.bankDetails?.bbanNumber || ""} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="branchName">Branch Name / IFSC *</Label>
                      <Input id="branchName" name="branchName" defaultValue={seller.bankDetails?.branchName || ""} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankAddress">Bank Address *</Label>
                      <Input id="bankAddress" name="bankAddress" defaultValue={seller.bankDetails?.bankAddress || ""} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 pt-4 border-t">
                      <Label>Passbook / Cancelled Check Proof *</Label>
                      <Input name="passbook" type="file" accept="image/*,.pdf" onChange={(e) => handleFileChange(e, "passbook")} />
                      {renderFilePreview("passbook", seller.bankDetails?.passbookUrl, "Bank Proof")}
                    </div>
                    <div className="space-y-2 pt-4 border-t">
                      <Label>Attach Bank Letter with Acc number *</Label>
                      <Input name="bankLetter" type="file" accept="image/*,.pdf" onChange={(e) => handleFileChange(e, "bankLetter")} />
                      {renderFilePreview("bankLetter", seller.bankDetails?.bankLetterUrl, "Bank Letter")}
                    </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>Mobile Money Option *</Label>
                      <select name="mobileMoneyOption" defaultValue={seller.bankDetails?.mobileMoneyOption || "Orange Money"} className="w-full h-10 px-3 border rounded-md">
                        <option value="Orange Money">Orange Money</option>
                        <option value="Africell Money">Africell Money</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold block">Preferred Payout Method *</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="preferredPayoutMethod" value="Bank Transfer" defaultChecked={seller.bankDetails?.preferredPayoutMethod === "Bank Transfer"} />
                          <span>Bank Transfer</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="preferredPayoutMethod" value="Mobile Wallet" defaultChecked={seller.bankDetails?.preferredPayoutMethod === "Mobile Wallet" || seller.bankDetails?.preferredPayoutMethod === "Mobile Money"} />
                          <span>Mobile Money</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-8 flex justify-between">
                  <Button type="button" variant="ghost" onClick={handleBack} disabled={saving} className="rounded-full px-6 hover:bg-slate-100">Back</Button>
                  <Button type="submit" disabled={saving} className="rounded-full px-8 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-200/50 transition-all hover:scale-[1.02]">{saving ? "Saving..." : "Next Step"}</Button>
                </div>
              </form>
            )}

            {currentStep === 6 && (
              <form onSubmit={handleNext} className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold">Agreement</h1>
                  <p className="text-slate-500 mt-2">Accept our terms to finish registration.</p>
                </div>
                <div className="space-y-4 p-6 bg-slate-50 rounded-3xl border">
                  {[
                    { id: "agreedToTerms", label: "Accept Restaurant Seller Terms" },
                    { id: "agreedToCommission", label: "Agree to Commission Policy" },
                    { id: "agreedToPrivacy", label: "Data Privacy Consent" }
                  ].map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 hover:bg-white rounded-xl transition-colors">
                      <Checkbox 
                        id={item.id} 
                        name={item.id} 
                        checked={(agreements as any)[item.id]} 
                        onChange={(e: any) => setAgreements(prev => ({ ...prev, [item.id]: e.target.checked }))}
                        required 
                      />
                      <Label htmlFor={item.id} className="font-medium cursor-pointer">{item.label}</Label>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex justify-between">
                  <Button type="button" variant="ghost" onClick={handleBack} disabled={saving} className="rounded-full px-6 hover:bg-slate-100">Back</Button>
                  <Button type="submit" className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold px-8 shadow-lg shadow-emerald-100 transition-all hover:scale-[1.02]" disabled={saving || !Object.values(agreements).every(v => v)}>
                    {saving ? "Submitting..." : "Finish Registration"}
                  </Button>
                </div>
              </form>
            )}

            {currentStep === 7 && (
              <div className="py-12 text-center space-y-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Registration Complete!</h1>
                  <p className="text-slate-500 mt-4 max-w-md mx-auto">
                    Your restaurant account is pending review. We will notify you once approved.
                  </p>
                </div>
                <Button onClick={() => router.push("/restaurant-seller/settings")} className="rounded-full px-10 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-200/50 transition-all hover:scale-[1.02]">
                  Go to Dashboard
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
