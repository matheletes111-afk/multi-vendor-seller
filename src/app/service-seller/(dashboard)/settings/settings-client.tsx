"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, FileText, CheckCircle2, AlertCircle, Info, Scale, Settings as SettingsIcon, UserX, Plus, Check, Pencil, X } from "lucide-react"
import { validateOnboardingFile } from "@/lib/onboarding-file-validation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { Badge } from "@/ui/badge"
import { PageLoader } from "@/components/ui/page-loader"
import { ProfilePictureInput } from "@/components/profile-picture-input"
import { StoreLocationPicker } from "@/components/store-location-picker"
import Checkbox from "@/ui/checkbox-v2"
import { LegalPolicyTabContent } from "@/components/legal/legal-policy-tab-content"
import { DeleteAccountTabContent } from "@/components/account/delete-account-tab-content"
import { cn } from "@/lib/utils"
import { validatePhoneAndCountryCode } from "@/lib/phone-validation"
import { CountryCodeSelect } from "@/ui/country-code-select"

interface ServiceCategorySuggestion {
  id?: string
  name: string
  description: string
  image?: File | null
  icon?: File | null
  imagePreview?: string
  iconPreview?: string
}

export function ServiceSettingsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showSuggestionForm, setShowSuggestionForm] = useState(false)
  const [suggestionsList, setSuggestionsList] = useState<ServiceCategorySuggestion[]>([])
  const [tempSuggestion, setTempSuggestion] = useState<ServiceCategorySuggestion>({
    name: "",
    description: "",
    image: null,
    icon: null,
    imagePreview: "",
    iconPreview: "",
  })
  const [activeTab, setActiveTab] = useState<"general" | "legal" | "delete-account">(() => {
    const tab = searchParams.get("tab")
    if (tab === "legal") return "legal"
    if (tab === "delete-account" || tab === "delete") return "delete-account"
    return "general"
  })

  const handleTabChange = (tab: "general" | "legal" | "delete-account") => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    if (tab === "general") {
      params.delete("tab")
    } else {
      params.set("tab", tab)
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    router.replace(newUrl, { scroll: false })
  }

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "legal") setActiveTab("legal")
    else if (tab === "delete-account" || tab === "delete") setActiveTab("delete-account")
    else if (!tab || tab === "general") setActiveTab("general")
  }, [searchParams])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [seller, setSeller] = useState<any>(null)
  const [serviceCategories, setServiceCategories] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [haveGst, setHaveGst] = useState(false)
  const [previews, setPreviews] = useState<Record<string, { file: File, url: string }>>({})

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return
    setError(null)

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
          console.warn("Could not set e.target.files via DataTransfer:", dtErr)
        }
      } catch (err) {
        console.error("Image compression error:", err)
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

  useEffect(() => {
    async function loadData() {
      try {
        const [sellerRes, catsRes] = await Promise.all([
          fetch("/api/service-seller/settings"),
          fetch("/api/service-categories")
        ])
        if (catsRes.ok && sellerRes.ok) {
          const catsData = await catsRes.json()
          const globalCats = catsData.categories || []
          const s = await sellerRes.json()
          setSeller(s)
          if (s.businessInfo) setHaveGst(!!s.businessInfo.haveGst)

          // Merge seller's selected categories that might be inactive
          const selected = s.selectedServiceCategories || []
          const merged = [...globalCats]
          selected.forEach((sel: any) => {
            if (!merged.find(c => c.id === sel.id)) {
              merged.push(sel)
            }
          })
          setServiceCategories(merged)

          // Populate suggestions list from inactive service categories
          const suggestions = selected
            .filter((c: any) => !c.isActive)
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              description: c.description || "",
              image: null,
              icon: null,
              imagePreview: c.image || "",
              iconPreview: c.mobileIcon || "",
            }))
          setSuggestionsList(suggestions)

          if (s.isApproved) {
            if (typeof window !== "undefined" && window.location.search.includes("error=AccountPendingApproval")) {
              const url = new URL(window.location.href)
              url.searchParams.delete("error")
              window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""))
            }
          }
        }
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const paramsError = searchParams.get("error")
  const paramsSuccess = searchParams.get("success")

  const getErrorMessage = (err: string | null) => {
    if (!err) return null
    if (err === "AccountPendingApproval") {
      if (seller?.isApproved) return null
      return "Your account application is currently pending review by our administration team. You will be notified once your account is fully verified and ready for listing services."
    }
    return err
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>, section: string) {
    e.preventDefault()
    setSaving(section)
    setError(null)
    setSuccess(null)

    const form = e.currentTarget
    const formData = new FormData(form)
    // Attach compressed preview files for inputs in this section form
    Object.entries(previews).forEach(([k, val]) => {
      if (val?.file && (form.elements.namedItem(k) || form.querySelector(`[name="${k}"]`))) {
        formData.set(k, val.file)
      }
    })
    if (section === "user") {
        const phone = (formData.get("phone") as string | null)?.trim()
        const phoneCountryCode = (formData.get("phoneCountryCode") as string | null)?.trim()
        if (!phone || !phoneCountryCode) {
            setError("Phone and country code are required.")
            setSaving(null)
            return
        }
        const validation = validatePhoneAndCountryCode(phone, phoneCountryCode)
        if (!validation.isValid) {
            setError(validation.error || "Please enter a valid phone number and country code.")
            setSaving(null)
            return
        }
    }

    if (section === "store" && suggestionsList.length > 0) {
      formData.append("suggestionCount", suggestionsList.length.toString())
      suggestionsList.forEach((sug, i) => {
        if (sug.id) formData.append(`suggestion_id_${i}`, sug.id)
        formData.append(`suggestion_name_${i}`, sug.name)
        formData.append(`suggestion_description_${i}`, sug.description)
        if (sug.image) formData.append(`suggestion_image_${i}`, sug.image)
        if (sug.icon) formData.append(`suggestion_mobile_icon_${i}`, sug.icon)
      })
    }

    let isReloading = false
    try {
        let res: Response
        const hasFiles = section === "store" || Array.from(formData.values()).some(v => v instanceof File && v.size > 0)

        if (hasFiles) {
            res = await fetch("/api/service-seller/settings", { method: "PUT", body: formData })
        } else {
            const body: any = {}
            if (section === "store") {
                body.store = Object.fromEntries(formData.entries())
                body.seller = { categoryIds: formData.getAll("categoryIds") }
            } else if (section === "business") {
                body.seller = { businessInfo: Object.fromEntries(formData.entries()) }
            } else if (section === "bank") {
                body.seller = { bankDetails: Object.fromEntries(formData.entries()) }
            } else if (section === "kyc") {
                body.seller = { kyc: Object.fromEntries(formData.entries()) }
            } else if (section === "user") {
                const entries = Object.fromEntries(formData.entries())
                const { nationIdentityNumber, ...userData } = entries as any
                body.user = userData
                if (nationIdentityNumber !== undefined) {
                    body.seller = { nationIdentityNumber }
                }
            }

            res = await fetch("/api/service-seller/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            })
        }

        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || "Failed to update settings")
        }

        isReloading = false
        if (section === "user") {
            setSuccess("Profile details updated successfully! Reloading...")
            isReloading = true
            setTimeout(() => {
                window.location.reload()
            }, 1500)
        } else {
            setSuccess(`${section.charAt(0).toUpperCase() + section.slice(1)} details updated successfully!`)
            if (section === "store") {
              try {
                const [sellerRes, catsRes] = await Promise.all([
                  fetch("/api/service-seller/settings"),
                  fetch("/api/service-categories")
                ])
                if (catsRes.ok && sellerRes.ok) {
                  const catsData = await catsRes.json()
                  const globalCats = catsData.categories || []
                  const s = await sellerRes.json()
                  setSeller(s)
                  const selected = s.selectedServiceCategories || []
                  const merged = [...globalCats]
                  selected.forEach((sel: any) => {
                    if (!merged.find((c: any) => c.id === sel.id)) {
                      merged.push(sel)
                    }
                  })
                  setServiceCategories(merged)
                  const suggestions = selected
                    .filter((c: any) => !c.isActive)
                    .map((c: any) => ({
                      id: c.id,
                      name: c.name,
                      description: c.description || "",
                      image: null,
                      icon: null,
                      imagePreview: c.image || "",
                      iconPreview: c.mobileIcon || "",
                    }))
                  setSuggestionsList(suggestions)
                }
              } catch (syncErr) {
                console.error("Error re-syncing service categories:", syncErr)
              }
            }
        }
    } catch (err: any) {
        setError(err.message)
    } finally {
        if (!isReloading) {
            setSaving(null)
        }
    }
  }

  if (loading || !seller) return <PageLoader message="Loading settings…" />

  const isServiceCategorySelected = (categoryId: string) =>
    (seller.selectedServiceCategories ?? []).some((s: { id: string }) => String(s.id) === String(categoryId))

  const isPending = seller.status === "PENDING"
  const isRejected = seller.status === "REJECTED"
  const isCorrection = seller.status === "CORRECTION_NEEDED"

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-primary">Service Provider Settings</h1>
        <div className="flex gap-2">
            {isPending && !seller.isApproved && <Badge className="bg-yellow-100 text-yellow-800">Pending Approval</Badge>}
            {isCorrection && <Badge variant="destructive">Correction Needed</Badge>}
            {isRejected && <Badge variant="destructive">Rejected</Badge>}
            {seller.isApproved && !isCorrection && !isRejected && <Badge className="bg-green-100 text-green-800">Verified Provider</Badge>}
        </div>
      </div>

      {!seller?.isApproved && (
        <Alert className="mb-6 border-blue-200 bg-blue-50/80 text-blue-950 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div>
            <AlertTitle className="font-semibold text-blue-900 dark:text-blue-100 text-base">Starter Package Notice</AlertTitle>
            <AlertDescription className="text-sm mt-1 text-blue-800 dark:text-blue-300 leading-relaxed">
              You are currently on the <strong>Free Starter Package</strong>. After your account is reviewed and approved by Admin, you will be able to select and switch to your desired subscription package from the Subscription page.
            </AlertDescription>
          </div>
        </Alert>
      )}

      {(getErrorMessage(paramsError) || error) && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{getErrorMessage(paramsError) || error}</AlertDescription>
        </Alert>
      )}

      {(paramsSuccess || success) && (
        <Alert className="mb-6 bg-green-50 text-green-800 border-green-200"><AlertTitle>Success</AlertTitle><AlertDescription>{paramsSuccess || success}</AlertDescription></Alert>
      )}

      {isCorrection && seller.adminFeedback && (
          <Alert variant="destructive" className="mb-6 border-2"><AlertTitle>Admin Correction Requested:</AlertTitle><AlertDescription className="text-lg">"{seller.adminFeedback}"</AlertDescription></Alert>
      )}

      {/* Settings Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 mb-8 pb-2">
        <button
          type="button"
          onClick={() => handleTabChange("general")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-2xl transition-all",
            activeTab === "general"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
          )}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>Account & Service Settings</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("legal")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-2xl transition-all",
            activeTab === "legal"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
          )}
        >
          <Scale className="w-4 h-4 text-purple-400" />
          <span>Terms & Policies</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("delete-account")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-2xl transition-all",
            activeTab === "delete-account"
              ? "bg-rose-600 text-white shadow-md"
              : "text-rose-600 hover:text-rose-700 hover:bg-rose-50"
          )}
        >
          <UserX className="w-4 h-4" />
          <span>Delete Account</span>
        </button>
      </div>

      {activeTab === "delete-account" ? (
        <DeleteAccountTabContent
          role="SELLER_SERVICE"
          panelName="Service Provider Account"
          panelSlug="service-seller"
        />
      ) : activeTab === "legal" ? (
        <LegalPolicyTabContent
          role="SELLER_SERVICE"
          isAcceptedOnboarding={!!seller?.agreement?.agreedToTerms}
        />
      ) : (
        <div className="grid gap-6">
        <Card>
          <CardHeader><CardTitle>Profile Details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => handleSave(e, "user")} className="space-y-4">
               <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Email</Label><Input value={seller.user.email} disabled className="bg-muted" /></div>
                  <div className="space-y-2"><Label>Provider Name</Label><Input name="name" defaultValue={seller.user.name || ""} /></div>
               </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Country Code</Label>
                    <CountryCodeSelect
                      name="phoneCountryCode"
                      defaultValue={seller.user.phoneCountryCode || "+232"}
                    />
                  </div>
                  <div className="space-y-2"><Label>Phone Number</Label><Input name="phone" defaultValue={seller.user.phone || ""} /></div>
                </div>
               <div className="grid md:grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label className="text-emerald-800 font-semibold">National Identity Number (NIN) *</Label>
                    <Input name="nationIdentityNumber" defaultValue={seller.nationIdentityNumber || ""} placeholder="Enter 11-digit NIN" className="focus:ring-emerald-500" required />
                  </div>
               </div>
               <div className="grid md:grid-cols-2 gap-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label className="text-emerald-800 font-semibold">Current Password (Required for password change)</Label>
                    <div className="relative max-w-sm">
                      <Input 
                        name="currentPassword" 
                        type={showCurrentPassword ? "text" : "password"} 
                        placeholder="Enter current password" 
                        className="pr-10 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-emerald-800 font-semibold">New Password (Optional)</Label>
                    <div className="relative max-w-sm">
                      <Input 
                        name="password" 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Leave blank to keep current" 
                        className="pr-10 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Must be at least 8 characters and contain uppercase, lowercase, a number, and a special character.</p>
                  </div>
               </div>
               <div className="pt-2"><Label className="text-emerald-800 font-semibold">Profile Image</Label><ProfilePictureInput currentImage={seller.user.image} fileInputName="profileImage" urlInputName="image" /></div>
               <Button type="submit" disabled={saving === "user"} className="bg-emerald-600 hover:bg-emerald-700">{saving === "user" ? "Saving..." : "Update Profile"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
           <CardHeader><CardTitle>Business Details</CardTitle></CardHeader>
           <CardContent>
             <form onSubmit={(e) => handleSave(e, "business")} className="space-y-4">
               <div className="grid md:grid-cols-2 gap-4">
                 <div className="space-y-2"><Label>Company Name</Label><Input name="businessName" defaultValue={seller.businessInfo?.businessName || ""} /></div>
                 <div className="space-y-2">
                   <Label>Business Structure</Label>
                   <Select name="businessType" defaultValue={seller.businessInfo?.businessType || "Individual"}>
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="Individual">Individual</SelectItem>
                        <SelectItem value="Proprietor">Proprietor</SelectItem>
                        <SelectItem value="Partnership">Partnership</SelectItem>
                        <SelectItem value="Company">Company</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>
               <div className="grid md:grid-cols-2 gap-4">
                 <div className="space-y-2"><Label>Trade License / Reg No.</Label><Input name="businessRegNumber" defaultValue={seller.businessInfo?.businessRegNumber || ""} /></div>
                 <div className="space-y-2">
                   <Label>Do you sell with GST? *</Label>
                   <Select 
                     name="haveGst" 
                     key={haveGst ? "yes" : "no"}
                     defaultValue={haveGst ? "true" : "false"}
                     onValueChange={(val) => setHaveGst(val === "true")}
                   >
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="false">No</SelectItem>
                       <SelectItem value="true">Yes</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>
               <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tin no (Tax ID) *</Label>
                    <Input name="taxIdNumber" defaultValue={seller.businessInfo?.taxIdNumber || ""} required />
                  </div>
                  {haveGst && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                      <Label>Customer GST Name *</Label>
                      <Input name="gstCustomerName" defaultValue={seller.businessInfo?.gstCustomerName || ""} required={haveGst} />
                    </div>
                  )}
               </div>
               {haveGst && (
                  <div className="grid md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="space-y-2">
                      <Label>GST Identification Number *</Label>
                      <Input name="gstInvNo" defaultValue={seller.businessInfo?.gstInvNo || ""} required={haveGst} />
                    </div>
                  </div>
               )}
               <div className="space-y-2 pt-2">
                  <Label>Registration Document</Label>
                  <div className="flex items-center gap-3">
                     <Input name="busRegCert" type="file" className="max-w-xs" onChange={(e) => handleFileChange(e, "busRegCert")} />
                     {seller.businessInfo?.busRegCertUrl && <a href={seller.businessInfo.busRegCertUrl} target="_blank" className="text-primary hover:underline text-sm flex items-center gap-1"><FileText className="h-4 w-4" /> View Current</a>}
                  </div>
               </div>
               <div className="space-y-2 pt-2">
                  <Label>City Council Certificate (Optional)</Label>
                  <div className="flex items-center gap-3">
                     <Input name="cityCouncilCert" type="file" className="max-w-xs" onChange={(e) => handleFileChange(e, "cityCouncilCert")} />
                     {seller.businessInfo?.cityCouncilCertUrl && <a href={seller.businessInfo.cityCouncilCertUrl} target="_blank" className="text-primary hover:underline text-sm flex items-center gap-1"><FileText className="h-4 w-4" /> View Current</a>}
                  </div>
               </div>
               <div className="space-y-2 pt-2">
                  <Label>GST TIN Certificate</Label>
                  <div className="flex items-center gap-3">
                     <Input name="gstTinCert" type="file" className="max-w-xs" onChange={(e) => handleFileChange(e, "gstTinCert")} />
                     {seller.businessInfo?.gstTinCertUrl && <a href={seller.businessInfo.gstTinCertUrl} target="_blank" className="text-primary hover:underline text-sm flex items-center gap-1"><FileText className="h-4 w-4" /> View Current</a>}
                  </div>
               </div>
               <div className="space-y-2 pt-2">
                  <Label>Proof of Address (Edsa, Guma, etc.) (Optional)</Label>
                  <div className="flex items-center gap-3">
                     <Input name="addressProof" type="file" className="max-w-xs" onChange={(e) => handleFileChange(e, "addressProof")} />
                     {seller.businessInfo?.addressProofUrl && <a href={seller.businessInfo.addressProofUrl} target="_blank" className="text-primary hover:underline text-sm flex items-center gap-1"><FileText className="h-4 w-4" /> View Current</a>}
                  </div>
               </div>
               <div className="grid md:grid-cols-3 gap-4 border-t pt-4">
                  <div className="space-y-2"><Label>Street</Label><Input name="street" defaultValue={seller.businessInfo?.street || ""} /></div>
                  <div className="space-y-2"><Label>City</Label><Input name="city" defaultValue={seller.businessInfo?.city || ""} /></div>
                  <div className="space-y-2"><Label>Area</Label><Input name="district" defaultValue={seller.businessInfo?.district || ""} /></div>
               </div>
               <Button type="submit" disabled={saving === "business"}>{saving === "business" ? "Saving..." : "Update Business Info"}</Button>
             </form>
           </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment & Bank Info</CardTitle></CardHeader>
          <CardContent>
             <form onSubmit={(e) => handleSave(e, "bank")} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Bank Name</Label><Input name="bankName" defaultValue={seller.bankDetails?.bankName || ""} /></div>
                    <div className="space-y-2"><Label>Bank Address</Label><Input name="bankAddress" defaultValue={seller.bankDetails?.bankAddress || ""} /></div>
                 </div>
                 <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Account Name</Label><Input name="accountHolderName" defaultValue={seller.bankDetails?.accountHolderName || ""} /></div>
                    <div className="space-y-2"><Label>Account Number</Label><Input name="accountNumber" defaultValue={seller.bankDetails?.accountNumber || ""} /></div>
                 </div>
                 <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>BBAN Number</Label><Input name="bbanNumber" defaultValue={seller.bankDetails?.bbanNumber || ""} /></div>
                    <div className="space-y-2"><Label>Branch</Label><Input name="branchName" defaultValue={seller.bankDetails?.branchName || ""} /></div>
                 </div>
                 <div className="grid md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                       <Label>Mobile Money</Label>
                       <Select name="mobileMoneyOption" defaultValue={seller.bankDetails?.mobileMoneyOption || "Orange Money"}>
                         <SelectTrigger><SelectValue /></SelectTrigger>
                         <SelectContent><SelectItem value="Orange Money">Orange Money</SelectItem><SelectItem value="Africell Money">Africell Money</SelectItem></SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label>Method</Label>
                       <Select name="preferredPayoutMethod" defaultValue={seller.bankDetails?.preferredPayoutMethod || "Bank Transfer"}>
                         <SelectTrigger><SelectValue /></SelectTrigger>
                         <SelectContent>
                           <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                           <SelectItem value="Mobile Wallet">Mobile Money</SelectItem>
                         </SelectContent>
                       </Select>
                    </div>
                 </div>
                 <div className="grid md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                       <Label>Bank Passbook / Cheque Copy (Optional)</Label>
                       <div className="flex items-center gap-3">
                         <Input name="bankPassbook" type="file" onChange={(e) => handleFileChange(e, "bankPassbook")} />
                         {seller.bankDetails?.passbookUrl && <a href={seller.bankDetails.passbookUrl} target="_blank" className="text-primary hover:underline text-sm flex items-center gap-1"><FileText className="h-4 w-4" /> View Current</a>}
                       </div>
                    </div>
                    <div className="space-y-2">
                       <Label>Bank Letter with Account No. (Optional)</Label>
                       <div className="flex items-center gap-3">
                         <Input name="bankLetter" type="file" onChange={(e) => handleFileChange(e, "bankLetter")} />
                         {seller.bankDetails?.bankLetterUrl && <a href={seller.bankDetails.bankLetterUrl} target="_blank" className="text-primary hover:underline text-sm flex items-center gap-1"><FileText className="h-4 w-4" /> View Current</a>}
                       </div>
                    </div>
                 </div>
                 <Button type="submit" disabled={saving === "bank"}>{saving === "bank" ? "Saving..." : "Update Bank Info"}</Button>
             </form>
          </CardContent>
        </Card>

        <Card>
           <CardHeader><CardTitle>Service Store & Categories</CardTitle></CardHeader>
           <CardContent>
              <form onSubmit={(e) => handleSave(e, "store")} className="space-y-6">
                 <div className="space-y-2"><Label>Store Name</Label><Input name="name" defaultValue={seller.store?.name || ""} /></div>
                 <div className="space-y-2"><Label>Store Bio</Label><Textarea name="description" defaultValue={seller.store?.description || ""} rows={3} /></div>
                 
                 <div className="space-y-4 pt-4 border-t border-slate-100">
                     <div className="flex items-center justify-between">
                       <div>
                         <Label className="font-bold text-base">Authorized Service Categories</Label>
                         <p className="text-xs text-muted-foreground mt-0.5">Select categories you plan to offer services in, or suggest a new category.</p>
                       </div>
                       <Button
                         type="button"
                         variant="outline"
                         size="sm"
                         className={cn(
                           "rounded-full border-teal-200 text-teal-600 hover:bg-teal-50 transition-all gap-1.5",
                           showSuggestionForm && "bg-teal-100 border-teal-300"
                         )}
                         onClick={() => setShowSuggestionForm(!showSuggestionForm)}
                       >
                         <Plus className="h-3.5 w-3.5" />
                         Suggest New
                       </Button>
                     </div>

                     {showSuggestionForm && (
                       <div className="p-4 sm:p-6 border-2 border-dashed rounded-3xl bg-teal-50/30 border-teal-100 animate-in fade-in slide-in-from-top-4 duration-300 space-y-4">
                         <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white">
                               <Plus className="h-4 w-4" />
                             </div>
                             <h3 className="text-sm font-bold text-slate-800">Suggest New Service Category</h3>
                           </div>
                           <Button
                             type="button"
                             variant="ghost"
                             size="sm"
                             onClick={() => setShowSuggestionForm(false)}
                             className="h-8 w-8 p-0 rounded-full hover:bg-teal-100 text-teal-600"
                           >
                             <X className="h-4 w-4" />
                           </Button>
                         </div>

                         <div className="space-y-4">
                           <div className="space-y-2">
                             <Label>Service Category Name *</Label>
                             <Input
                               value={tempSuggestion.name}
                               onChange={(e) => setTempSuggestion(prev => ({ ...prev, name: e.target.value }))}
                               placeholder="e.g., Solar Installation, Language Tutoring"
                               className="h-11 rounded-xl border-teal-100 focus:ring-teal-500 bg-white"
                             />
                           </div>

                           <div className="space-y-2">
                             <Label>Description</Label>
                             <Textarea
                               value={tempSuggestion.description}
                               onChange={(e) => setTempSuggestion(prev => ({ ...prev, description: e.target.value }))}
                               placeholder="Briefly describe what services belong in this category..."
                               rows={2}
                               className="rounded-xl border-teal-100 focus:ring-teal-500 bg-white"
                             />
                           </div>

                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div className="space-y-2">
                               <Label className="text-xs font-semibold">Category Banner *</Label>
                               <div className="relative">
                                 <Input
                                   type="file"
                                   accept="image/*"
                                   className="h-11 rounded-xl border-teal-100 bg-white cursor-pointer"
                                   onChange={async (e) => {
                                     const rawFile = e.target.files?.[0]
                                     if (rawFile) {
                                       const validation = validateOnboardingFile(rawFile, { imagesOnly: true, maxSizeMb: 4.5 })
                                       if (!validation.isValid) {
                                         setError(validation.error || "Only image files are allowed.")
                                         e.target.value = ""
                                         return
                                       }
                                       let file: File = rawFile
                                       if (rawFile.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(rawFile.name)) {
                                         try {
                                           const { compressImage } = await import("@/lib/image-compressor")
                                           file = await compressImage(rawFile, 500, 500, 0.8)
                                         } catch (err) {
                                           console.error("Compression error:", err)
                                         }
                                       }
                                       setTempSuggestion(prev => ({
                                         ...prev,
                                         image: file,
                                         imagePreview: URL.createObjectURL(file)
                                       }))
                                     }
                                   }}
                                 />
                                 {tempSuggestion.imagePreview && (
                                   <div className="mt-2 flex items-center gap-2 p-2 bg-white rounded-lg border border-teal-100 animate-in fade-in">
                                     <img src={tempSuggestion.imagePreview} className="w-8 h-8 rounded object-cover" />
                                     <span className="text-[10px] truncate max-w-[150px]">
                                       {tempSuggestion.image ? tempSuggestion.image.name : "Banner Selected"}
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
                                   className="h-11 rounded-xl border-teal-100 bg-white cursor-pointer"
                                   onChange={async (e) => {
                                     const rawFile = e.target.files?.[0]
                                     if (rawFile) {
                                       const validation = validateOnboardingFile(rawFile, { imagesOnly: true, maxSizeMb: 4.5 })
                                       if (!validation.isValid) {
                                         setError(validation.error || "Only image files are allowed.")
                                         e.target.value = ""
                                         return
                                       }
                                       let file: File = rawFile
                                       if (rawFile.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(rawFile.name)) {
                                         try {
                                           const { compressImage } = await import("@/lib/image-compressor")
                                           file = await compressImage(rawFile, 200, 200, 0.85)
                                         } catch (err) {
                                           console.error("Compression error:", err)
                                         }
                                       }
                                       setTempSuggestion(prev => ({
                                         ...prev,
                                         icon: file,
                                         iconPreview: URL.createObjectURL(file)
                                       }))
                                     }
                                   }}
                                 />
                                 {tempSuggestion.iconPreview && (
                                   <div className="mt-2 flex items-center gap-2 p-2 bg-white rounded-lg border border-teal-100 animate-in fade-in">
                                     <img src={tempSuggestion.iconPreview} className="w-8 h-8 rounded object-cover" />
                                     <span className="text-[10px] truncate max-w-[150px]">
                                       {tempSuggestion.icon ? tempSuggestion.icon.name : "Icon Selected"}
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
                               setSuggestionsList(prev => [...prev, tempSuggestion])
                               setTempSuggestion({ name: "", description: "", image: null, icon: null, imagePreview: "", iconPreview: "" })
                               setShowSuggestionForm(false)
                             }}
                             className="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold"
                           >
                             Add Service Category Suggestion
                           </Button>
                         </div>
                       </div>
                     )}

                     {suggestionsList.length > 0 && (
                       <div className="p-4 bg-teal-50/20 border border-teal-100 rounded-2xl space-y-3">
                         <div className="flex items-center justify-between">
                           <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                             <Check className="h-3.5 w-3.5 text-teal-600" />
                             Suggested Categories ({suggestionsList.length})
                           </span>
                           <span className="text-[10px] text-teal-500">Will be saved and submitted for admin review upon updating</span>
                         </div>
                         <div className="flex flex-wrap gap-2">
                           {suggestionsList.map((sug, idx) => (
                             <div key={idx} className="flex items-center gap-3 px-4 py-2 bg-teal-50 border border-teal-200 rounded-xl text-sm font-medium text-teal-800 shadow-sm animate-in zoom-in-95">
                               {sug.iconPreview && <img src={sug.iconPreview} className="w-5 h-5 rounded-full object-cover border border-teal-200 bg-white" />}
                               <span className="truncate max-w-[200px]">{sug.name}</span>
                               <div className="flex items-center gap-1 pl-2 border-l border-teal-200">
                                 <button
                                   type="button"
                                   onClick={() => {
                                     setTempSuggestion(sug)
                                     setShowSuggestionForm(true)
                                     setSuggestionsList(prev => prev.filter((_, i) => i !== idx))
                                   }}
                                   className="p-1 hover:bg-white rounded-md text-teal-500 hover:text-teal-700 transition-colors"
                                   title="Edit Suggestion"
                                 >
                                   <Pencil className="h-3.5 w-3.5" />
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() => setSuggestionsList(prev => prev.filter((_, i) => i !== idx))}
                                   className="p-1 hover:bg-white rounded-md text-teal-500 hover:text-red-600 transition-colors"
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

                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {serviceCategories.map((cat: any) => (
                            <label key={cat.id} className={cn(
                                "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                                isServiceCategorySelected(cat.id) ? "bg-primary/5 border-primary shadow-sm" : "bg-card hover:bg-muted"
                            )}>
                               <Checkbox 
                                 name="categoryIds" 
                                 value={cat.id} 
                                 defaultChecked={isServiceCategorySelected(cat.id)} 
                               />
                               <span className="text-sm font-medium">
                                 {cat.name} {!cat.isActive && <span className="text-[10px] text-amber-600 font-bold ml-1">(Pending)</span>}
                               </span>
                            </label>
                        ))}
                    </div>
                 </div>

                 <div className="grid md:grid-cols-2 gap-6 pt-4 border-t">
                    <div className="space-y-3">
                        <Label className="font-bold">Service Store Logo</Label>
                        <div className="mt-1 flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-xl bg-slate-50/50 border-slate-200">
                            { (previews.storeLogo || seller.store?.logo) ? (
                                <div className="relative w-32 h-32 rounded-lg overflow-hidden border shadow-sm">
                                    <img src={previews.storeLogo ? previews.storeLogo.url : seller.store.logo} alt="Logo Preview" className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className="w-32 h-32 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 font-medium text-xs">No Logo</div>
                            )}
                            <Input name="storeLogo" type="file" accept="image/*" className="max-w-xs" onChange={(e) => handleFileChange(e, "storeLogo")} />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <Label className="font-bold">Service Store Banner (Optional)</Label>
                        <div className="mt-1 flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-xl bg-slate-50/50 border-slate-200">
                            { (previews.storeBanner || seller.store?.banner) ? (
                                <div className="relative w-full aspect-[3/1] rounded-lg overflow-hidden border shadow-sm">
                                    <img src={previews.storeBanner ? previews.storeBanner.url : seller.store.banner} alt="Banner Preview" className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className="w-full aspect-[3/1] rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 font-medium text-xs">No Banner</div>
                            )}
                            <Input name="storeBanner" type="file" accept="image/*" className="max-w-xs" onChange={(e) => handleFileChange(e, "storeBanner")} />
                        </div>
                    </div>
                 </div>

                 <div className="space-y-4 pt-4 border-t">
                    <Label className="font-bold text-lg">Store Location</Label>
                    <p className="text-xs text-muted-foreground mb-4">Set your permanent store location on the map.</p>
                    <StoreLocationPicker
                      initialLat={seller.store?.lat}
                      initialLng={seller.store?.lng}
                      initialAddress={seller.store?.address}
                    />
                 </div>

                 <Button type="submit" disabled={saving === "store"} className="bg-emerald-600 hover:bg-emerald-700">{saving === "store" ? "Saving..." : "Update Store Info"}</Button>
              </form>
           </CardContent>
        </Card>
      </div>
      )}
    </div>
  )
}
