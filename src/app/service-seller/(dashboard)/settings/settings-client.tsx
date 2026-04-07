"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Eye, EyeOff, FileText, CheckCircle2, AlertCircle } from "lucide-react"
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
import Checkbox from "@/ui/checkbox-v2"
import { cn } from "@/lib/utils"

export function ServiceSettingsClient() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [seller, setSeller] = useState<any>(null)
  const [serviceCategories, setServiceCategories] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [haveGst, setHaveGst] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [sellerRes, catsRes] = await Promise.all([
          fetch("/api/service-seller/settings"),
          fetch("/api/service-categories")
        ])
        if (catsRes.ok) {
          const catsData = await catsRes.json()
          setServiceCategories(catsData.categories || [])
        }
        if (sellerRes.ok) {
          const s = await sellerRes.json()
          setSeller(s)
          if (s.businessInfo) setHaveGst(!!s.businessInfo.haveGst)
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
        return "Your account application is currently pending review by our administration team. You will be notified once your account is fully verified and ready for listing services."
    }
    return err
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>, section: string) {
    e.preventDefault()
    setSaving(section)
    setError(null)
    setSuccess(null)

    const formData = new FormData(e.currentTarget)
    try {
        let res: Response
        const hasFiles = Array.from(formData.values()).some(v => v instanceof File && v.size > 0)

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

        setSuccess(`${section.charAt(0).toUpperCase() + section.slice(1)} info updated!`)
        const refresh = await fetch("/api/service-seller/settings")
        if (refresh.ok) setSeller(await refresh.json())
    } catch (err: any) {
        setError(err.message)
    } finally {
        setSaving(null)
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

      {(paramsError || error) && (
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
                  <div className="space-y-2"><Label>Country Code</Label><Input name="phoneCountryCode" defaultValue={seller.user.phoneCountryCode || ""} /></div>
                  <div className="space-y-2"><Label>Phone Number</Label><Input name="phone" defaultValue={seller.user.phone || ""} /></div>
               </div>
               <div className="grid md:grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label className="text-emerald-800 font-semibold">National Identity Number (NIN)</Label>
                    <Input name="nationIdentityNumber" defaultValue={seller.nationIdentityNumber || ""} placeholder="Enter 11-digit NIN" className="focus:ring-emerald-500" />
                  </div>
               </div>
               <div className="grid md:grid-cols-1 gap-4 border-t pt-4">
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
                   <Label>Do you have GST? *</Label>
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
                 {haveGst && (
                   <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                     <Label>Tin no (Tax ID) *</Label>
                     <Input name="taxIdNumber" defaultValue={seller.businessInfo?.taxIdNumber || ""} required={haveGst} />
                   </div>
                 )}
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
                     <Label>Inv No *</Label>
                     <Input name="gstInvNo" defaultValue={seller.businessInfo?.gstInvNo || ""} required={haveGst} />
                   </div>
                 </div>
               )}
               <div className="space-y-2 pt-2">
                  <Label>Registration Document</Label>
                  <div className="flex items-center gap-3">
                     <Input name="busRegCert" type="file" className="max-w-xs" />
                     {seller.businessInfo?.busRegCertUrl && <a href={seller.businessInfo.busRegCertUrl} target="_blank" className="text-primary hover:underline text-sm flex items-center gap-1"><FileText className="h-4 w-4" /> View Current</a>}
                  </div>
               </div>
               <div className="grid md:grid-cols-3 gap-4 border-t pt-4">
                  <div className="space-y-2"><Label>Street</Label><Input name="street" defaultValue={seller.businessInfo?.street || ""} /></div>
                  <div className="space-y-2"><Label>City</Label><Input name="city" defaultValue={seller.businessInfo?.city || ""} /></div>
                  <div className="space-y-2"><Label>District</Label><Input name="district" defaultValue={seller.businessInfo?.district || ""} /></div>
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
                   <div className="space-y-2"><Label>Bank</Label><Input name="bankName" defaultValue={seller.bankDetails?.bankName || ""} /></div>
                   <div className="space-y-2"><Label>Account Name</Label><Input name="accountHolderName" defaultValue={seller.bankDetails?.accountHolderName || ""} /></div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                   <div className="space-y-2"><Label>Account No.</Label><Input name="accountNumber" defaultValue={seller.bankDetails?.accountNumber || ""} /></div>
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
                        <SelectContent><SelectItem value="Bank Transfer">Bank Transfer</SelectItem><SelectItem value="Mobile Wallet">Mobile Wallet</SelectItem></SelectContent>
                      </Select>
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
                 
                 <div className="space-y-3 pt-4 border-t">
                    <Label className="font-bold">Authorized Service Categories</Label>
                    <p className="text-xs text-muted-foreground mb-4">You can only list services in these categories. Contact admin to add more.</p>
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
                               <span className="text-sm font-medium">{cat.name}</span>
                            </label>
                        ))}
                    </div>
                 </div>
                 
                 <Button type="submit" disabled={saving === "store"}>{saving === "store" ? "Saving..." : "Update Store Info"}</Button>
              </form>
           </CardContent>
        </Card>
      </div>
    </div>
  )
}
