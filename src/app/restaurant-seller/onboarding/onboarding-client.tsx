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
import { FileText, Image as ImageIcon, CheckCircle2, ChevronLeft, ChevronRight, Upload, Check, User, LogOut, Camera, Crop, Eye, X } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { HEAR_ABOUT_US_OPTIONS, parseHearAboutUs, formatHearAboutUs } from "@/lib/onboarding-constants"
import { LegalTermsModal, LegalDocType } from "@/components/legal/legal-terms-modal"
import { validateOnboardingFile, ALLOWED_DOC_ACCEPT, ALLOWED_IMAGE_ONLY_ACCEPT, isPdfUrl, isImageUrl } from "@/lib/onboarding-file-validation"
import { ImageCropperModal, CropAspectRatio } from "@/components/media/image-cropper-modal"
import { CameraCaptureModal, CameraGuideType } from "@/components/media/camera-capture-modal"

type Step = 2 | 3 | 4 | 5 | 6 | 7

const CUISINES = [
  "Italian", "Indian", "Chinese", "Japanese", "Mexican", "Thai", "French", "American", "Mediterranean", "Continental", "Pizza", "Pasta", "Biryani", "Burgers", "Fast Food", "Salads", "Desserts", "Bakeries", "Beverages", "Arabic", "Turkish", "Lebanese", "Greek", "Spanish", "Korean", "Vietnamese", "African", "Caribbean", "Brazilian", "Steakhouse", "Seafood", "Sushi", "BBQ", "Sandwiches", "Healthy", "Vegan", "Ice Cream", "Coffee & Tea", "Juices", "Other"
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
  const [cameraTarget, setCameraTarget] = useState<{
    key: string
    label: string
    facingMode?: "user" | "environment"
    guideType?: CameraGuideType
    aspectRatio?: CropAspectRatio
  } | null>(null)
  const [cropTarget, setCropTarget] = useState<{
    key: string
    file: File
    label: string
    aspectRatio?: CropAspectRatio
  } | null>(null)
  const [agreements, setAgreements] = useState({
    agreedToTerms: false,
    agreedToCommission: false,
    agreedToReturnPolicy: false,
    agreedToPrivacy: false
  })
  const [activeLegalModal, setActiveLegalModal] = useState<LegalDocType | null>(null)
  const [hearAboutUs, setHearAboutUs] = useState("")
  const [hearAboutUsOther, setHearAboutUsOther] = useState("")
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [haveGst, setHaveGst] = useState(false)

  useEffect(() => {
    if (seller) {
      if (seller.agreement) {
        setAgreements({
          agreedToTerms: !!seller.agreement.agreedToTerms,
          agreedToCommission: !!seller.agreement.agreedToCommission,
          agreedToReturnPolicy: !!(seller.agreement.agreedToReturnPolicy ?? false),
          agreedToPrivacy: !!seller.agreement.agreedToPrivacy
        })
        if (seller.agreement.hearAboutUs) {
          const parsed = parseHearAboutUs(seller.agreement.hearAboutUs)
          setHearAboutUs(parsed.selected)
          setHearAboutUsOther(parsed.otherText)
        }
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

    const form = e.currentTarget as HTMLFormElement
    const formData = new FormData(form)
    formData.append("step", currentStep.toString())

    // Ensure compressed preview files for inputs in the current form are attached
    Object.entries(previews).forEach(([key, val]) => {
      if (val?.file) {
        formData.set(key, val.file)
      }
    })

    try {
      if (currentStep === 2) {
        const profileFile = formData.get("profileImage") as File | null
        const hasProfilePic = (profileFile && profileFile.size > 0) || seller?.user?.image || previews["profileImage"]?.file

        if (!hasProfilePic) {
          setError("Please upload your Profile Picture before proceeding.")
          setSaving(false)
          return
        }

        const hasBusReg = (formData.get("busRegCert") as File)?.size > 0 || seller?.businessInfo?.busRegCertUrl || previews["busRegCert"]?.file
        const hasGstCert = !haveGst || (formData.get("gstTinCert") as File)?.size > 0 || seller?.businessInfo?.gstTinCertUrl || previews["gstTinCert"]?.file

        if (!hasBusReg || !hasGstCert) {
          setError("Please upload mandatory business documents (Registration Certificate) before proceeding.")
          setSaving(false)
          return
        }
      }

      if (currentStep === 3) {
        const hasIdFront = (formData.get("idFront") as File)?.size > 0 || seller?.kyc?.idFrontUrl || previews["idFront"]?.file
        const hasIdBack = (formData.get("idBack") as File)?.size > 0 || seller?.kyc?.idBackUrl || previews["idBack"]?.file
        const hasLicense = (formData.get("foodLicense") as File)?.size > 0 || seller?.kyc?.foodLicenseUrl || previews["foodLicense"]?.file
        const hasSelfie = (formData.get("selfie") as File)?.size > 0 || seller?.kyc?.selfieUrl || previews["selfie"]?.file

        if (!hasIdFront || !hasIdBack || !hasLicense || !hasSelfie) {
          setError("Please upload all required identity documents: ID Front, ID Back, Food License Certificate, and Face Verification (Selfie).")
          setSaving(false)
          return
        }
      }

      if (currentStep === 4) {
        const hasLogo = (formData.get("logo") as File)?.size > 0 || seller?.logo || previews["logo"]?.file
        const hasMainPhoto = (formData.get("mainPhoto") as File)?.size > 0 || seller?.mainPhoto || previews["mainPhoto"]?.file

        if (!hasLogo || !hasMainPhoto) {
          setError("Please upload Restaurant Logo and Main Restaurant Photo.")
          setSaving(false)
          return
        }

        if (selectedCuisines.length === 0 || selectedServices.length === 0) {
          setError("Please select at least one primary cuisine and one service type.")
          setSaving(false)
          return
        }

        formData.delete("cuisines")
        selectedCuisines.forEach(c => formData.append("cuisines", c))
        formData.delete("services")
        selectedServices.forEach(s => formData.append("services", s))
      }

      if (currentStep === 5) {
        const preferredPayout = (formData.get("preferredPayoutMethod") as string)?.trim() || "Bank Transfer"
        formData.set("preferredPayoutMethod", preferredPayout)

        const bankName = (formData.get("bankName") as string)?.trim()
        const accountNumber = (formData.get("accountNumber") as string)?.trim()
        const bbanNumber = (formData.get("bbanNumber") as string)?.trim()
        const mobileMoney = (formData.get("mobileMoneyOption") as string)?.trim()

        if (!bankName && !mobileMoney) {
          setError("Please provide your Bank Name or Mobile Money option.")
          setSaving(false)
          return
        }
        if (!accountNumber && !bbanNumber && !mobileMoney) {
          setError("Please provide your Bank Account Number or BBAN Number.")
          setSaving(false)
          return
        }


      }

      let res: Response

      if (currentStep === 6) {
        if (!hearAboutUs || !hearAboutUs.trim()) {
          setError("Please select how you heard about us.")
          setSaving(false)
          return
        }
        if (hearAboutUs === "Other" && !hearAboutUsOther.trim()) {
          setError("Please specify where you heard about our platform.")
          setSaving(false)
          return
        }
        const rawSelected = hearAboutUs || (formData.get("hearAboutUs") as string) || null
        const rawOther = hearAboutUsOther || (formData.get("hearAboutUsOther") as string) || null
        const data = {
          step: 6,
          data: {
            agreedToTerms: agreements.agreedToTerms || formData.get("agreedToTerms") === "on",
            agreedToCommission: agreements.agreedToCommission || formData.get("agreedToCommission") === "on",
            agreedToPrivacy: agreements.agreedToPrivacy || formData.get("agreedToPrivacy") === "on",
            hearAboutUs: formatHearAboutUs(rawSelected, rawOther),
            hearAboutUsOther: rawOther,
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

      let result: any = {}
      try {
        const text = await res.text()
        result = text ? JSON.parse(text) : {}
      } catch (parseErr) {
        if (!res.ok) {
          throw new Error(`Server returned error (${res.status}). Please check your uploaded files.`)
        }
      }

      if (!res.ok) throw new Error(result.error || `Failed to save step (Status ${res.status})`)

      if (result.completed) {
        await update({ onboardingCompleted: true, onboardingStep: 7 })
        setCurrentStep(7)
        return
      }

      try {
        const updatedRes = await fetch("/api/restaurant-seller/onboarding")
        if (updatedRes.ok) {
          const updatedText = await updatedRes.text()
          if (updatedText) {
            const updatedData = JSON.parse(updatedText)
            setSeller(updatedData)
          }
        }
      } catch (reloadErr) {
        console.warn("Could not reload seller data:", reloadErr)
      }

      if (currentStep < 6) {
        setCurrentStep((currentStep + 1) as Step)
      }
      window.scrollTo(0, 0)
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    if (currentStep > 2) {
      setCurrentStep((currentStep - 1) as Step)
    }
  }

  const handleCroppedFile = async (key: string, rawFile: File) => {
    setError(null)
    let file: File = rawFile
    try {
      const { compressImage } = await import("@/lib/image-compressor")
      const compressed = await compressImage(rawFile, 1200, 1200, 0.8)
      file = compressed
    } catch (err) {
      console.error("Compression error:", err)
    }

    if (file.size > 4.5 * 1024 * 1024) {
      setError("File size exceeds 4.5 MB limit. Please select or compress a smaller file.")
      return
    }

    const url = URL.createObjectURL(file)
    setPreviews((prev) => {
      if (prev[key]) URL.revokeObjectURL(prev[key].url)
      return { ...prev, [key]: { file, url } }
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return
    setError(null)

    const imagesOnlyKeys = ["idFront", "idBack", "selfie", "logo", "banner", "mainPhoto", "profileImage"]
    const isImagesOnly = imagesOnlyKeys.includes(key)
    const validation = validateOnboardingFile(rawFile, { imagesOnly: isImagesOnly, maxSizeMb: 4.5 })

    if (!validation.isValid) {
      setError(validation.error || "Invalid file format. Only PDF and image files are allowed.")
      e.target.value = ""
      setPreviews(prev => {
        const copy = { ...prev }
        if (copy[key]) URL.revokeObjectURL(copy[key].url)
        delete copy[key]
        return copy
      })
      return
    }

    let file: File = rawFile
    if (rawFile.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(rawFile.name)) {
      try {
        const { compressImage } = await import("@/lib/image-compressor")
        const compressed = await compressImage(rawFile, 1200, 1200, 0.8)
        file = compressed
        
        try {
          const dataTransfer = new DataTransfer()
          dataTransfer.items.add(compressed)
          e.target.files = dataTransfer.files
        } catch (dtErr) {
          // Mobile Safari / WebKit read-only property handling
          console.warn("Could not set e.target.files via DataTransfer:", dtErr)
        }
      } catch (err) {
        console.error("Compression error:", err)
      }
    }

    if (file.size > 4.5 * 1024 * 1024) {
      setError("File size exceeds 4.5 MB limit. Please select or compress a smaller file.")
      e.target.value = ""
      setPreviews(prev => {
        const copy = { ...prev }
        if (copy[key]) URL.revokeObjectURL(copy[key].url)
        delete copy[key]
        return copy
      })
      return
    }

    const url = URL.createObjectURL(file)
    setPreviews(prev => {
      if (prev[key]) URL.revokeObjectURL(prev[key].url)
      return { ...prev, [key]: { file, url } }
    })
  }

  const renderFilePreview = (key: string, url?: string, label?: string, defaultRatio: CropAspectRatio = "free") => {
    const local = previews[key]
    const displayUrl = local ? local.url : url
    if (!displayUrl) return null

    const isImage = (local?.file.type.startsWith("image/")) || isImageUrl(url)
    const isPdf = (local?.file.type === "application/pdf") || isPdfUrl(url)

    return (
      <div className="mt-3 flex items-center justify-between p-3 border rounded-xl bg-primary/5 border-primary/20">
        <div className="flex items-center gap-3 min-w-0">
          {isImage ? (
            <div className="relative w-14 h-14 rounded-lg overflow-hidden border shadow-xs shrink-0">
              <img src={displayUrl} alt={label} className="w-full h-full object-cover" />
            </div>
          ) : isPdf ? (
            <div className="w-14 h-14 rounded-lg bg-red-50 flex flex-col items-center justify-center border border-red-100 text-red-600 shrink-0">
              <FileText className="h-6 w-6" />
              <span className="text-[8px] font-bold mt-0.5">PDF</span>
            </div>
          ) : (
            <div className="w-14 h-14 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200 text-slate-600 shrink-0">
              <FileText className="h-6 w-6" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-primary">{label}</p>
            <p className="text-[10px] text-muted-foreground truncate italic">
              {local ? `Selected: ${local.file.name}` : "File already uploaded (choose new file to replace)"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {isImage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (local?.file) {
                  setCropTarget({ key, file: local.file, label: label || key, aspectRatio: defaultRatio })
                } else if (url) {
                  fetch(url)
                    .then((res) => res.blob())
                    .then((blob) => {
                      const file = new File([blob], `${key}.jpg`, { type: blob.type || "image/jpeg" })
                      setCropTarget({ key, file, label: label || key, aspectRatio: defaultRatio })
                    })
                    .catch(() => window.open(url, "_blank"))
                }
              }}
              className="h-8 px-2.5 text-xs flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 shrink-0"
              title="Crop or Rotate"
            >
              <Crop className="w-3.5 h-3.5" />
              <span>Crop</span>
            </Button>
          )}

          <a
            href={displayUrl}
            target="_blank"
            rel="noreferrer"
            className="h-8 px-2.5 text-xs inline-flex items-center gap-1 rounded-lg border border-input bg-background hover:bg-accent text-accent-foreground shrink-0"
            title="View document"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View</span>
          </a>

          {local && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPreviews((prev) => {
                  const copy = { ...prev }
                  if (copy[key]) URL.revokeObjectURL(copy[key].url)
                  delete copy[key]
                  return copy
                })
              }}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
              title="Remove selected file"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
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

  const currentStepIndex = Math.max(0, steps.findIndex((s) => s.id === currentStep))
  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100)

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-200 via-amber-50 to-orange-100/50 flex items-center justify-center p-0 sm:p-2 md:p-4">
      <div className="bg-white md:rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col md:flex-row md:overflow-hidden md:min-h-[700px] border border-amber-100/50">
        {/* Mobile Header Bar */}
        <div className="md:hidden bg-gradient-to-r from-amber-950 to-slate-900 text-white px-4 py-2.5 sticky top-0 z-20 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Image src="/images/logo.png" alt="Logo" width={80} height={24} className="h-5 w-auto invert" />
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider bg-amber-900/60 px-2 py-0.5 rounded-full border border-amber-800/40">
                Restaurant
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-amber-200 hover:text-white hover:bg-amber-900/40 rounded-lg flex items-center gap-1"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="h-3 w-3" />
              <span>Logout</span>
            </Button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-amber-100">
                Step {currentStepIndex + 1} of {steps.length}: {steps[currentStepIndex]?.title}
              </span>
              <span className="text-amber-300 font-semibold">{progressPercent}%</span>
            </div>
            <div className="w-full h-1 bg-amber-950/60 rounded-full overflow-hidden border border-amber-800/40">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between pt-0.5">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={cn(
                    "h-1 rounded-full flex-1 mx-0.5 transition-all duration-300",
                    currentStep > step.id
                      ? "bg-amber-400"
                      : currentStep === step.id
                      ? "bg-white"
                      : "bg-amber-900/40"
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden md:flex md:w-80 bg-gradient-to-b from-amber-950 to-slate-900 p-8 flex-col text-white shrink-0">
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
        <div className="flex-1 p-4 sm:p-6 md:p-12 md:overflow-y-auto md:max-h-[850px]">
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
                  <ProfilePictureInput
                    currentImage={seller.user?.image}
                    fileInputName="profileImage"
                    urlInputName="image"
                    onImageChange={(file) => {
                      if (file) {
                        setPreviews((prev) => ({ ...prev, profileImage: { file, url: URL.createObjectURL(file) } }))
                      } else {
                        setPreviews((prev) => {
                          const copy = { ...prev }
                          delete copy.profileImage
                          return copy
                        })
                      }
                    }}
                  />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Legal Business Name *</Label>
                    <Input id="businessName" name="businessName" defaultValue={seller.businessInfo?.businessName || ""} required className="h-11 sm:h-12 rounded-xl" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessType">Business Type *</Label>
                      <Select name="businessType" defaultValue={seller.businessInfo?.businessType || "Individual"}>
                        <SelectTrigger className="h-11 sm:h-12 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
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
                      <Input id="taxIdNumber" name="taxIdNumber" defaultValue={seller.businessInfo?.taxIdNumber || ""} required className="h-11 sm:h-12 rounded-xl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="managerName">Owner / Manager Name *</Label>
                      <Input id="managerName" name="managerName" defaultValue={seller.businessInfo?.managerName || ""} required className="h-11 sm:h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pocContact">POC Contact Number *</Label>
                      <Input id="pocContact" name="pocContact" defaultValue={seller.businessInfo?.pocContact || ""} required className="h-11 sm:h-12 rounded-xl" />
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 animate-in fade-in slide-in-from-top-1">
                        <div className="space-y-2">
                          <Label htmlFor="gstInvNo">GST Number *</Label>
                          <Input id="gstInvNo" name="gstInvNo" defaultValue={seller.businessInfo?.gstInvNo || ""} required={haveGst} placeholder="22AAAAA0000A1Z5" className="h-11 sm:h-12 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="gstCustomerName">GST Customer Name *</Label>
                          <Input id="gstCustomerName" name="gstCustomerName" defaultValue={seller.businessInfo?.gstCustomerName || ""} required={haveGst} placeholder="Legal Entity Name" className="h-11 sm:h-12 rounded-xl" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="landmark">Landmark *</Label>
                    <Input id="landmark" name="landmark" defaultValue={seller.businessInfo?.landmark || ""} required className="h-11 sm:h-12 rounded-xl" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input id="city" name="city" defaultValue={seller.businessInfo?.city || ""} required className="h-11 sm:h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="district">Area *</Label>
                      <Input id="district" name="district" defaultValue={seller.businessInfo?.district || ""} required className="h-11 sm:h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State *</Label>
                      <Input id="state" name="state" defaultValue={seller.businessInfo?.state || ""} required className="h-11 sm:h-12 rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="busRegCert">Business Registration Certificate *</Label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input id="busRegCert" name="busRegCert" type="file" accept={ALLOWED_DOC_ACCEPT} required={!seller.businessInfo?.busRegCertUrl && !previews["busRegCert"]?.file} onChange={(e) => handleFileChange(e, "busRegCert")} className="h-11 sm:h-12 cursor-pointer file:cursor-pointer flex-1" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCameraTarget({ key: "busRegCert", label: "Registration Certificate", facingMode: "environment", guideType: "document" })}
                        className="h-10 px-3.5 text-xs flex items-center justify-center gap-1.5 shrink-0 rounded-xl border-amber-300 text-amber-900 bg-amber-50/60 hover:bg-amber-100 active:scale-95 w-full sm:w-auto"
                        title="Take photo with camera"
                      >
                        <Camera className="w-4 h-4 text-amber-700" />
                        <span>Take Photo</span>
                      </Button>
                    </div>
                    {renderFilePreview("busRegCert", seller.businessInfo?.busRegCertUrl, "Reg Certificate")}
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="cityCouncilCert">City Council Certificate (Optional)</Label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input id="cityCouncilCert" name="cityCouncilCert" type="file" accept={ALLOWED_DOC_ACCEPT} onChange={(e) => handleFileChange(e, "cityCouncilCert")} className="h-11 sm:h-12 cursor-pointer file:cursor-pointer flex-1" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCameraTarget({ key: "cityCouncilCert", label: "City Council Certificate", facingMode: "environment", guideType: "document" })}
                        className="h-10 px-3.5 text-xs flex items-center justify-center gap-1.5 shrink-0 rounded-xl border-amber-300 text-amber-900 bg-amber-50/60 hover:bg-amber-100 active:scale-95 w-full sm:w-auto"
                        title="Take photo with camera"
                      >
                        <Camera className="w-4 h-4 text-amber-700" />
                        <span>Take Photo</span>
                      </Button>
                    </div>
                    {renderFilePreview("cityCouncilCert", seller.businessInfo?.cityCouncilCertUrl, "City Council Certificate")}
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="gstTinCert">GST TIN Certificate {haveGst ? "*" : "(Optional)"}</Label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input id="gstTinCert" name="gstTinCert" type="file" accept={ALLOWED_DOC_ACCEPT} required={haveGst && !seller.businessInfo?.gstTinCertUrl && !previews["gstTinCert"]?.file} onChange={(e) => handleFileChange(e, "gstTinCert")} className="h-11 sm:h-12 cursor-pointer file:cursor-pointer flex-1" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCameraTarget({ key: "gstTinCert", label: "GST TIN Certificate", facingMode: "environment", guideType: "document" })}
                        className="h-10 px-3.5 text-xs flex items-center justify-center gap-1.5 shrink-0 rounded-xl border-amber-300 text-amber-900 bg-amber-50/60 hover:bg-amber-100 active:scale-95 w-full sm:w-auto"
                        title="Take photo with camera"
                      >
                        <Camera className="w-4 h-4 text-amber-700" />
                        <span>Take Photo</span>
                      </Button>
                    </div>
                    {renderFilePreview("gstTinCert", seller.businessInfo?.gstTinCertUrl, "GST TIN Certificate")}
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="addressProof">Proof of Address (Edsa, Guma, etc.) (Optional)</Label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input id="addressProof" name="addressProof" type="file" accept={ALLOWED_DOC_ACCEPT} onChange={(e) => handleFileChange(e, "addressProof")} className="h-11 sm:h-12 cursor-pointer file:cursor-pointer flex-1" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCameraTarget({ key: "addressProof", label: "Proof of Address", facingMode: "environment", guideType: "document" })}
                        className="h-10 px-3.5 text-xs flex items-center justify-center gap-1.5 shrink-0 rounded-xl border-amber-300 text-amber-900 bg-amber-50/60 hover:bg-amber-100 active:scale-95 w-full sm:w-auto"
                        title="Take photo with camera"
                      >
                        <Camera className="w-4 h-4 text-amber-700" />
                        <span>Take Photo</span>
                      </Button>
                    </div>
                    {renderFilePreview("addressProof", seller.businessInfo?.addressProofUrl, "Proof of Address")}
                  </div>
                </div>
                <div className="mt-8 sm:mt-12 flex justify-end pt-6 border-t border-slate-100">
                  <Button type="submit" disabled={saving} className="h-11 sm:h-12 rounded-full px-8 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-200/50 transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto">{saving ? "Saving..." : "Next Step"} <ChevronRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </form>
            )}

            {currentStep === 3 && (
              <form onSubmit={handleNext} className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">Identity & License</h1>
                  <p className="text-slate-500 mt-2 text-sm">Verification documents and Food License.</p>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="idType">ID Type *</Label>
                      <Select name="idType" defaultValue={seller.kyc?.idType || "National ID Card"}>
                        <SelectTrigger className="h-11 sm:h-12 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="National ID Card">National ID Card</SelectItem>
                          <SelectItem value="Passport">Passport</SelectItem>
                          <SelectItem value="Driver's License">Driver's License</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idNumber">ID Number *</Label>
                      <Input id="idNumber" name="idNumber" defaultValue={seller.kyc?.idNumber || ""} required className="h-11 sm:h-12 rounded-xl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>ID Front *</Label>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Input name="idFront" type="file" accept={ALLOWED_IMAGE_ONLY_ACCEPT} required={!seller.kyc?.idFrontUrl && !previews["idFront"]?.file} onChange={(e) => handleFileChange(e, "idFront")} className="h-11 sm:h-12 cursor-pointer file:cursor-pointer flex-1" />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCameraTarget({ key: "idFront", label: "ID Front", facingMode: "environment", guideType: "card", aspectRatio: "16:10" })}
                          className="h-10 px-3.5 text-xs flex items-center justify-center gap-1.5 shrink-0 rounded-xl border-amber-300 text-amber-900 bg-amber-50/60 hover:bg-amber-100 active:scale-95 w-full sm:w-auto"
                          title="Take photo with camera"
                        >
                          <Camera className="w-4 h-4 text-amber-700" />
                          <span>Take Photo</span>
                        </Button>
                      </div>
                      {renderFilePreview("idFront", seller.kyc?.idFrontUrl, "ID Front", "16:10")}
                    </div>
                    <div className="space-y-2">
                      <Label>ID Back *</Label>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Input name="idBack" type="file" accept={ALLOWED_IMAGE_ONLY_ACCEPT} required={!seller.kyc?.idBackUrl && !previews["idBack"]?.file} onChange={(e) => handleFileChange(e, "idBack")} className="h-11 sm:h-12 cursor-pointer file:cursor-pointer flex-1" />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCameraTarget({ key: "idBack", label: "ID Back", facingMode: "environment", guideType: "card", aspectRatio: "16:10" })}
                          className="h-10 px-3.5 text-xs flex items-center justify-center gap-1.5 shrink-0 rounded-xl border-amber-300 text-amber-900 bg-amber-50/60 hover:bg-amber-100 active:scale-95 w-full sm:w-auto"
                          title="Take photo with camera"
                        >
                          <Camera className="w-4 h-4 text-amber-700" />
                          <span>Take Photo</span>
                        </Button>
                      </div>
                      {renderFilePreview("idBack", seller.kyc?.idBackUrl, "ID Back", "16:10")}
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t bg-amber-50/60 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-amber-100">
                    <Label className="text-amber-900 font-bold">Food License (FSSAI/etc.) *</Label>
                    <div className="mt-2 space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="foodLicenseNumber" className="text-xs text-amber-700">License Number *</Label>
                        <Input id="foodLicenseNumber" name="foodLicenseNumber" defaultValue={seller.kyc?.foodLicenseNumber || ""} required className="bg-white border-amber-200 h-11 sm:h-12 rounded-xl" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-amber-700">Upload License Copy *</Label>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <Input name="foodLicense" type="file" accept={ALLOWED_DOC_ACCEPT} required={!seller.kyc?.foodLicenseUrl && !previews["foodLicense"]?.file} onChange={(e) => handleFileChange(e, "foodLicense")} className="bg-white border-amber-200 h-11 sm:h-12 cursor-pointer file:cursor-pointer flex-1 rounded-xl" />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCameraTarget({ key: "foodLicense", label: "Food License", facingMode: "environment", guideType: "document" })}
                            className="h-10 px-3.5 text-xs flex items-center justify-center gap-1.5 shrink-0 rounded-xl border-amber-300 text-amber-900 bg-white hover:bg-amber-100 active:scale-95 w-full sm:w-auto"
                            title="Take photo with camera"
                          >
                            <Camera className="w-4 h-4 text-amber-700" />
                            <span>Take Photo</span>
                          </Button>
                        </div>
                        {renderFilePreview("foodLicense", seller.kyc?.foodLicenseUrl, "Food License")}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <Label>Selfie Verification *</Label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input name="selfie" type="file" accept={ALLOWED_IMAGE_ONLY_ACCEPT} required={!seller.kyc?.selfieUrl && !previews["selfie"]?.file} onChange={(e) => handleFileChange(e, "selfie")} className="h-11 sm:h-12 cursor-pointer file:cursor-pointer flex-1" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCameraTarget({ key: "selfie", label: "Selfie", facingMode: "user", guideType: "circle", aspectRatio: "1:1" })}
                        className="h-10 px-3.5 text-xs flex items-center justify-center gap-1.5 shrink-0 rounded-xl border-amber-300 text-amber-900 bg-amber-50/60 hover:bg-amber-100 active:scale-95 w-full sm:w-auto"
                        title="Take selfie with camera"
                      >
                        <Camera className="w-4 h-4 text-amber-700" />
                        <span>Take Selfie</span>
                      </Button>
                    </div>
                    {renderFilePreview("selfie", seller.kyc?.selfieUrl, "Selfie", "1:1")}
                  </div>
                </div>
                <div className="mt-8 sm:mt-12 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t border-slate-100">
                  <Button type="button" variant="ghost" onClick={handleBack} disabled={saving} className="h-11 sm:h-12 px-6 rounded-full hover:bg-slate-100 w-full sm:w-auto"><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button type="submit" disabled={saving} className="h-11 sm:h-12 rounded-full px-8 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-200/50 transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto">{saving ? "Saving..." : "Next Step"} <ChevronRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </form>
            )}

            {currentStep === 4 && (
              <form onSubmit={handleNext} className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">Outlet Setup</h1>
                  <p className="text-slate-500 mt-2 text-sm">Details about your restaurant outlet.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="estimateRestaurantCount">Estimate Restaurant Count *</Label>
                    <Input id="estimateRestaurantCount" name="estimateRestaurantCount" type="number" defaultValue={seller.estimateRestaurantCount || ""} required className="h-11 sm:h-12 rounded-xl" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>Restaurant Logo *</Label>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Input name="logo" type="file" accept={ALLOWED_IMAGE_ONLY_ACCEPT} required={!seller.logo && !previews["logo"]} onChange={(e) => handleFileChange(e, "logo")} className="h-11 sm:h-12 cursor-pointer file:cursor-pointer flex-1" />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCameraTarget({ key: "logo", label: "Restaurant Logo", facingMode: "environment", guideType: "circle", aspectRatio: "1:1" })}
                          className="h-10 px-3.5 text-xs flex items-center justify-center gap-1.5 shrink-0 rounded-xl border-amber-300 text-amber-900 bg-amber-50/60 hover:bg-amber-100 active:scale-95 w-full sm:w-auto"
                          title="Take photo with camera"
                        >
                          <Camera className="w-4 h-4 text-amber-700" />
                          <span>Take Photo</span>
                        </Button>
                      </div>
                      {renderFilePreview("logo", seller.logo, "Logo", "1:1")}
                    </div>
                    <div className="space-y-2">
                      <Label>Restaurant Banner (Optional)</Label>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Input name="banner" type="file" accept={ALLOWED_IMAGE_ONLY_ACCEPT} onChange={(e) => handleFileChange(e, "banner")} className="h-11 sm:h-12 cursor-pointer file:cursor-pointer flex-1" />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCameraTarget({ key: "banner", label: "Restaurant Banner", facingMode: "environment", guideType: "none", aspectRatio: "16:9" })}
                          className="h-10 px-3.5 text-xs flex items-center justify-center gap-1.5 shrink-0 rounded-xl border-amber-300 text-amber-900 bg-amber-50/60 hover:bg-amber-100 active:scale-95 w-full sm:w-auto"
                          title="Take photo with camera"
                        >
                          <Camera className="w-4 h-4 text-amber-700" />
                          <span>Take Photo</span>
                        </Button>
                      </div>
                      {renderFilePreview("banner", seller.banner, "Banner", "16:9")}
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <Label>Main Restaurant Photo *</Label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input name="mainPhoto" type="file" accept={ALLOWED_IMAGE_ONLY_ACCEPT} required={!seller.mainPhoto && !previews["mainPhoto"]} onChange={(e) => handleFileChange(e, "mainPhoto")} className="h-11 sm:h-12 cursor-pointer file:cursor-pointer flex-1" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCameraTarget({ key: "mainPhoto", label: "Main Restaurant Photo", facingMode: "environment", guideType: "none", aspectRatio: "4:3" })}
                        className="h-10 px-3.5 text-xs flex items-center justify-center gap-1.5 shrink-0 rounded-xl border-amber-300 text-amber-900 bg-amber-50/60 hover:bg-amber-100 active:scale-95 w-full sm:w-auto"
                        title="Take photo with camera"
                      >
                        <Camera className="w-4 h-4 text-amber-700" />
                        <span>Take Photo</span>
                      </Button>
                    </div>
                    {renderFilePreview("mainPhoto", seller.mainPhoto, "Main Photo", "4:3")}
                  </div>
                </div>
                <div className="mt-8 sm:mt-12 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t border-slate-100">
                  <Button type="button" variant="ghost" onClick={handleBack} disabled={saving} className="h-11 sm:h-12 px-6 rounded-full hover:bg-slate-100 w-full sm:w-auto"><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button type="submit" disabled={saving || selectedCuisines.length === 0 || selectedServices.length === 0} className="h-11 sm:h-12 rounded-full px-8 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-200/50 transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto">{saving ? "Saving..." : "Next Step"} <ChevronRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </form>
            )}

            {currentStep === 5 && (
              <form onSubmit={handleNext} className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">Bank Details</h1>
                  <p className="text-slate-500 mt-2 text-sm">Where you want to receive payments.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name *</Label>
                    <Input id="bankName" name="bankName" defaultValue={seller.bankDetails?.bankName || ""} required className="h-11 sm:h-12 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountHolderName">Account Holder Name *</Label>
                    <Input id="accountHolderName" name="accountHolderName" defaultValue={seller.bankDetails?.accountHolderName || ""} required className="h-11 sm:h-12 rounded-xl" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">Account Number *</Label>
                      <Input id="accountNumber" name="accountNumber" defaultValue={seller.bankDetails?.accountNumber || ""} required className="h-11 sm:h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bbanNumber">BBAN Number *</Label>
                      <Input id="bbanNumber" name="bbanNumber" defaultValue={seller.bankDetails?.bbanNumber || ""} required className="h-11 sm:h-12 rounded-xl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="branchName">Branch Name / IFSC *</Label>
                      <Input id="branchName" name="branchName" defaultValue={seller.bankDetails?.branchName || ""} required className="h-11 sm:h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankAddress">Bank Address *</Label>
                      <Input id="bankAddress" name="bankAddress" defaultValue={seller.bankDetails?.bankAddress || ""} required className="h-11 sm:h-12 rounded-xl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2 pt-4 border-t">
                      <Label>Bank Passbook / Cheque Copy (Optional)</Label>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Input name="passbook" type="file" accept={ALLOWED_DOC_ACCEPT} onChange={(e) => handleFileChange(e, "passbook")} className="h-11 sm:h-12 cursor-pointer file:cursor-pointer flex-1" />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCameraTarget({ key: "passbook", label: "Bank Passbook", facingMode: "environment", guideType: "document" })}
                          className="h-10 px-3.5 text-xs flex items-center justify-center gap-1.5 shrink-0 rounded-xl border-amber-300 text-amber-900 bg-amber-50/60 hover:bg-amber-100 active:scale-95 w-full sm:w-auto"
                          title="Take photo with camera"
                        >
                          <Camera className="w-4 h-4 text-amber-700" />
                          <span>Take Photo</span>
                        </Button>
                      </div>
                      {renderFilePreview("passbook", seller.bankDetails?.passbookUrl, "Bank Proof")}
                    </div>
                    <div className="space-y-2 pt-4 border-t">
                      <Label>Bank Letter / Reference (Optional)</Label>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Input name="bankLetter" type="file" accept={ALLOWED_DOC_ACCEPT} onChange={(e) => handleFileChange(e, "bankLetter")} className="h-11 sm:h-12 cursor-pointer file:cursor-pointer flex-1" />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCameraTarget({ key: "bankLetter", label: "Bank Letter", facingMode: "environment", guideType: "document" })}
                          className="h-10 px-3.5 text-xs flex items-center justify-center gap-1.5 shrink-0 rounded-xl border-amber-300 text-amber-900 bg-amber-50/60 hover:bg-amber-100 active:scale-95 w-full sm:w-auto"
                          title="Take photo with camera"
                        >
                          <Camera className="w-4 h-4 text-amber-700" />
                          <span>Take Photo</span>
                        </Button>
                      </div>
                      {renderFilePreview("bankLetter", seller.bankDetails?.bankLetterUrl, "Bank Letter")}
                    </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>Mobile Money Option *</Label>
                      <select name="mobileMoneyOption" defaultValue={seller.bankDetails?.mobileMoneyOption || "Orange Money"} className="w-full h-11 sm:h-12 px-3 border rounded-xl bg-white">
                        <option value="Orange Money">Orange Money</option>
                        <option value="Africell Money">Africell Money</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold block">Preferred Payout Method *</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-amber-50/40">
                          <input type="radio" name="preferredPayoutMethod" value="Bank Transfer" defaultChecked={!seller.bankDetails?.preferredPayoutMethod || seller.bankDetails?.preferredPayoutMethod === "Bank Transfer"} className="accent-amber-600" />
                          <span className="text-sm font-medium">Bank Transfer</span>
                        </label>
                        <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-amber-50/40">
                          <input type="radio" name="preferredPayoutMethod" value="Mobile Wallet" defaultChecked={seller.bankDetails?.preferredPayoutMethod === "Mobile Wallet" || seller.bankDetails?.preferredPayoutMethod === "Mobile Money"} className="accent-amber-600" />
                          <span className="text-sm font-medium">Mobile Money</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-8 sm:mt-12 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t border-slate-100">
                  <Button type="button" variant="ghost" onClick={handleBack} disabled={saving} className="h-11 sm:h-12 px-6 rounded-full hover:bg-slate-100 w-full sm:w-auto"><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button type="submit" disabled={saving} className="h-11 sm:h-12 rounded-full px-8 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-200/50 transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto">{saving ? "Saving..." : "Next Step"} <ChevronRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </form>
            )}

            {currentStep === 6 && (
              <form onSubmit={handleNext} className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">Agreement</h1>
                  <p className="text-slate-500 mt-2 text-sm">Accept our terms to finish registration.</p>
                </div>

                <div className="space-y-3 p-4 sm:p-6 bg-slate-50 rounded-2xl sm:rounded-3xl border">
                  <div>
                    <Label htmlFor="hearAboutUs" className="text-base font-bold text-slate-800 flex items-center gap-1">
                      How did you hear about us? <span className="text-rose-500">*</span>
                    </Label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Please select how you first learned about Meeem.
                    </p>
                  </div>
                  <Select
                    value={hearAboutUs}
                    onValueChange={(val) => {
                      setHearAboutUs(val)
                      if (val !== "Other") {
                        setHearAboutUsOther("")
                      }
                    }}
                  >
                    <SelectTrigger id="hearAboutUs" className="h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-white border-slate-200 text-slate-800">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {HEAR_ABOUT_US_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hearAboutUs === "Other" && (
                    <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Label htmlFor="hearAboutUsOther" className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Please specify where you heard about us <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="hearAboutUsOther"
                        name="hearAboutUsOther"
                        type="text"
                        placeholder="e.g. Radio station, Exhibition, Friend recommendation, etc."
                        value={hearAboutUsOther}
                        onChange={(e) => setHearAboutUsOther(e.target.value)}
                        className="h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-white border-slate-200 text-slate-800 focus:border-slate-400 placeholder:text-slate-400"
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4 p-4 sm:p-6 bg-slate-50 rounded-2xl sm:rounded-3xl border border-slate-100">
                  {[
                    {
                      id: "agreedToTerms",
                      label: "General Restaurant Seller Terms & Conditions",
                      sub: "I agree to the platform restaurant vendor rules and hygiene guidelines.",
                      docType: "general-terms" as LegalDocType,
                    },
                    {
                      id: "agreedToPrivacy",
                      label: "Privacy Policy & Data Compliance",
                      sub: "I consent to the secure collection and verification of my restaurant data.",
                      docType: "privacy-policy" as LegalDocType,
                    },
                    {
                      id: "agreedToReturnPolicy",
                      label: "Vendor & Service Provider Agreement",
                      sub: "I agree to food preparation, order fulfillment, and cancellation terms.",
                      docType: "vendor-agreement" as LegalDocType,
                    },
                    {
                      id: "agreedToCommission",
                      label: "Payment Settling & Commission Terms",
                      sub: "I understand the 12-72h automated settlement cycle and restaurant commission.",
                      docType: "payment-settlement" as LegalDocType,
                    },
                  ].map((item) => {
                    const isChecked = (agreements as any)[item.id]
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4",
                          isChecked
                            ? "bg-white border-emerald-300 shadow-sm"
                            : "bg-white/60 border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-start gap-3.5">
                          <Checkbox
                            id={item.id}
                            name={item.id}
                            className="mt-1 w-5 h-5 rounded-md text-emerald-600 focus:ring-emerald-500"
                            checked={isChecked}
                            onChange={(e: any) =>
                              setAgreements((prev) => ({
                                ...prev,
                                [item.id]: e.target.checked,
                              }))
                            }
                            required
                          />
                          <div className="space-y-0.5">
                            <Label
                              htmlFor={item.id}
                              className="text-sm font-bold text-slate-800 cursor-pointer flex items-center gap-2"
                            >
                              <span>{item.label}</span>
                              {isChecked && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <Check className="w-2.5 h-2.5" /> Agreed
                                </span>
                              )}
                            </Label>
                            <p className="text-xs text-slate-500">{item.sub}</p>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveLegalModal(item.docType)}
                          className={cn(
                            "rounded-xl text-xs font-semibold px-4 h-9 self-start sm:self-auto shrink-0 transition-colors w-full sm:w-auto",
                            isChecked
                              ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              : "border-slate-200 text-slate-700 hover:bg-slate-50 bg-white"
                          )}
                        >
                          <FileText className="w-3.5 h-3.5 mr-1.5" />
                          {isChecked ? "Review Document" : "Read & Agree"}
                        </Button>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-8 sm:mt-12 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t border-slate-100">
                  <Button type="button" variant="ghost" onClick={handleBack} disabled={saving} className="h-11 sm:h-12 px-6 rounded-full hover:bg-slate-100 w-full sm:w-auto"><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button type="submit" className="h-11 sm:h-12 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold px-8 shadow-lg shadow-emerald-100 transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto" disabled={saving || !Object.values(agreements).every(v => v)}>
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
                  <p className="text-muted-foreground mt-2">Your restaurant profile is submitted for approval. You will be notified once verified.</p>
                </div>
                <Button onClick={() => router.push("/restaurant-seller/settings")} className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-8">
                  Go to Settings
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Legal Document Modal */}
      {activeLegalModal && (
        <LegalTermsModal
          type={activeLegalModal}
          isOpen={!!activeLegalModal}
          onClose={() => setActiveLegalModal(null)}
          isAccepted={
            activeLegalModal === "general-terms"
              ? agreements.agreedToTerms
              : activeLegalModal === "privacy-policy"
              ? agreements.agreedToPrivacy
              : activeLegalModal === "vendor-agreement"
              ? agreements.agreedToReturnPolicy
              : agreements.agreedToCommission
          }
          onAccept={() => {
            if (activeLegalModal === "general-terms") {
              setAgreements((prev) => ({ ...prev, agreedToTerms: true }))
            } else if (activeLegalModal === "privacy-policy") {
              setAgreements((prev) => ({ ...prev, agreedToPrivacy: true }))
            } else if (activeLegalModal === "vendor-agreement") {
              setAgreements((prev) => ({ ...prev, agreedToReturnPolicy: true }))
            } else if (activeLegalModal === "payment-settlement") {
              setAgreements((prev) => ({ ...prev, agreedToCommission: true }))
            }
          }}
        />
      )}

      {/* Central Camera Capture Modal */}
      {cameraTarget && (
        <CameraCaptureModal
          open={!!cameraTarget}
          onOpenChange={(open) => !open && setCameraTarget(null)}
          onPhotoCaptured={(file) => {
            const target = cameraTarget
            setCameraTarget(null)
            if (target) {
              setCropTarget({
                key: target.key,
                file,
                label: target.label,
                aspectRatio: target.aspectRatio || "free",
              })
            }
          }}
          facingMode={cameraTarget.facingMode || "environment"}
          guideType={cameraTarget.guideType || "card"}
          title={`Take Photo - ${cameraTarget.label}`}
        />
      )}

      {/* Central Image Cropper Modal */}
      {cropTarget && (
        <ImageCropperModal
          open={!!cropTarget}
          onOpenChange={(open) => !open && setCropTarget(null)}
          imageFile={cropTarget.file}
          onCropComplete={(croppedFile) => {
            handleCroppedFile(cropTarget.key, croppedFile)
            setCropTarget(null)
          }}
          aspectRatio={cropTarget.aspectRatio || "free"}
          title={`Crop & Adjust - ${cropTarget.label}`}
        />
      )}
    </div>
  )
}
