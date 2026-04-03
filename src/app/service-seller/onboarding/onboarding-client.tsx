"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import Checkbox from "@/ui/checkbox-v2"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { Badge } from "@/ui/badge"
import { PageLoader } from "@/components/ui/page-loader"
import { FileText, Image as ImageIcon, CheckCircle2, ChevronLeft, ChevronRight, Upload, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type Step = 2 | 3 | 4 | 5 | 6 | 7

export function ServiceOnboardingClient() {
  const router = useRouter()
  const { update } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seller, setSeller] = useState<any>(null)
  const [serviceCategories, setServiceCategories] = useState<any[]>([])
  const [currentStep, setCurrentStep] = useState<Step>(2)
  const [error, setError] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, { file: File, url: string }>>({})
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [agreements, setAgreements] = useState({
    agreedToTerms: false,
    agreedToCommission: false,
    agreedToReturnPolicy: false,
    agreedToPrivacy: false
  })

  useEffect(() => {
    if (seller) {
      if (seller.selectedServiceCategories) {
        setSelectedCats(seller.selectedServiceCategories.map((c: any) => c.id))
      }
      if (seller.agreement) {
        setAgreements({
          agreedToTerms: !!seller.agreement.agreedToTerms,
          agreedToCommission: !!seller.agreement.agreedToCommission,
          agreedToReturnPolicy: !!seller.agreement.agreedToReturnPolicy,
          agreedToPrivacy: !!seller.agreement.agreedToPrivacy
        })
      }
    }
  }, [seller])

  useEffect(() => {
    async function loadData() {
      try {
        const [sellerRes, catsRes] = await Promise.all([
          fetch("/api/service-seller/onboarding"),
          fetch("/api/service-categories") 
        ])
        
        if (!sellerRes.ok) throw new Error("Failed to load seller data")
        const sellerData = await sellerRes.json()
        setSeller(sellerData)
        
        // Redirect if already completed
        if (sellerData.onboardingCompleted) {
            if (sellerData.isApproved) {
                router.push("/service-seller")
            } else {
                router.push("/service-seller/settings")
            }
            return
        }

        setCurrentStep(sellerData.onboardingStep as Step)
        
        if (catsRes.ok) {
            const catsData = await catsRes.json()
            setServiceCategories(catsData.categories || [])
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
          const data: any = {}
          if (currentStep === 5) {
              data.name = formData.get("storeName")
              data.description = formData.get("description")
              data.categoryIds = formData.getAll("categoryIds")
          } else {
              data.agreedToTerms = formData.get("agreedToTerms") === "on"
              data.agreedToCommission = formData.get("agreedToCommission") === "on"
              data.agreedToReturnPolicy = formData.get("agreedToReturnPolicy") === "on"
              data.agreedToPrivacy = formData.get("agreedToPrivacy") === "on"
          }
          res = await fetch("/api/service-seller/onboarding", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ step: currentStep, data })
          })
      } else {
          res = await fetch("/api/service-seller/onboarding", {
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

      const updatedRes = await fetch("/api/service-seller/onboarding")
      const updatedData = await updatedRes.json()
      setSeller(updatedData)
      
      // Increment sequentially in the UI
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

  return (
    <div className="container max-w-3xl mx-auto py-10 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-primary">Service Seller Onboarding</h1>
        <p className="text-muted-foreground mt-2">Complete these steps to offer your services on Meeem</p>
        
        <div className="flex justify-between mt-8 relative">
           <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -translate-y-1/2 z-0"></div>
           {[2, 3, 4, 5, 6].map((s) => (
             <div 
               key={s} 
               className={cn(
                 "w-8 h-8 rounded-full flex items-center justify-center z-10 text-xs font-bold transition-colors shadow-sm",
                 currentStep >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
               )}
             >
               {s}
             </div>
           ))}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6 animate-in fade-in slide-in-from-top-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* STEP 2: BUSINESS INFORMATION */}
      {currentStep === 2 && (
        <form onSubmit={handleNext} className="animate-in fade-in slide-in-from-bottom-4">
          <Card className="border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle>Step 2: Business Information</CardTitle>
              <CardDescription>Legal & operational details for your service business</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input id="businessName" name="businessName" defaultValue={seller.businessInfo?.businessName || ""} placeholder="Your licensed business name" required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessType">Business Type *</Label>
                  <Select name="businessType" defaultValue={seller.businessInfo?.businessType || "Individual"}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
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
                  <Input id="businessRegNumber" name="businessRegNumber" defaultValue={seller.businessInfo?.businessRegNumber || ""} placeholder="if applicable" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxIdNumber">Tax Identification Number (TIN) *</Label>
                <Input id="taxIdNumber" name="taxIdNumber" defaultValue={seller.businessInfo?.taxIdNumber || ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="busRegCert">Business Registration Certificate / Trade License</Label>
                <div className="flex flex-col gap-3 p-3 border rounded-lg bg-muted/10">
                  <Input id="busRegCert" name="busRegCert" type="file" accept=".pdf,.jpg,.jpeg,.png" className="border-dashed" onChange={(e) => handleFileChange(e, "busRegCert")} />
                  {renderFilePreview("busRegCert", seller.businessInfo?.busRegCertUrl, "Registration Certificate")}
                  <p className="text-[10px] text-muted-foreground">Upload PDF or Image (Max 5MB)</p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="street">Business Address (Street) *</Label>
                <Input id="street" name="street" defaultValue={seller.businessInfo?.street || ""} required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input id="city" name="city" defaultValue={seller.businessInfo?.city || "Freetown"} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="district">District *</Label>
                  <Input id="district" name="district" defaultValue={seller.businessInfo?.district || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input id="postalCode" name="postalCode" defaultValue={seller.businessInfo?.postalCode || ""} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label htmlFor="yearsInOperation">Years in Operation</Label>
                  <Input id="yearsInOperation" name="yearsInOperation" type="number" defaultValue={seller.businessInfo?.yearsInOperation || 0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="natureOfBusiness">Nature of Service Business</Label>
                  <Input id="natureOfBusiness" name="natureOfBusiness" defaultValue={seller.businessInfo?.natureOfBusiness || ""} placeholder="e.g., Plumbing, IT Consulting" />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end pt-6">
              <Button type="submit" disabled={saving} className="min-w-[150px]">
                {saving ? "Saving..." : "Save & Continue"} <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}

      {/* STEP 3: KYC */}
      {currentStep === 3 && (
        <form onSubmit={handleNext} className="animate-in fade-in slide-in-from-bottom-4">
          <Card className="border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle>Step 3: Identity Verification (KYC)</CardTitle>
              <CardDescription>Verified identity helps build trust with customers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="idType">ID Type *</Label>
                  <Select name="idType" defaultValue={seller.kyc?.idType || "National ID Card"}>
                    <SelectTrigger><SelectValue placeholder="Select ID Type" /></SelectTrigger>
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/5 rounded-xl border">
                <div className="space-y-2">
                  <Label htmlFor="idFront" className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Upload ID Front *</Label>
                  <Input id="idFront" name="idFront" type="file" accept="image/*" onChange={(e) => handleFileChange(e, "idFront")} />
                  {renderFilePreview("idFront", seller.kyc?.idFrontUrl, "ID Front")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idBack" className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Upload ID Back</Label>
                  <Input id="idBack" name="idBack" type="file" accept="image/*" onChange={(e) => handleFileChange(e, "idBack")} />
                  {renderFilePreview("idBack", seller.kyc?.idBackUrl, "ID Back")}
                </div>
              </div>
              
              <div className="space-y-3 pt-2">
                <Label htmlFor="selfie" className="flex items-center gap-2 text-lg font-semibold">
                   Selfie / Face Verification *
                </Label>
                <div className="flex items-center gap-4 p-4 border-2 border-dashed rounded-xl bg-muted/5">
                   <div className="p-3 bg-primary/10 rounded-full">
                      <Upload className="h-6 w-6 text-primary" />
                   </div>
                   <div className="flex-1">
                      <p className="text-sm">Click to upload or drag your selfie</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Make sure your face is clearly visible and well-lit.</p>
                      <Input id="selfie" name="selfie" type="file" accept="image/*" className="mt-2" onChange={(e) => handleFileChange(e, "selfie")} />
                      {renderFilePreview("selfie", seller.kyc?.selfieUrl, "Selfie Check")}
                   </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between pt-6">
              <Button type="button" variant="outline" onClick={handleBack} disabled={saving}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save & Continue"} <ChevronRight className="ml-2 h-4 w-4" /></Button>
            </CardFooter>
          </Card>
        </form>
      )}

      {/* STEP 4: BANK DETAILS */}
      {currentStep === 4 && (
        <form onSubmit={handleNext} className="animate-in fade-in slide-in-from-bottom-4">
          <Card className="border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle>Step 4: Bank & Payment Details</CardTitle>
              <CardDescription>Securely receive payments for your services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name *</Label>
                <Input id="bankName" name="bankName" defaultValue={seller.bankDetails?.bankName || ""} placeholder="e.g., Sierra Leone Commercial Bank" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountHolderName">Account Holder Name *</Label>
                <Input id="accountHolderName" name="accountHolderName" defaultValue={seller.bankDetails?.accountHolderName || ""} required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number *</Label>
                  <Input id="accountNumber" name="accountNumber" defaultValue={seller.bankDetails?.accountNumber || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branchName">Branch Name *</Label>
                  <Input id="branchName" name="branchName" defaultValue={seller.bankDetails?.branchName || ""} required />
                </div>
              </div>
              <div className="space-y-2 p-4 bg-muted/10 rounded-lg border">
                <Label htmlFor="bankPassbook">Cancelled Check or Passbook Photo *</Label>
                <Input id="bankPassbook" name="bankPassbook" type="file" accept="image/*,.pdf" onChange={(e) => handleFileChange(e, "bankPassbook")} />
                {renderFilePreview("bankPassbook", seller.bankDetails?.passbookUrl, "Bank Document")}
              </div>
              
              <div className="space-y-4 pt-4 border-t">
                 <div className="space-y-2">
                    <Label className="text-base font-semibold">Mobile Money Option (Very Important)</Label>
                    <Select name="mobileMoneyOption" defaultValue={seller.bankDetails?.mobileMoneyOption || "Orange Money"}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select Mobile Money Provider" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Orange Money">Orange Money</SelectItem>
                          <SelectItem value="Africell Money">Africell Money</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>

                 <div className="space-y-3">
                    <Label className="text-base font-semibold">Preferred Payout Method *</Label>
                    <div className="grid grid-cols-2 gap-4">
                        <label className={cn(
                            "flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all",
                            seller.bankDetails?.preferredPayoutMethod === "Bank Transfer" ? "bg-primary/5 border-primary" : "hover:bg-muted/30"
                        )}>
                            <input type="radio" name="preferredPayoutMethod" value="Bank Transfer" className="h-4 w-4 text-primary" defaultChecked={seller.bankDetails?.preferredPayoutMethod === "Bank Transfer"} /> 
                            <span>Bank Transfer</span>
                        </label>
                        <label className={cn(
                            "flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all",
                            seller.bankDetails?.preferredPayoutMethod === "Mobile Wallet" ? "bg-primary/5 border-primary" : "hover:bg-muted/30"
                        )}>
                            <input type="radio" name="preferredPayoutMethod" value="Mobile Wallet" className="h-4 w-4 text-primary" defaultChecked={seller.bankDetails?.preferredPayoutMethod === "Mobile Wallet"} /> 
                            <span>Mobile Wallet</span>
                        </label>
                    </div>
                 </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between pt-6">
               <Button type="button" variant="outline" onClick={handleBack} disabled={saving}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
               <Button type="submit" disabled={saving || selectedCats.length === 0}>{saving ? "Saving..." : "Save & Continue"} <ChevronRight className="ml-2 h-4 w-4" /></Button>
            </CardFooter>
          </Card>
        </form>
      )}

      {/* STEP 5: STORE SETUP */}
      {currentStep === 5 && (
        <form onSubmit={handleNext} className="animate-in fade-in slide-in-from-bottom-4">
          <Card className="border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle>Step 5: Service Provider Profile</CardTitle>
              <CardDescription>Setup your public service store and categories</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="storeName">Service Center / Store Name *</Label>
                <Input id="storeName" name="storeName" defaultValue={seller.store?.name || ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">About Your Services</Label>
                <Textarea id="description" name="description" defaultValue={seller.store?.description || ""} placeholder="Describe your experience, expertise and services offered..." rows={4} />
              </div>
              
              <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-semibold">Service Categories *</Label>
                  <p className="text-xs text-muted-foreground mb-4">Select the categories that match your skills. Your services will only be listable in these categories.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {serviceCategories.map((cat: any) => (
                        <label key={cat.id} className={cn(
                            "flex items-center gap-3 p-3 border rounded-xl hover:shadow-sm cursor-pointer text-sm transition-all",
                            selectedCats.includes(cat.id) ? "bg-primary/5 border-primary shadow-sm" : "bg-card"
                        )}>
                           <input 
                             type="checkbox" 
                             name="categoryIds" 
                             value={cat.id} 
                             className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                             checked={selectedCats.includes(cat.id)}
                             onChange={(e) => {
                               if (e.target.checked) {
                                 setSelectedCats(prev => [...prev, cat.id])
                               } else {
                                 setSelectedCats(prev => prev.filter(id => id !== cat.id))
                               }
                             }}
                            />
                           <span className="font-medium">{cat.name}</span>
                        </label>
                    ))}
                  </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between pt-6">
               <Button type="button" variant="outline" onClick={handleBack} disabled={saving}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
               <Button type="submit" disabled={saving || selectedCats.length === 0}>{saving ? "Saving..." : "Save & Continue"} <ChevronRight className="ml-2 h-4 w-4" /></Button>
            </CardFooter>
          </Card>
        </form>
      )}

      {/* STEP 6: AGREEMENT */}
      {currentStep === 6 && (
        <form onSubmit={handleNext} className="animate-in fade-in slide-in-from-bottom-4">
          <Card className="border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle>Step 6: Agreement & Compliance</CardTitle>
              <CardDescription>Final confirmation before submission</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
               {[
                 { id: "agreedToTerms", label: "Accept Service Seller Terms & Conditions", sub: "I agree to the platform terms and service level agreements." },
                 { id: "agreedToCommission", label: "Commission & Fee Agreement", sub: "I understand the lead fees and booking commissions for my services." },
                 { id: "agreedToReturnPolicy", label: "Cancellation & Refund Policy", sub: "I agree to honor appointments and follow the refund guidelines." },
                 { id: "agreedToPrivacy", label: "Data Consent", sub: "I agree to the collection of my business information for verification." }
               ].map((check) => (
                 <div key={check.id} className="flex items-start space-x-4 p-4 border rounded-xl hover:bg-muted/5 transition-colors">
                    <Checkbox 
                      id={check.id} 
                      name={check.id} 
                      className="mt-1" 
                      checked={(agreements as any)[check.id]} 
                      onChange={(e: any) => setAgreements(prev => ({ ...prev, [check.id]: e.target.checked }))}
                      required 
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor={check.id} className="text-base font-semibold cursor-pointer">{check.label}</Label>
                      <p className="text-xs text-muted-foreground">{check.sub}</p>
                    </div>
                 </div>
               ))}
            </CardContent>
            <CardFooter className="flex justify-between pt-8">
               <Button type="button" variant="outline" onClick={handleBack} disabled={saving}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
               <Button type="submit" className="bg-primary text-primary-foreground min-w-[200px]" disabled={saving || !Object.values(agreements).every(v => v)}>
                 {saving ? "Submitting..." : "Submit For Review"} <CheckCircle2 className="ml-2 h-4 w-4" />
               </Button>
            </CardFooter>
          </Card>
        </form>
      )}

      {/* STEP 7: STATUS */}
      {currentStep === 7 && (
        <Card className="animate-in zoom-in-95 duration-500">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl font-bold font-heading">Onboarding Submitted</CardTitle>
              <CardDescription>Your details have been sent to our admin team for review.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="p-6 bg-muted/40 rounded-xl space-y-4">
                    <div className="flex justify-between items-center border-b pb-4 border-muted">
                        <span className="font-semibold text-foreground">Current Status</span>
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending Review</Badge>
                    </div>
                    <p className="text-sm text-balance leading-relaxed text-muted-foreground text-center">
                        Thank you for your application! Our verification team is currently reviewing your documents. 
                        This process typically takes <strong>24-48 business hours</strong>. 
                        You will receive an email notification once your account is ready for use.
                    </p>
                </div>
            </CardContent>
            <CardFooter>
                <Button onClick={() => router.push("/service-seller/settings")} className="w-full h-12 text-lg shadow-lg">
                    Go to My Dashboard
                </Button>
            </CardFooter>
        </Card>
      )}
    </div>
  )
}
