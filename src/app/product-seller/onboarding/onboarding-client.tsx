"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import Checkbox from "@/ui/checkbox-v2"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { PageLoader } from "@/components/ui/page-loader"
import { ProfilePictureInput } from "@/components/profile-picture-input"
import { StoreLocationPicker } from "@/components/store-location-picker"
import { FileText, Image as ImageIcon, CheckCircle2, ChevronLeft, ChevronRight, Upload, Check, User, LogOut, Plus, X, Pencil } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"

type Step = 2 | 3 | 4 | 5 | 6 | 7

interface CategorySuggestion {
  id?: string;
  name: string;
  description: string;
  image: File | null;
  icon: File | null;
  imagePreview: string;
  iconPreview: string;
}

export function ProductOnboardingClient() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seller, setSeller] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [currentStep, setCurrentStep] = useState<Step>(2)
  const [showSuggestionForm, setShowSuggestionForm] = useState(false)
  const [suggestionsList, setSuggestionsList] = useState<CategorySuggestion[]>([])
  const [tempSuggestion, setTempSuggestion] = useState<Partial<CategorySuggestion>>({
    name: '',
    description: '',
    image: null,
    icon: null,
    imagePreview: '',
    iconPreview: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, { file: File, url: string }>>({})
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [agreements, setAgreements] = useState({
    agreedToTerms: false,
    agreedToCommission: false,
    agreedToReturnPolicy: false,
    agreedToPrivacy: false
  })
  const [haveGst, setHaveGst] = useState(false)

  useEffect(() => {
    if (seller) {
      if (seller.selectedCategories) {
        setSelectedCats(seller.selectedCategories.map((c: any) => c.id))
      }
      if (seller.agreement) {
        setAgreements({
          agreedToTerms: !!seller.agreement.agreedToTerms,
          agreedToCommission: !!seller.agreement.agreedToCommission,
          agreedToReturnPolicy: !!seller.agreement.agreedToReturnPolicy,
          agreedToPrivacy: !!seller.agreement.agreedToPrivacy
        })
      }
      if (seller.businessInfo) {
        setHaveGst(!!seller.businessInfo.haveGst)
      }
    }
  }, [seller])

  useEffect(() => {
    async function loadData() {
      try {
        const [sellerRes, catsRes] = await Promise.all([
          fetch("/api/product-seller/onboarding"),
          fetch("/api/categories")
        ])

        if (!sellerRes.ok) throw new Error("Failed to load seller data")
        const sellerData = await sellerRes.json()
        setSeller(sellerData)

        // Redirect if already completed
        if (sellerData.onboardingCompleted) {
          if (sellerData.isApproved) {
            router.push("/product-seller")
          } else {
            router.push("/product-seller/settings")
          }
          return
        }

        setCurrentStep(sellerData.onboardingStep as Step)

        if (sellerData.selectedCategories) {
          setSelectedCats(sellerData.selectedCategories.map((c: any) => c.id))
          
          // Populate suggestions list from inactive categories
          const suggestions = sellerData.selectedCategories
            .filter((c: any) => !c.isActive)
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              description: c.description || '',
              image: null,
              icon: null,
              imagePreview: c.image || '',
              iconPreview: c.mobileIcon || ''
            }))
          setSuggestionsList(suggestions)
        }

        if (catsRes.ok) {
          const catsData = await catsRes.json()
          setCategories(catsData.categories || [])
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
      if (currentStep === 5 || currentStep === 6) {
        // JSON submission for steps without files
        const data: any = {}
        if (currentStep === 5) {
          // If Step 5 has files or suggestions, we use FormData
          const logo = formData.get("storeLogo") as File | null
          const banner = formData.get("storeBanner") as File | null
          
          const hasFiles = (logo && logo.size > 0) || (banner && banner.size > 0) || suggestionsList.length > 0

          if (hasFiles) {
            // Append suggestions to formData
            formData.append("suggestionCount", suggestionsList.length.toString())
            suggestionsList.forEach((sug, i) => {
              if (sug.id) formData.append(`suggestion_id_${i}`, sug.id)
              formData.append(`suggestion_name_${i}`, sug.name)
              formData.append(`suggestion_description_${i}`, sug.description)
              if (sug.image) formData.append(`suggestion_image_${i}`, sug.image)
              if (sug.icon) formData.append(`suggestion_mobile_icon_${i}`, sug.icon)
            })

            res = await fetch("/api/product-seller/onboarding", {
              method: "POST",
              body: formData
            })
          } else {
            data.name = formData.get("storeName")
            data.description = formData.get("description")
            data.categoryIds = formData.getAll("categoryIds")
            res = await fetch("/api/product-seller/onboarding", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ step: currentStep, data })
            })
          }
        } else {
          // Step 6
          data.agreedToTerms = formData.get("agreedToTerms") === "on"
          data.agreedToCommission = formData.get("agreedToCommission") === "on"
          data.agreedToReturnPolicy = formData.get("agreedToReturnPolicy") === "on"
          data.agreedToPrivacy = formData.get("agreedToPrivacy") === "on"
          res = await fetch("/api/product-seller/onboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ step: currentStep, data })
          })
        }
      } else {
        res = await fetch("/api/product-seller/onboarding", {
          method: "POST",
          body: formData
        })
      }

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Failed to save step")

      if (result.completed) {
        // Refresh session to avoid middleware redirect loop
        await update({ onboardingCompleted: true, onboardingStep: 7 })
        // Instead of immediate redirect, move to the Success Step (Step 7)
        setCurrentStep(7)
        return
      }

      // Reload seller data to get updated URLs
      const updatedRes = await fetch("/api/product-seller/onboarding")
      const updatedData = await updatedRes.json()
      setSeller(updatedData)

      // Increment the step sequentially in the UI
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

  if (loading) return <PageLoader message="Preparing your onboarding..." />

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviews(prev => {
        // Revoke old object URL to avoid leaks
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
    const isPdf = (local?.file.type === "application/pdf") || (url?.toLowerCase().endsWith(".pdf"))

    return (
      <div className="mt-3 flex items-center gap-3 p-3 border rounded-xl bg-primary/5 border-primary/20 animate-in fade-in zoom-in-95">
        {isImage ? (
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border shadow-sm group">
            <img src={displayUrl} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
              <a href={displayUrl} target="_blank" rel="noreferrer" className="text-white text-[10px] font-medium">View</a>
            </div>
          </div>
        ) : isPdf ? (
          <div className="w-16 h-16 rounded-lg bg-red-50 flex flex-col items-center justify-center border border-red-100 text-red-600 shadow-sm transition-transform hover:scale-105">
            <FileText className="h-8 w-8" />
            <span className="text-[10px] font-bold">PDF</span>
          </div>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600 shadow-sm">
            <Upload className="h-8 w-8" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate text-primary">{label}</p>
          <p className="text-[10px] text-muted-foreground truncate italic">
            {local ? `Selected: ${local.file.name}` : "File already uploaded"}
          </p>
          <div className="flex gap-2">
            <a href={displayUrl} target="_blank" rel="noreferrer" className="text-xs text-primary font-medium hover:underline flex items-center gap-1 mt-1">
              {local ? "Preview Selected" : "Open Current"}
            </a>
          </div>
        </div>
      </div>
    )
  }

  const steps = [
    { id: 2, title: "Business Information" },
    { id: 3, title: "Identity Verification" },
    { id: 4, title: "Bank & Payouts" },
    { id: 5, title: "Store Setup" },
    { id: 6, title: "Agreement" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-300 via-purple-100 to-pink-100 flex items-center justify-center p-0 md:p-4">
      <div className="bg-white md:rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col md:flex-row overflow-hidden min-h-[700px] border border-white/20">
        {/* Sidebar Stepper */}
        <div className="w-full md:w-80 bg-emerald-50/40 p-8 flex flex-col border-r border-emerald-100/50">
          <div className="mb-12">
            <Image src="/images/logo.png" alt="Meeem" width={150} height={50} className="h-12 w-auto object-contain" />
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Create Account</h2>
            <p className="text-slate-500 text-sm mb-10">Product Seller Onboarding</p>

            <nav className="space-y-8 relative">
              {/* Vertical line connecting steps */}
              <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-200 z-0 hidden md:block"></div>

              {steps.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-4 relative z-10">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300",
                    currentStep > step.id ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" :
                      currentStep === step.id ? "bg-white text-emerald-600 border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]" :
                        "bg-slate-100 text-slate-400 border-2 border-transparent"
                  )}>
                    {currentStep > step.id ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <div className="flex flex-col">
                    <span className={cn(
                      "font-bold text-sm transition-colors",
                      currentStep === step.id ? "text-slate-800" : "text-slate-400"
                    )}>
                      {step.title}
                    </span>
                    {currentStep === step.id && (
                      <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider animate-pulse">In Progress</span>
                    )}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <div className="mt-auto pt-8 border-t border-emerald-100/50">
            {session?.user?.email && (
              <div className="px-4 mb-4">
                <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-emerald-100/50 border border-emerald-200/50 group transition-all">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-[10px] font-bold text-emerald-700 truncate" title={session.user.email}>
                    {session.user.email}
                  </span>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl px-4 py-6 transition-all"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="h-5 w-5" />
              <span className="font-bold text-sm">Logout</span>
            </Button>
            <p className="text-[10px] text-slate-400 mt-4 px-4">Need help? support@meeem.com</p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-white p-6 md:p-12 overflow-y-auto max-h-screen md:max-h-[850px] relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50/10 rounded-bl-full pointer-events-none -z-10 blur-3xl"></div>
          {error && (
            <Alert variant="destructive" className="mb-6 animate-in slide-in-from-top-2">
              <AlertTitle>Action Required</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="max-w-2xl mx-auto">
            {/* STEP 2: BUSINESS INFORMATION */}
            {currentStep === 2 && (
              <form onSubmit={handleNext} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-slate-900">Business Information</h1>
                  <p className="text-slate-500 mt-2">Please provide your legal business details and registration info.</p>
                </div>
                <div className="space-y-6">
                  <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-3xl bg-purple-50/20 border-purple-100 mb-6">
                    <Label className="text-lg font-bold mb-4">Profile Picture *</Label>
                    <ProfilePictureInput currentImage={seller.user?.image} fileInputName="profileImage" urlInputName="image" />
                    <p className="text-[10px] text-slate-400 mt-2 italic">This will be your official profile photo across the platform.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name *</Label>
                    <Input id="businessName" name="businessName" defaultValue={seller.businessInfo?.businessName || ""} required className="h-12 rounded-xl focus:ring-purple-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessType">Business Type *</Label>
                      <Select name="businessType" defaultValue={seller.businessInfo?.businessType || "Individual"}>
                        <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Individual">Individual</SelectItem>
                          <SelectItem value="Proprietor">Proprietor</SelectItem>
                          <SelectItem value="Partnership">Partnership</SelectItem>
                          <SelectItem value="Company">Company</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessRegNumber">Registration Number</Label>
                      <Input id="businessRegNumber" name="businessRegNumber" defaultValue={seller.businessInfo?.businessRegNumber || ""} className="h-12 rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800">GST Info</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="haveGst">Do you sell with GST? *</Label>
                        <Select
                          name="haveGst"
                          key={haveGst ? "yes" : "no"}
                          defaultValue={haveGst ? "true" : "false"}
                          onValueChange={(val) => setHaveGst(val === "true")}
                        >
                          <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="false">No</SelectItem>
                            <SelectItem value="true">Yes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {haveGst && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="gstCustomerName">Customer GST Name *</Label>
                            <Input id="gstCustomerName" name="gstCustomerName" defaultValue={seller.businessInfo?.gstCustomerName || ""} required={haveGst} className="h-12 rounded-xl" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="gstInvNo">Inv No *</Label>
                            <Input id="gstInvNo" name="gstInvNo" defaultValue={seller.businessInfo?.gstInvNo || ""} required={haveGst} className="h-12 rounded-xl" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxIdNumber">TIN No *</Label>
                    <Input id="taxIdNumber" name="taxIdNumber" defaultValue={seller.businessInfo?.taxIdNumber || ""} required className="h-12 rounded-xl" />
                  </div>
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="busRegCert" className="text-sm font-semibold">Business Registration Certificate</Label>
                    <div className="mt-2 p-6 border-2 border-dashed rounded-2xl bg-purple-50/30 border-purple-100 transition-colors hover:bg-purple-50/50">
                      <Input id="busRegCert" name="busRegCert" type="file" accept=".pdf,.jpg,.jpeg,.png" className="cursor-pointer" onChange={(e) => handleFileChange(e, "busRegCert")} />
                      {renderFilePreview("busRegCert", seller.businessInfo?.busRegCertUrl, "Registration Certificate")}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="space-y-2">
                      <Label htmlFor="street">Business Address (Street) *</Label>
                      <Input id="street" name="street" defaultValue={seller.businessInfo?.street || ""} required className="h-12 rounded-xl" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input id="city" name="city" defaultValue={seller.businessInfo?.city || ""} required className="h-12 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="district">District *</Label>
                        <Input id="district" name="district" defaultValue={seller.businessInfo?.district || ""} required className="h-12 rounded-xl" />
                      </div>
                      <div className="space-y-2" style={{ "display": "none" }}>
                        <Label htmlFor="postalCode">Postal Code</Label>
                        <Input id="postalCode" name="postalCode" defaultValue={seller.businessInfo?.postalCode || ""} className="h-12 rounded-xl" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-12 flex justify-end">
                  <Button type="submit" disabled={saving} className="h-12 px-10 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg transition-all hover:scale-[1.02]">
                    {saving ? "Saving..." : "Next Step"} <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}

            {/* STEP 3: KYC */}
            {currentStep === 3 && (
              <form onSubmit={handleNext} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-slate-900">Identity Verification</h1>
                  <p className="text-slate-500 mt-2">Mandatory KYC verification for security and fraud prevention.</p>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="nationIdentityNumber">National Identity Number (NIN) *</Label>
                    <Input id="nationIdentityNumber" name="nationIdentityNumber" defaultValue={seller.nationIdentityNumber || ""} required placeholder="Enter your 11-digit NIN" className="h-12 rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="idType">ID Type *</Label>
                      <Select name="idType" defaultValue={seller.kyc?.idType || "National ID Card"}>
                        <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select ID Type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="National ID Card">National ID Card</SelectItem>
                          <SelectItem value="Passport">Passport</SelectItem>
                          <SelectItem value="Driver's License">Driver's License</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idNumber">ID Number *</Label>
                      <Input id="idNumber" name="idNumber" defaultValue={seller.kyc?.idNumber || ""} required className="h-12 rounded-xl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="space-y-2">
                      <Label htmlFor="idFront" className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Upload ID Front *</Label>
                      <Input id="idFront" name="idFront" type="file" accept="image/*" onChange={(e) => handleFileChange(e, "idFront")} />
                      {renderFilePreview("idFront", seller.kyc?.idFrontUrl, "ID Front")}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idBack" className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Upload ID Back</Label>
                      <Input id="idBack" name="idBack" type="file" accept="image/*" onChange={(e) => handleFileChange(e, "idBack")} />
                      {renderFilePreview("idBack", seller.kyc?.idBackUrl, "ID Back")}
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <Label htmlFor="selfie" className="text-lg font-semibold flex items-center gap-2">
                      <User className="h-5 w-5 text-purple-600" /> Face Verification *
                    </Label>
                    <div className="flex items-center gap-4 p-6 border-2 border-dashed rounded-2xl bg-purple-50/20 border-purple-100">
                      <div className="p-4 bg-purple-100 rounded-full">
                        <Upload className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">Selfie Verification</p>
                        <p className="text-xs text-slate-500 mb-3">Upload a clear photo of yourself holding your ID card (optional) or just a selfie.</p>
                        <Input id="selfie" name="selfie" type="file" accept="image/*" className="cursor-pointer" onChange={(e) => handleFileChange(e, "selfie")} />
                        {renderFilePreview("selfie", seller.kyc?.selfieUrl, "Selfie Check")}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-12 flex justify-between">
                  <Button type="button" variant="ghost" onClick={handleBack} disabled={saving} className="h-12 px-8 rounded-full text-slate-500 hover:text-slate-900"><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button type="submit" disabled={saving} className="h-12 px-10 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg transition-all hover:scale-[1.02]">
                    {saving ? "Saving..." : "Next Step"} <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}

            {/* STEP 4: BANK DETAILS */}
            {currentStep === 4 && (
              <form onSubmit={handleNext} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-slate-900">Bank & Payment Details</h1>
                  <p className="text-slate-500 mt-2">How you would like to receive your payouts.</p>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name *</Label>
                    <Input id="bankName" name="bankName" defaultValue={seller.bankDetails?.bankName || ""} placeholder="e.g., Sierra Leone Commercial Bank" required className="h-12 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountHolderName">Account Holder Name *</Label>
                    <Input id="accountHolderName" name="accountHolderName" defaultValue={seller.bankDetails?.accountHolderName || ""} required className="h-12 rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">Account Number *</Label>
                      <Input id="accountNumber" name="accountNumber" defaultValue={seller.bankDetails?.accountNumber || ""} required className="h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branchName">Branch Name *</Label>
                      <Input id="branchName" name="branchName" defaultValue={seller.bankDetails?.branchName || ""} required className="h-12 rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-2 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <Label htmlFor="bankPassbook" className="text-sm font-semibold mb-2 block">Bank Document Proof *</Label>
                    <p className="text-xs text-slate-500 mb-3">Upload passbook front page or cancelled check</p>
                    <Input id="bankPassbook" name="bankPassbook" type="file" accept="image/*,.pdf" onChange={(e) => handleFileChange(e, "bankPassbook")} />
                    {renderFilePreview("bankPassbook", seller.bankDetails?.passbookUrl, "Bank Document")}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="space-y-2">
                      <Label>Mobile Money Option (Sierra Leone)</Label>
                      <Select name="mobileMoneyOption" defaultValue={seller.bankDetails?.mobileMoneyOption || "Orange Money"}>
                        <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select Mobile Money" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Orange Money">Orange Money</SelectItem>
                          <SelectItem value="Africell Money">Africell Money</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3 pt-2">
                      <Label className="text-sm font-semibold">Preferred Payout Method *</Label>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-slate-50 flex-1 transition-all">
                          <input type="radio" name="preferredPayoutMethod" value="Bank Transfer" className="w-4 h-4 accent-purple-600" defaultChecked={seller.bankDetails?.preferredPayoutMethod === "Bank Transfer"} />
                          <span className="text-sm font-medium text-slate-700">Bank Transfer</span>
                        </label>
                        {/* <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-slate-50 flex-1 transition-all">
                          <input type="radio" name="preferredPayoutMethod" value="Mobile Wallet" className="w-4 h-4 accent-purple-600" defaultChecked={seller.bankDetails?.preferredPayoutMethod === "Mobile Wallet"} />
                          <span className="text-sm font-medium text-slate-700">Mobile Wallet</span>
                        </label> */}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-12 flex justify-between">
                  <Button type="button" variant="ghost" onClick={handleBack} disabled={saving} className="h-12 px-8 rounded-full text-slate-500 hover:text-slate-900"><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button type="submit" disabled={saving} className="h-12 px-10 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg transition-all hover:scale-[1.02]">
                    {saving ? "Saving..." : "Next Step"} <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}

            {/* STEP 5: STORE SETUP */}
            {currentStep === 5 && (
              <form onSubmit={handleNext} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-slate-900">Store Setup</h1>
                  <p className="text-slate-500 mt-2">Tell us about your store and what you sell.</p>
                </div>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="storeName">Store Name *</Label>
                      <Input id="storeName" name="storeName" defaultValue={seller.store?.name || ""} required className="h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Store Description</Label>
                      <Textarea id="description" name="description" defaultValue={seller.store?.description || ""} rows={4} className="rounded-xl" />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800">Store Visuals</h2>
                    <p className="text-xs text-slate-500 mb-4">Upload your store logo and banner to personalize your profile.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="storeLogo" className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Store Logo *</Label>
                        <div className="mt-1 p-4 border-2 border-dashed rounded-2xl bg-purple-50/30 border-purple-100 transition-colors hover:bg-purple-50/50">
                          <Input id="storeLogo" name="storeLogo" type="file" accept="image/*" className="cursor-pointer" onChange={(e) => handleFileChange(e, "storeLogo")} />
                          {renderFilePreview("storeLogo", seller.store?.logo, "Store Logo")}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="storeBanner" className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Store Banner *</Label>
                        <div className="mt-1 p-4 border-2 border-dashed rounded-2xl bg-purple-50/30 border-purple-100 transition-colors hover:bg-purple-50/50">
                          <Input id="storeBanner" name="storeBanner" type="file" accept="image/*" className="cursor-pointer" onChange={(e) => handleFileChange(e, "storeBanner")} />
                          {renderFilePreview("storeBanner", seller.store?.banner, "Store Banner")}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800">Store Location</h2>
                    <p className="text-xs text-slate-500 mb-4">Search and pin your store address on the map. Coordinates are saved automatically.</p>
                    <StoreLocationPicker
                      initialLat={seller.store?.lat}
                      initialLng={seller.store?.lng}
                      initialAddress={seller.store?.address}
                    />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-semibold">Product Categories *</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "rounded-full border-purple-200 text-purple-600 hover:bg-purple-50 transition-all gap-1.5",
                          showSuggestionForm && "bg-purple-100 border-purple-300"
                        )}
                        onClick={() => setShowSuggestionForm(!showSuggestionForm)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Suggest New
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">Select all categories that you plan to sell in.</p>

                    {showSuggestionForm && (
                      <div className="p-6 border-2 border-dashed rounded-3xl bg-purple-50/30 border-purple-100 animate-in fade-in slide-in-from-top-4 duration-300 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white">
                              <Plus className="h-4 w-4" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-800">Suggest New Category</h3>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setShowSuggestionForm(false)} className="h-8 w-8 p-0 rounded-full hover:bg-purple-100 text-purple-600">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Category Name *</Label>
                            <Input
                              value={tempSuggestion.name}
                              onChange={(e) => setTempSuggestion(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="e.g., Handmade Crafts"
                              className="h-11 rounded-xl border-purple-100 focus:ring-purple-500 bg-white"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              value={tempSuggestion.description}
                              onChange={(e) => setTempSuggestion(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Briefly describe what products belong here..."
                              rows={2}
                              className="rounded-xl border-purple-100 focus:ring-purple-500 bg-white"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Category Banner *</Label>
                              <div className="relative">
                                <Input
                                  type="file"
                                  accept="image/*"
                                  className="h-11 rounded-xl border-purple-100 bg-white cursor-pointer"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                      setTempSuggestion(prev => ({ 
                                        ...prev, 
                                        image: file, 
                                        imagePreview: URL.createObjectURL(file) 
                                      }))
                                    }
                                  }}
                                />
                                {tempSuggestion.imagePreview && (
                                  <div className="mt-2 flex items-center gap-2 p-2 bg-white rounded-lg border border-purple-100 animate-in fade-in">
                                    <img src={tempSuggestion.imagePreview} className="w-8 h-8 rounded object-cover" />
                                    <span className="text-[10px] truncate max-w-[100px]">
                                      {tempSuggestion.image ? tempSuggestion.image.name : "Existing Image"}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Mobile Icon (PNG) *</Label>
                              <div className="relative">
                                <Input
                                  type="file"
                                  accept="image/*"
                                  className="h-11 rounded-xl border-purple-100 bg-white cursor-pointer"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                      setTempSuggestion(prev => ({ 
                                        ...prev, 
                                        icon: file, 
                                        iconPreview: URL.createObjectURL(file) 
                                      }))
                                    }
                                  }}
                                />
                                {tempSuggestion.iconPreview && (
                                  <div className="mt-2 flex items-center gap-2 p-2 bg-white rounded-lg border border-purple-100 animate-in fade-in">
                                    <img src={tempSuggestion.iconPreview} className="w-8 h-8 rounded object-cover" />
                                    <span className="text-[10px] truncate max-w-[100px]">
                                      {tempSuggestion.icon ? tempSuggestion.icon.name : "Existing Icon"}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button 
                            type="button" 
                            disabled={!tempSuggestion.name || (!tempSuggestion.image && !tempSuggestion.imagePreview) || (!tempSuggestion.icon && !tempSuggestion.iconPreview)}
                            onClick={() => {
                              setSuggestionsList(prev => [...prev, tempSuggestion as CategorySuggestion])
                              setTempSuggestion({ name: '', description: '', image: null, icon: null, imagePreview: '', iconPreview: '' })
                              setShowSuggestionForm(false)
                            }}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-11 transition-all flex items-center gap-2"
                          >
                            <Plus className="h-4 w-4" /> Add to List
                          </Button>
                        </div>
                        <p className="text-[10px] text-purple-400 italic bg-purple-50/50 p-2 rounded-lg border border-purple-100/50">
                          Note: Suggested categories will be sent to admin for approval. You can continue with other categories in the meantime.
                        </p>
                      </div>
                    )}

                    {/* List of current suggestions */}
                    {suggestionsList.length > 0 && (
                      <div className="space-y-3 mt-4 mb-6">
                         <Label className="text-xs uppercase tracking-wider text-purple-500 font-bold flex items-center gap-2">
                           <CheckCircle2 className="h-4 w-4" /> Added Suggestions ({suggestionsList.length})
                         </Label>
                         <div className="flex flex-wrap gap-3">
                           {suggestionsList.map((sug, idx) => (
                             <div key={idx} className="flex items-center gap-3 px-4 py-2 bg-purple-50 border border-purple-200 rounded-xl text-sm font-medium text-purple-800 shadow-sm animate-in zoom-in-95">
                               {sug.iconPreview && <img src={sug.iconPreview} className="w-5 h-5 rounded-full object-cover border border-purple-200 bg-white" />}
                               <span className="truncate max-w-[200px]">{sug.name}</span>
                               <div className="flex items-center gap-1 pl-2 border-l border-purple-200">
                                 <button 
                                   type="button" 
                                   onClick={() => {
                                     setTempSuggestion(sug)
                                     setShowSuggestionForm(true)
                                     setSuggestionsList(prev => prev.filter((_, i) => i !== idx))
                                   }}
                                   className="p-1 hover:bg-white rounded-md text-purple-500 hover:text-purple-700 transition-colors"
                                   title="Edit Suggestion"
                                 >
                                   <Pencil className="h-3.5 w-3.5" />
                                 </button>
                                 <button 
                                   type="button" 
                                   onClick={() => setSuggestionsList(prev => prev.filter((_, i) => i !== idx))}
                                   className="p-1 hover:bg-white rounded-md text-purple-500 hover:text-red-600 transition-colors"
                                   title="Remove Suggestion"
                                 >
                                   <X className="h-3.5 w-3.5" />
                                 </button>
                               </div>
                             </div>
                           ))}
                         </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                      {categories.map((cat: any) => {
                        const isSelected = selectedCats.includes(cat.id);
                        return (
                          <label key={cat.id} className={cn(
                            "flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-all",
                            isSelected ? "bg-purple-50 border-purple-500 ring-1 ring-purple-500" : "hover:bg-slate-50 border-slate-200"
                          )}>
                            <input
                              type="checkbox"
                              name="categoryIds"
                              value={cat.id}
                              className="w-4 h-4 accent-purple-600 rounded"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCats(prev => [...prev, cat.id])
                                } else {
                                  setSelectedCats(prev => prev.filter(id => id !== cat.id))
                                }
                              }}
                            />
                            <span className={cn("text-sm transition-colors", isSelected ? "text-purple-700 font-bold" : "text-slate-600 font-medium")}>{cat.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <div className="mt-12 flex justify-between">
                  <Button type="button" variant="ghost" onClick={handleBack} disabled={saving} className="h-12 px-8 rounded-full text-slate-500 hover:text-slate-900"><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button type="submit" disabled={saving || selectedCats.length === 0} className="h-12 px-10 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg transition-all hover:scale-[1.02]">
                    {saving ? "Saving..." : "Next Step"} <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}

            {/* STEP 6: AGREEMENT */}
            {currentStep === 6 && (
              <form onSubmit={handleNext} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-slate-900">Agreement & Compliance</h1>
                  <p className="text-slate-500 mt-2">Almost there! Please review and accept our terms.</p>
                </div>
                <div className="space-y-5 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  {[
                    { id: "agreedToTerms", label: "Accept Seller Terms & Conditions", sub: "I agree to the marketplace seller terms and operational guidelines." },
                    { id: "agreedToCommission", label: "Commission Agreement", sub: "I understand and agree to the commission structure for my categories." },
                    { id: "agreedToReturnPolicy", label: "Return & Refund Policy", sub: "I agree to follow the Meeem Return & Refund policy for customers." },
                    { id: "agreedToPrivacy", label: "Data Privacy Consent", sub: "I consent to the collection and processing of my business data." }
                  ].map((item) => (
                    <div key={item.id} className="flex items-start space-x-4 p-4 rounded-2xl hover:bg-white transition-colors cursor-pointer group">
                      <Checkbox
                        id={item.id}
                        name={item.id}
                        className="mt-1 w-5 h-5"
                        checked={(agreements as any)[item.id]}
                        onChange={(e: any) => setAgreements(prev => ({ ...prev, [item.id]: e.target.checked }))}
                        required
                      />
                      <div className="grid gap-1 leading-none cursor-pointer">
                        <Label htmlFor={item.id} className="text-base font-bold text-slate-800 cursor-pointer">{item.label}</Label>
                        <p className="text-xs text-slate-500">{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-12 flex justify-between">
                  <Button type="button" variant="ghost" onClick={handleBack} disabled={saving} className="h-12 px-8 rounded-full text-slate-500 hover:text-slate-900"><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button type="submit" className="h-12 px-10 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg transition-all hover:scale-[1.02]" disabled={saving || !Object.values(agreements).every(v => v)}>
                    {saving ? "Submitting..." : "Finish Registration"} <CheckCircle2 className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}

            {/* STEP 7: STATUS */}
            {currentStep === 7 && (
              <div className="py-12 animate-in zoom-in-95 duration-700 text-center">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <h1 className="text-4xl font-bold text-slate-900 mb-4">Onboarding Complete!</h1>
                <p className="text-slate-500 max-w-md mx-auto mb-10 leading-relaxed">
                  Your details have been successfully submitted. Our team is currently reviewing your documents.
                  You will receive an email once your account is fully activated.
                </p>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 mb-10 max-w-sm mx-auto">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-600">Account Status</span>
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full uppercase tracking-wider">Pending Review</span>
                  </div>
                  <p className="text-[11px] text-slate-400 text-left">Approval typically takes 24-48 hours. You can explore your settings in the meantime.</p>
                </div>
                <Button onClick={() => router.push("/product-seller/settings")} className="h-12 px-12 rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-xl transition-all">
                  Go to My Dashboard
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
