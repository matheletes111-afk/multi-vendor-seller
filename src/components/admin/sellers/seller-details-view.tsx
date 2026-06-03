"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { DocumentThumbnail } from "@/components/admin/document-viewer"
import {
  User,
  Mail,
  Phone,
  FileText,
  Scale,
  MapPin,
  Store,
  MapPinned,
  CreditCard,
  Building2,
  Fingerprint,
  Handshake,
  Check,
  X,
  AlertCircle,
  CheckCircle,
} from "lucide-react"

interface SellerDetailsViewProps {
  seller: any
  actionLoading?: string | null
  onApprove?: (id: string) => void
  onSuspend?: (id: string) => void
  onUnsuspend?: (id: string) => void
  onOpenCommission?: (id: string, rate: number | "") => void
  onOpenCorrection?: (id: string) => void
  onOpenReject?: (id: string) => void
}

export function SellerDetailsView({
  seller,
  actionLoading,
  onApprove,
  onSuspend,
  onUnsuspend,
  onOpenCommission,
  onOpenCorrection,
  onOpenReject
}: SellerDetailsViewProps) {
  if (!seller) return null

  return (
    <div className="space-y-8 animate-in slide-in-from-top-4 duration-500">
      <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">

        {/* PART 1: CORPORATE DNA - Identity */}
        <Card className="border border-muted/50 shadow-xl bg-background rounded-3xl overflow-hidden flex flex-col border-l-4 border-l-blue-500/40">
          <CardHeader className="bg-muted/30 pb-4 border-b border-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-blue-600">
                <User className="h-4 w-4" /> Personal / Corporate Identity
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 flex-1">
            {seller.user?.image && (
              <div className="pb-2">
                <DocumentThumbnail url={seller.user.image} title="Profile Picture" />
              </div>
            )}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-xl"><User className="h-3.5 w-3.5 text-muted-foreground" /></div>
                <div className="flex flex-col"><span className="text-[10px] font-medium text-muted-foreground/60">Legal Name</span><span className="text-sm font-medium">{seller.user?.name || "—"}</span></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-xl"><Mail className="h-3.5 w-3.5 text-muted-foreground" /></div>
                <div className="flex flex-col"><span className="text-[10px] font-medium text-muted-foreground/60">Email</span><span className="text-sm font-medium">{seller.user?.email}</span></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-xl"><Phone className="h-3.5 w-3.5 text-muted-foreground" /></div>
                <div className="flex flex-col"><span className="text-[10px] font-medium text-muted-foreground/60">Contact</span><span className="text-sm font-medium">{seller.user?.phoneCountryCode} {seller.user?.phone}</span></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-xl"><FileText className="h-3.5 w-3.5 text-muted-foreground" /></div>
                <div className="flex flex-col"><span className="text-[10px] font-medium text-muted-foreground/60">NIN</span><span className="text-sm font-medium">{seller.nationIdentityNumber || "Pending"}</span></div>
              </div>
            </div>

            {seller.adminFeedback && (
              <div className="mt-4 p-3 bg-red-500/5 rounded-2xl border border-red-500/10">
                <span className="text-[8px] font-medium uppercase text-red-600 tracking-widest block mb-1">Administrative Memo</span>
                <p className="text-xs font-medium text-muted-foreground line-clamp-2 italic">“{seller.adminFeedback}”</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PART 2: LEGAL VENTURE */}
        <Card className="border border-muted/50 shadow-xl bg-background rounded-3xl overflow-hidden flex flex-col border-l-4 border-l-indigo-500/40">
          <CardHeader className="bg-muted/30 pb-4 border-b border-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-indigo-600">
              <Scale className="h-4 w-4" /> Legal Venture
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 flex-1">
            <div className="p-3 bg-muted/40 rounded-xl border border-muted/50">
              <span className="text-[9px] font-medium text-muted-foreground/60 block mb-1">Trade Name</span>
              <span className="text-sm font-medium">{seller.businessInfo?.businessName || seller.store?.name || "—"}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-muted-foreground/60">Structure</span>
                <span className="text-sm font-medium">{seller.businessInfo?.businessType || "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-muted-foreground/60">Registration #</span>
                <span className="text-sm font-medium truncate">{seller.businessInfo?.businessRegNumber || "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-muted-foreground/60">Tax ID / Tin no</span>
                <span className="text-sm font-medium">{seller.businessInfo?.taxIdNumber || "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-muted-foreground/60">GST Registered</span>
                <Badge variant="outline" className={cn("w-fit text-[9px] font-medium uppercase", seller.businessInfo?.haveGst ? "bg-green-500/10 text-green-600 border-green-200" : "bg-red-500/10 text-red-600 border-red-200")}>
                  {seller.businessInfo?.haveGst ? "Yes" : "No"}
                </Badge>
              </div>
              {seller.businessInfo?.haveGst && (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium text-muted-foreground/60">GST Customer Name</span>
                    <span className="text-sm font-medium">{seller.businessInfo?.gstCustomerName || "—"}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium text-muted-foreground/60">GST Identification Number</span>
                    <span className="text-sm font-medium">{seller.businessInfo?.gstInvNo || "—"}</span>
                  </div>
                </>
              )}
            </div>

            <div className="pt-2 flex flex-col gap-3 border-t border-muted">
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium text-muted-foreground/60">Headquarters</span>
                  <span className="text-xs font-medium leading-relaxed">{seller.businessInfo?.street}, {seller.businessInfo?.district}, {seller.businessInfo?.city} {seller.businessInfo?.postalCode}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PART 3: STORE VISUALS & OFFERINGS */}
        <Card className="border border-muted/50 shadow-xl bg-background rounded-3xl overflow-hidden flex flex-col border-l-4 border-l-amber-500/40">
          <CardHeader className="bg-muted/30 pb-4 border-b border-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-amber-600">
              <Store className="h-4 w-4" /> Store Visuals & Offerings
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-3">
              <DocumentThumbnail url={seller.store?.logo} title="Store Logo" />
              <DocumentThumbnail url={seller.store?.banner} title="Store Banner" />
            </div>

            <div className="pt-2 flex flex-col gap-3">
              {seller.store?.address && (
                <div className="flex items-start gap-2 bg-muted/20 p-2 rounded-xl">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wider">Store text location</span>
                    <span className="text-xs font-medium leading-tight">{seller.store.address}</span>
                  </div>
                </div>
              )}

              {seller.store?.lat && seller.store?.lng ? (
                <div className="flex flex-col gap-1.5 mt-2 rounded-xl border border-muted/50 p-2 relative h-28 overflow-hidden group">
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${seller.store.lat},${seller.store.lng}&zoom=15&size=400x150&markers=color:red%7C${seller.store.lat},${seller.store.lng}&key=${process.env.NEXT_PUBLIC_MAP_KEY}`}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-700"
                    alt="Map static"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-background/80 backdrop-blur-sm px-3 py-1 flex justify-between items-center text-[10px] font-medium border-t border-muted/50">
                    <span className="text-primary flex items-center gap-1.5"><MapPinned className="h-3 w-3" /> Pinpoint Location</span>
                    <span>{seller.store.lat.toFixed(5)}, {seller.store.lng.toFixed(5)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col justify-center items-center py-4 bg-muted/10 rounded-xl border border-dashed border-muted/50 h-28">
                  <MapPin className="h-5 w-5 text-muted-foreground/30 mb-2" />
                  <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">Location unlisted</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-muted space-y-2">
              <span className="text-[10px] font-medium uppercase text-muted-foreground/60 tracking-[0.2em]">{seller.type === "PRODUCT" ? "Authorized Categories" : "Authorized Services"}</span>
              <div className="flex flex-wrap gap-1.5">
                {(seller.type === "PRODUCT" ? seller.selectedCategories : seller.selectedServiceCategories)?.map((c: any) => (
                  <Badge 
                    key={c.id} 
                    variant={c.isActive ? "outline" : "secondary"} 
                    className={cn(
                      "rounded-full text-[9px] font-medium uppercase tracking-tighter",
                      c.isActive 
                        ? "bg-primary/5 border-primary/20 text-primary" 
                        : "bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1"
                    )}
                  >
                    {c.name} {!c.isActive && <span className="text-[7px] opacity-70">(Suggested)</span>}
                  </Badge>
                )) || <span className="text-xs text-muted-foreground font-medium">Undefined</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PART 4: FINANCIAL ANCHOR */}
        <Card className="border border-muted/50 shadow-xl bg-background rounded-3xl overflow-hidden flex flex-col border-l-4 border-l-emerald-500/40">
          <CardHeader className="bg-muted/30 pb-4 border-b border-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-emerald-600">
              <CreditCard className="h-4 w-4" /> Financial Anchor
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 flex-1">
            <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-medium text-emerald-600/60 ml-1">Bank Name</span>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-500/10 font-medium text-sm text-emerald-700 shadow-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> {seller.bankDetails?.bankName || "—"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-medium text-muted-foreground/60 mb-1 ml-1">Beneficiary</span>
                    <span className="text-xs font-medium truncate">{seller.bankDetails?.accountHolderName || "—"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-medium text-muted-foreground/60 mb-1 ml-1">Branch</span>
                    <span className="text-xs font-medium truncate">{seller.bankDetails?.branchName || "Main Branch"}</span>
                  </div>
                </div>

                <div className="flex flex-col p-3 bg-white rounded-xl border border-emerald-500/10 shadow-inner">
                  <span className="text-[9px] font-medium text-muted-foreground/60 mb-1">Account Signature</span>
                  <span className="text-sm font-mono font-medium tracking-tight text-emerald-800">{seller.bankDetails?.accountNumber || "—"}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-medium text-muted-foreground/60">Payout Channel</span>
                <Badge className="bg-emerald-500/10 text-emerald-700 border-none rounded-full font-medium text-[9px] uppercase tracking-widest">{seller.bankDetails?.preferredPayoutMethod || "Transfer"}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PART 5: KYC EVIDENCE */}
        <Card className="border border-muted/50 shadow-xl bg-background rounded-3xl overflow-hidden flex flex-col border-l-4 border-l-rose-500/40 md:col-span-2 2xl:col-span-1">
          <CardHeader className="bg-muted/30 pb-4 border-b border-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-rose-600">
              <Fingerprint className="h-4 w-4" /> KYC EVIDENCE
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6 flex-1">
            <div className="flex justify-between items-center bg-rose-500/5 p-3 rounded-xl border border-rose-500/10">
              <div className="flex flex-col"><span className="text-[9px] font-medium text-rose-600/60 mb-0.5">Verification Method</span><span className="text-xs font-medium">{seller.kyc?.idType || "Biometric"}</span></div>
              <div className="text-xs font-mono font-medium tracking-normal bg-white px-2.5 py-1 rounded-lg shadow-sm border border-rose-100">{seller.kyc?.idNumber || "—"}</div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-2 gap-3">
              <DocumentThumbnail url={seller.kyc?.idFrontUrl} title="ID Front Image" />
              <DocumentThumbnail url={seller.kyc?.idBackUrl} title="ID Back Image" />
              <DocumentThumbnail url={seller.kyc?.selfieUrl} title="Live Selfie" />
              <DocumentThumbnail url={seller.businessInfo?.busRegCertUrl} title="Business Reg Document" mimeType="application/pdf" />
              <DocumentThumbnail url={seller.businessInfo?.cityCouncilCertUrl} title="City Council Cert" mimeType="application/pdf" />
              <DocumentThumbnail url={seller.businessInfo?.gstTinCertUrl} title="GST TIN Cert" mimeType="application/pdf" />
              <DocumentThumbnail url={seller.businessInfo?.addressProofUrl} title="Proof of Address" mimeType="application/pdf" />
              <DocumentThumbnail url={seller.bankDetails?.passbookUrl} title="Bank Passbook" />
              <DocumentThumbnail url={seller.bankDetails?.bankLetterUrl} title="Bank Letter" mimeType="application/pdf" />
            </div>
          </CardContent>
        </Card>

        {/* PART 6: AGREEMENTS & COMPLIANCE */}
        <Card className="border border-muted/50 shadow-xl bg-background rounded-3xl overflow-hidden flex flex-col border-l-4 border-l-purple-500/40">
          <CardHeader className="bg-muted/30 pb-4 border-b border-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-purple-600">
              <Handshake className="h-4 w-4" /> Agreements & Policies
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col items-center justify-center flex-1 space-y-4">
            {seller.agreement ? (
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-muted">
                  <span className="text-xs font-medium text-muted-foreground">General Terms Accepted</span>
                  <Badge className={cn("rounded-full h-5 w-5 p-0 flex items-center justify-center border-none", seller.agreement.agreedToTerms ? "bg-emerald-500" : "bg-red-500")}>
                    {seller.agreement.agreedToTerms ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-muted">
                  <span className="text-xs font-medium text-muted-foreground">Privacy Policy Accepted</span>
                  <Badge className={cn("rounded-full h-5 w-5 p-0 flex items-center justify-center border-none", seller.agreement.agreedToPrivacy ? "bg-emerald-500" : "bg-red-500")}>
                    {seller.agreement.agreedToPrivacy ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-muted">
                  <span className="text-xs font-medium text-muted-foreground">Return Policy Check</span>
                  <Badge className={cn("rounded-full h-5 w-5 p-0 flex items-center justify-center border-none", seller.agreement.agreedToReturnPolicy ? "bg-emerald-500" : "bg-red-500")}>
                    {seller.agreement.agreedToReturnPolicy ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-muted">
                  <span className="text-xs font-medium text-muted-foreground">Commission Details</span>
                  <Badge className={cn("rounded-full h-5 w-5 p-0 flex items-center justify-center border-none", seller.agreement.agreedToCommission ? "bg-emerald-500" : "bg-red-500")}>
                    {seller.agreement.agreedToCommission ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                <AlertCircle className="h-8 w-8 text-amber-500/50" />
                <span className="text-sm font-medium text-muted-foreground block text-balance">The seller has not finalized the agreement stage.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ACTION INFRASTRUCTURE */}
        <div className="md:col-span-2 2xl:col-span-3 flex flex-col md:flex-row items-center justify-between gap-8 p-6 bg-muted/10 rounded-2xl border-2 border-dashed border-muted/50 mt-4">
          <div className="flex items-center gap-6">
            <div className="space-y-1 relative group">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                Onboarding Progress
                {seller.onboardingCompleted && <CheckCircle className="h-3 w-3 text-emerald-500" />}
              </div>
              <div className="text-sm font-medium flex items-center gap-2">
                <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">Step {seller.onboardingStep} of 5</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!seller.isApproved && (
              <div className="flex items-center gap-3">
                <Button
                  className="rounded-full bg-blue-600 hover:bg-blue-700 font-bold px-6 border-none shadow-lg shadow-blue-500/20 uppercase tracking-widest text-[10px] h-9"
                  disabled={actionLoading === seller.id}
                  onClick={() => onOpenCorrection?.(seller.id)}
                >
                  Send for Correction
                </Button>
                <Button
                  className="rounded-full font-bold px-8 border-none shadow-lg shadow-green-500/20 uppercase tracking-widest text-[10px] bg-green-500 hover:bg-green-600 h-9"
                  disabled={actionLoading === seller.id}
                  onClick={() => onApprove?.(seller.id)}
                >
                  Confirm & Approve
                </Button>
                <Button
                  className="rounded-full bg-red-600 hover:bg-red-700 font-bold px-6 border-none shadow-lg shadow-red-500/20 uppercase tracking-widest text-[10px] h-9"
                  disabled={actionLoading === seller.id}
                  onClick={() => onOpenReject?.(seller.id)}
                >
                  Reject Application
                </Button>
              </div>
            )}
            
            <div className="flex items-center gap-3">
               <Button
                variant="outline"
                className="rounded-full font-bold px-6 uppercase tracking-widest text-[10px] h-9 border-amber-200 text-amber-700 hover:bg-amber-50"
                onClick={() => onOpenCommission?.(seller.id, seller.commissionRate || "")}
              >
                Set Commission
              </Button>

              {seller.isSuspended ? (
                <Button
                  className="rounded-full font-bold px-8 border-none shadow-lg shadow-indigo-500/20 uppercase tracking-widest text-[10px] bg-indigo-500 hover:bg-indigo-600 h-9"
                  disabled={actionLoading === seller.id}
                  onClick={() => onUnsuspend?.(seller.id)}
                >
                  Unsuspend Seller
                </Button>
              ) : (
                <Button
                  className="rounded-full font-bold px-8 border-none shadow-lg shadow-destructive/20 uppercase tracking-widest text-[10px] bg-destructive hover:bg-destructive/90 h-9"
                  disabled={actionLoading === seller.id}
                  onClick={() => onSuspend?.(seller.id)}
                >
                  Suspend Seller
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
