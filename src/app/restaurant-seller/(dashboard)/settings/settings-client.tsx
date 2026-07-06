"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Eye, EyeOff, FileText, CheckCircle2, AlertCircle, Camera, User, LogOut, LayoutDashboard, Settings as SettingsIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { Badge } from "@/ui/badge"
import { Checkbox } from "@/ui/checkbox-v2"
import { PageLoader } from "@/components/ui/page-loader"
import { ProfilePictureInput } from "@/components/profile-picture-input"
import { cn } from "@/lib/utils"

const CUISINES = [
  "Italian", "Indian", "Chinese", "Japanese", "Mexican", "Thai", "French", "American", "Mediterranean", "Continental", "Pizza", "Pasta", "Biryani", "Burgers", "Fast Food", "Salads", "Desserts", "Bakeries", "Beverages", "Arabic", "Turkish", "Lebanese", "Greek", "Spanish", "Korean", "Vietnamese", "African", "Caribbean", "Brazilian", "Steakhouse", "Seafood", "Sushi", "BBQ", "Sandwiches", "Healthy", "Vegan", "Ice Cream", "Coffee & Tea", "Juices", "Other"
]

const SERVICE_TYPES = [
  "Delivery", "Dine-in", "Takeaway"
]

export default function RestaurantSettingsClient() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [seller, setSeller] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [haveGst, setHaveGst] = useState(false)
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [previews, setPreviews] = useState<Record<string, { file: File, url: string }>>({})

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/restaurant-seller/settings")
        if (res.ok) {
          const s = await res.json()
          setSeller(s)
          if (s.businessInfo) setHaveGst(!!s.businessInfo.haveGst)
          if (s.primaryCuisine) {
              try {
                  const c = JSON.parse(s.primaryCuisine)
                  if (Array.isArray(c)) setSelectedCuisines(c)
              } catch { /* ignore */ }
          }
          if (s.serviceTypes) {
              try {
                  const sv = JSON.parse(s.serviceTypes)
                  if (Array.isArray(sv)) setSelectedServices(sv)
              } catch { /* ignore */ }
          }
        }
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const paramsError = searchParams.get("error")

  const getErrorMessage = (err: string | null) => {
    if (!err) return null
    if (err === "AccountPendingApproval") {
      return "Your account is currently pending approval by our administration team. You will be notified once your account has been verified and active."
    }
    return err
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>, section: string) {
    e.preventDefault()
    setSaving(section)
    setError(null)
    setSuccess(null)

    const formData = new FormData(e.currentTarget)
    formData.append("section", section)
    
    if (section === "property") {
        selectedCuisines.forEach(c => formData.append("cuisines", c))
        selectedServices.forEach(s => formData.append("services", s))
    }

    if (section === "user") {
        const phone = (formData.get("phone") as string | null)?.trim()
        const phoneCountryCode = (formData.get("phoneCountryCode") as string | null)?.trim()
        if (!phone || !phoneCountryCode) {
            setError("Phone and country code are required.")
            setSaving(null)
            return
        }
        if (!/^\+?[0-9]+$/.test(phoneCountryCode)) {
            setError("Country code must contain only numbers (optionally starting with +).")
            setSaving(null)
            return
        }
        if (!/^[0-9]+$/.test(phone)) {
            setError("Phone number must contain only numbers.")
            setSaving(null)
            return
        }
    }

    let isReloading = false
    try {
        const res = await fetch("/api/restaurant-seller/settings", { method: "PUT", body: formData })
        if (!res.ok) {
            const data = await res.json()
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
            const refresh = await fetch("/api/restaurant-seller/settings")
            if (refresh.ok) setSeller(await refresh.json())
        }
    } catch (err: any) {
        setError(err.message)
    } finally {
        if (!isReloading) {
            setSaving(null)
        }
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
      setPreviews(prev => ({ ...prev, [key]: { file, url } }))
    }
  }

  if (loading || !seller) return <PageLoader message="Loading restaurant settings…" />

  const isApproved = seller.isApproved
  const isPending = seller.status === "PENDING"
  const isCorrection = seller.status === "CORRECTION_NEEDED"
  const isRejected = seller.status === "REJECTED"

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Restaurant Settings</h1>
        <div className="flex gap-2">
            {!isApproved && isPending && <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending Approval</Badge>}
            {isCorrection && <Badge variant="destructive">Correction Needed</Badge>}
            {isRejected && <Badge variant="destructive">Rejected</Badge>}
            {isApproved && <Badge className="bg-green-100 text-green-800 border-green-200">Approved & Active</Badge>}
        </div>
      </div>

      {(paramsError || error) && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{getErrorMessage(paramsError) || error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50 text-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {isCorrection && seller.adminFeedback && (
          <Alert variant="destructive" className="mb-6 border-2">
            <AlertTitle className="font-bold">Admin Feedback:</AlertTitle>
            <AlertDescription className="text-lg italic">"{seller.adminFeedback}"</AlertDescription>
          </Alert>
      )}

      <div className="grid gap-8">
        {/* USER INFO */}
        <Card>
          <CardHeader><CardTitle>Account Profile</CardTitle><CardDescription>Primary login and contact info</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={(e) => handleSave(e, "user")} className="space-y-4">
               <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Email</Label><Input value={seller.user.email} disabled className="bg-muted" /></div>
                  <div className="space-y-2"><Label>Full Name</Label><Input name="name" defaultValue={seller.user.name || ""} /></div>
               </div>
               <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Country Code</Label><Input name="phoneCountryCode" defaultValue={seller.user.phoneCountryCode || ""} /></div>
                  <div className="space-y-2"><Label>Phone Number</Label><Input name="phone" defaultValue={seller.user.phone || ""} /></div>
               </div>
                <div className="grid md:grid-cols-2 gap-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label>Current Password (Required for password change)</Label>
                    <div className="relative">
                      <Input 
                        name="currentPassword" 
                        type={showCurrentPassword ? "text" : "password"} 
                        placeholder="Enter current password" 
                        className="pr-10"
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
                    <Label>New Password (Optional)</Label>
                    <div className="relative">
                      <Input 
                        name="password" 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Leave blank to keep current" 
                        className="pr-10"
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
               <div className="pt-2"><Label>Profile Picture</Label><ProfilePictureInput currentImage={seller.user.image} fileInputName="profileImage" urlInputName="image" /></div>
               <Button type="submit" disabled={saving === "user"}>{saving === "user" ? "Saving..." : "Update Profile"}</Button>
            </form>
          </CardContent>
        </Card>

        {/* BUSINESS INFO */}
        <Card>
          <CardHeader><CardTitle>Business Details</CardTitle><CardDescription>Legal restaurant entity information</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={(e) => handleSave(e, "business")} className="space-y-4">
               <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Legal Business Name</Label><Input name="businessName" defaultValue={seller.businessInfo?.businessName || ""} /></div>
                  <div className="space-y-2">
                    <Label>Business Type</Label>
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
               <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2"><Label>TIN / PAN Number</Label><Input name="taxIdNumber" defaultValue={seller.businessInfo?.taxIdNumber || ""} /></div>
                  <div className="flex flex-col justify-end pb-1 space-y-2">
                    <div className="flex items-center gap-2">
                        <Checkbox id="haveGst" name="haveGst" value="true" checked={haveGst} onChange={(e: any) => setHaveGst(e.target.checked)} />
                        <Label htmlFor="haveGst" className="cursor-pointer">Business has GST</Label>
                    </div>
                  </div>
               </div>
               <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="managerName">Manager (POC) Name *</Label>
                    <Input id="managerName" name="managerName" defaultValue={seller.businessInfo?.managerName || ""} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pocContact">POC Contact Number *</Label>
                    <Input id="pocContact" name="pocContact" defaultValue={seller.businessInfo?.pocContact || ""} required />
                  </div>
               </div>
               {haveGst && (
                   <div className="grid md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-2"><Label>GST Number</Label><Input name="gstInvNo" defaultValue={seller.businessInfo?.gstInvNo || ""} /></div>
                      <div className="space-y-2"><Label>GST Customer Name</Label><Input name="gstCustomerName" defaultValue={seller.businessInfo?.gstCustomerName || ""} /></div>
                   </div>
               )}
               <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2"><Label>Landmark</Label><Input name="landmark" defaultValue={seller.businessInfo?.landmark || ""} /></div>
                  <div className="space-y-2"><Label>City</Label><Input name="city" defaultValue={seller.businessInfo?.city || ""} /></div>
               </div>
               <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2"><Label>Area</Label><Input name="district" defaultValue={seller.businessInfo?.district || ""} /></div>
                  <div className="space-y-2"><Label>State</Label><Input name="state" defaultValue={seller.businessInfo?.state || ""} /></div>
               </div>
               <div className="pt-2">
                  <Label>Registration Certificate</Label>
                  <div className="flex items-center gap-3 mt-1">
                     <Input name="busRegCert" type="file" className="max-w-xs" />
                     {seller.businessInfo?.busRegCertUrl && <a href={seller.businessInfo.busRegCertUrl} target="_blank" className="text-primary hover:underline text-sm flex items-center gap-1"><FileText className="h-4 w-4" /> View Current</a>}
                  </div>
               </div>
               <div className="pt-2">
                  <Label>City Council Certificate</Label>
                  <div className="flex items-center gap-3 mt-1">
                     <Input name="cityCouncilCert" type="file" className="max-w-xs" />
                     {seller.businessInfo?.cityCouncilCertUrl && <a href={seller.businessInfo.cityCouncilCertUrl} target="_blank" className="text-primary hover:underline text-sm flex items-center gap-1"><FileText className="h-4 w-4" /> View Current</a>}
                  </div>
               </div>
               <div className="pt-2">
                  <Label>GST TIN Certificate</Label>
                  <div className="flex items-center gap-3 mt-1">
                     <Input name="gstTinCert" type="file" className="max-w-xs" />
                     {seller.businessInfo?.gstTinCertUrl && <a href={seller.businessInfo.gstTinCertUrl} target="_blank" className="text-primary hover:underline text-sm flex items-center gap-1"><FileText className="h-4 w-4" /> View Current</a>}
                  </div>
               </div>
               <div className="pt-2">
                  <Label>Proof of Address (Edsa, Guma, etc.)</Label>
                  <div className="flex items-center gap-3 mt-1">
                     <Input name="addressProof" type="file" className="max-w-xs" />
                     {seller.businessInfo?.addressProofUrl && <a href={seller.businessInfo.addressProofUrl} target="_blank" className="text-primary hover:underline text-sm flex items-center gap-1"><FileText className="h-4 w-4" /> View Current</a>}
                  </div>
               </div>
               <Button type="submit" disabled={saving === "business"}>{saving === "business" ? "Saving..." : "Update Business Info"}</Button>
            </form>
          </CardContent>
        </Card>

        {/* KYC & LICENSE */}
        <Card>
          <CardHeader><CardTitle>KYC & Food License</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => handleSave(e, "kyc")} className="space-y-4">
               <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ID Type</Label>
                    <Select name="idType" defaultValue={seller.kyc?.idType || "National ID Card"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="National ID Card">National ID Card</SelectItem>
                        <SelectItem value="Passport">Passport</SelectItem>
                        <SelectItem value="Driver's License">Driver's License</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>ID Number</Label><Input name="idNumber" defaultValue={seller.kyc?.idNumber || ""} /></div>
               </div>
               <div className="space-y-2 pt-4 border-t">
                  <Label>Food License Number</Label>
                  <Input name="foodLicenseNumber" defaultValue={seller.kyc?.foodLicenseNumber || ""} />
               </div>
               <div className="grid md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label>ID Front</Label>
                    <div className="mt-1">
                      {seller.kyc?.idFrontUrl && <a href={seller.kyc.idFrontUrl} target="_blank" className="text-primary hover:underline text-xs flex items-center gap-1 mb-2"><FileText className="h-4 w-4" /> View Current</a>}
                      <Input name="idFront" type="file" onChange={(e) => handleFileChange(e, "idFront")} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>ID Back</Label>
                    <div className="mt-1">
                      {seller.kyc?.idBackUrl && <a href={seller.kyc.idBackUrl} target="_blank" className="text-primary hover:underline text-xs flex items-center gap-1 mb-2"><FileText className="h-4 w-4" /> View Current</a>}
                      <Input name="idBack" type="file" onChange={(e) => handleFileChange(e, "idBack")} />
                    </div>
                  </div>
               </div>
               <div className="grid md:grid-cols-2 gap-4 pt-2 border-t">
                  <div className="space-y-2">
                    <Label>Selfie Verification</Label>
                    <div className="mt-1">
                      {seller.kyc?.selfieUrl && <a href={seller.kyc.selfieUrl} target="_blank" className="text-primary hover:underline text-xs flex items-center gap-1 mb-2"><FileText className="h-4 w-4" /> View Current</a>}
                      <Input name="selfie" type="file" onChange={(e) => handleFileChange(e, "selfie")} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Food License Copy</Label>
                    <div className="mt-1">
                      {seller.kyc?.foodLicenseUrl && <a href={seller.kyc.foodLicenseUrl} target="_blank" className="text-primary hover:underline text-xs flex items-center gap-1 mb-2"><FileText className="h-4 w-4" /> View Current</a>}
                      <Input name="foodLicense" type="file" onChange={(e) => handleFileChange(e, "foodLicense")} />
                    </div>
                  </div>
               </div>
               <Button type="submit" disabled={saving === "kyc"}>{saving === "kyc" ? "Saving..." : "Update KYC & License"}</Button>
            </form>
          </CardContent>
        </Card>

        {/* OUTLET INFO */}
        <Card>
           <CardHeader><CardTitle>Outlet Visuals & Setup</CardTitle></CardHeader>
           <CardContent>
             <form onSubmit={(e) => handleSave(e, "property")} className="space-y-6">
                <div className="space-y-2"><Label>Estimate Restaurant Count</Label><Input name="estimateRestaurantCount" type="number" defaultValue={seller.estimateRestaurantCount || ""} /></div>
                
                <div className="grid md:grid-cols-2 gap-6 pt-4 border-t">
                   <div className="space-y-3">
                      <Label>Primary Cuisines</Label>
                      <div className="grid grid-cols-1 gap-1 p-3 bg-slate-50 rounded-xl border max-h-40 overflow-y-auto">
                        {CUISINES.map(c => (
                            <label key={c} className="flex items-center gap-2 cursor-pointer p-1">
                               <input 
                                  type="checkbox" 
                                  checked={selectedCuisines.includes(c)}
                                  onChange={(e) => {
                                      if (e.target.checked) setSelectedCuisines([...selectedCuisines, c])
                                      else setSelectedCuisines(selectedCuisines.filter(x => x !== c))
                                  }}
                               />
                               <span className="text-xs font-medium">{c}</span>
                            </label>
                        ))}
                      </div>
                   </div>
                   <div className="space-y-3">
                      <Label>Service Types</Label>
                      <div className="grid grid-cols-1 gap-1 p-3 bg-slate-50 rounded-xl border">
                        {SERVICE_TYPES.map(s => (
                            <label key={s} className="flex items-center gap-2 cursor-pointer p-1">
                               <input 
                                  type="checkbox" 
                                  checked={selectedServices.includes(s)}
                                  onChange={(e) => {
                                      if (e.target.checked) setSelectedServices([...selectedServices, s])
                                      else setSelectedServices(selectedServices.filter(x => x !== s))
                                  }}
                               />
                               <span className="text-xs font-medium">{s}</span>
                            </label>
                        ))}
                      </div>
                   </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6 pt-4 border-t">
                   <div className="space-y-2">
                      <Label>Restaurant Logo</Label>
                      <div className="mt-1 flex flex-col items-center gap-2 p-4 border rounded-xl bg-slate-50">
                        { (previews.logo || seller.logo) && <img src={previews.logo ? previews.logo.url : seller.logo} className="w-20 h-20 object-cover rounded-lg border shadow-sm" /> }
                        <Input name="logo" type="file" accept="image/*" onChange={(e) => handleFileChange(e, "logo")} />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <Label>Banner Image</Label>
                      <div className="mt-1 flex flex-col items-center gap-2 p-4 border rounded-xl bg-slate-50">
                        { (previews.banner || seller.banner) && <img src={previews.banner ? previews.banner.url : seller.banner} className="w-full aspect-video object-cover rounded-lg border shadow-sm" /> }
                        <Input name="banner" type="file" accept="image/*" onChange={(e) => handleFileChange(e, "banner")} />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <Label>Main Outlet Photo</Label>
                      <div className="mt-1 flex flex-col items-center gap-2 p-4 border rounded-xl bg-slate-50">
                        { (previews.mainPhoto || seller.mainPhoto) && <img src={previews.mainPhoto ? previews.mainPhoto.url : seller.mainPhoto} className="w-full aspect-video object-cover rounded-lg border shadow-sm" /> }
                        <Input name="mainPhoto" type="file" accept="image/*" onChange={(e) => handleFileChange(e, "mainPhoto")} />
                      </div>
                   </div>
                </div>
                <Button type="submit" disabled={saving === "property"}>{saving === "property" ? "Saving..." : "Update Outlet Visuals"}</Button>
             </form>
           </CardContent>
        </Card>

        {/* BANK DETAILS */}
        <Card>
           <CardHeader><CardTitle>Payout Account</CardTitle></CardHeader>
           <CardContent>
             <form onSubmit={(e) => handleSave(e, "bank")} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Bank Name</Label><Input name="bankName" defaultValue={seller.bankDetails?.bankName || ""} /></div>
                    <div className="space-y-2"><Label>Bank Address</Label><Input name="bankAddress" defaultValue={seller.bankDetails?.bankAddress || ""} /></div>
                 </div>
                 <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Account Holder</Label><Input name="accountHolderName" defaultValue={seller.bankDetails?.accountHolderName || ""} /></div>
                    <div className="space-y-2"><Label>Account Number</Label><Input name="accountNumber" defaultValue={seller.bankDetails?.accountNumber || ""} /></div>
                 </div>
                 <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>BBAN Number</Label><Input name="bbanNumber" defaultValue={seller.bankDetails?.bbanNumber || ""} /></div>
                    <div className="space-y-2"><Label>Branch / IFSC</Label><Input name="branchName" defaultValue={seller.bankDetails?.branchName || ""} /></div>
                 </div>
                 <div className="grid md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                       <Label>Mobile Money Option</Label>
                       <Select name="mobileMoneyOption" defaultValue={seller.bankDetails?.mobileMoneyOption || "Orange Money"}>
                         <SelectTrigger><SelectValue /></SelectTrigger>
                         <SelectContent>
                           <SelectItem value="Orange Money">Orange Money</SelectItem>
                           <SelectItem value="Africell Money">Africell Money</SelectItem>
                         </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label>Preferred Payout Method</Label>
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
                       <Label>Passbook / Check Copy</Label>
                       <div className="flex items-center gap-3 mt-1">
                          <Input name="passbook" type="file" />
                          {seller.bankDetails?.passbookUrl && <a href={seller.bankDetails.passbookUrl} target="_blank" className="text-primary hover:underline text-sm flex items-center gap-1"><FileText className="h-4 w-4" /> View Current</a>}
                       </div>
                    </div>
                    <div className="space-y-2">
                       <Label>Bank Letter with Account No.</Label>
                       <div className="flex items-center gap-3 mt-1">
                          <Input name="bankLetter" type="file" />
                          {seller.bankDetails?.bankLetterUrl && <a href={seller.bankDetails.bankLetterUrl} target="_blank" className="text-primary hover:underline text-sm flex items-center gap-1"><FileText className="h-4 w-4" /> View Current</a>}
                       </div>
                    </div>
                 </div>
                 <Button type="submit" disabled={saving === "bank"}>{saving === "bank" ? "Saving..." : "Update Payout Details"}</Button>
             </form>
           </CardContent>
        </Card>
      </div>
    </div>
  )
}
