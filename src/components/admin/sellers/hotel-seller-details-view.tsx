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
  Building2,
  CreditCard,
  Fingerprint,
  Handshake,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  ImageIcon,
  Hotel,
  Briefcase,
  Globe,
  Landmark,
  ShieldCheck,
  UserCheck
} from "lucide-react"

interface HotelSellerDetailsViewProps {
  seller: any
  actionLoading?: string | null
  onApprove?: (id: string) => void
  onSuspend?: (id: string) => void
  onUnsuspend?: (id: string) => void
  onOpenCorrection?: (id: string) => void
  onOpenReject?: (id: string) => void
}

export function HotelSellerDetailsView({
  seller,
  actionLoading,
  onApprove,
  onSuspend,
  onUnsuspend,
  onOpenCorrection,
  onOpenReject
}: HotelSellerDetailsViewProps) {
  if (!seller) return null

  const categories = seller.categories ? JSON.parse(seller.categories) : []

  return (
    <div className="space-y-8 animate-in slide-in-from-top-4 duration-500">
      <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">

        {/* Brand Assets */}
        <Card className="border border-muted/50 shadow-xl bg-background rounded-3xl overflow-hidden flex flex-col border-l-4 border-l-orange-500/40">
          <CardHeader className="bg-muted/30 pb-4 border-b border-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-orange-600">
              <ImageIcon className="h-4 w-4" /> Brand Assets & Media
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Logo</span>
                <DocumentThumbnail url={seller.logo} title="Hotel Logo" />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Banner</span>
                <DocumentThumbnail url={seller.banner} title="Hotel Banner" />
              </div>
            </div>
            <div className="pt-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Main Property Photo</span>
              <div className="mt-2 h-40 overflow-hidden rounded-2xl border bg-muted/20">
                {seller.mainPhoto ? (
                  <img src={seller.mainPhoto} alt="Main Property" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground/30"><Hotel className="h-10 w-10" /></div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Property Setup */}
        <Card className="border border-muted/50 shadow-xl bg-background rounded-3xl overflow-hidden flex flex-col border-l-4 border-l-blue-500/40">
          <CardHeader className="bg-muted/30 pb-4 border-b border-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-blue-600">
              <Hotel className="h-4 w-4" /> Property Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-blue-600 uppercase mb-1">Hotel Count</span>
                <span className="text-3xl font-black text-blue-900">{seller.estimateHotelCount || 0}</span>
              </div>
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Room Count</span>
                <span className="text-3xl font-black text-indigo-900">{seller.estimateRoomCount || 0}</span>
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Property Categories</span>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat: string, idx: number) => (
                  <Badge key={`${cat}-${idx}`} variant="secondary" className="rounded-full px-3 py-1 bg-slate-100 text-slate-700 border-none font-bold text-[10px] uppercase">
                    {cat}
                  </Badge>
                ))}
                {categories.length === 0 && <span className="text-xs text-muted-foreground italic">No categories selected.</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Info & POC */}
        <Card className="border border-muted/50 shadow-xl bg-background rounded-3xl overflow-hidden flex flex-col border-l-4 border-l-indigo-500/40">
          <CardHeader className="bg-muted/30 pb-4 border-b border-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-indigo-600">
              <Scale className="h-4 w-4" /> Business Entity & POC
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 flex-1">
            <div className="space-y-3">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-xl"><UserCheck className="h-4 w-4 text-indigo-600" /></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">Manager / POC Name</span>
                    <span className="text-sm font-bold">{seller.businessInfo?.pocName || seller.user?.name || "—"}</span>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-xl"><Phone className="h-4 w-4 text-indigo-600" /></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">POC Contact</span>
                    <span className="text-sm font-bold">{seller.businessInfo?.pocContact || seller.user?.phone || "—"}</span>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-xl"><Landmark className="h-4 w-4 text-indigo-600" /></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">Business Landmark</span>
                    <span className="text-sm font-bold">{seller.businessInfo?.landmark || "—"}</span>
                  </div>
               </div>
            </div>
            
            <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between items-center"><span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tighter">Legal Business Name</span><span className="text-xs font-black">{seller.businessInfo?.businessName || "—"}</span></div>
                <div className="flex justify-between items-center"><span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tighter">Business Type</span><span className="text-xs font-bold">{seller.businessInfo?.businessType || "—"}</span></div>
                <div className="flex justify-between items-center"><span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tighter">Tax / GST ID</span><span className="text-xs font-bold">{seller.businessInfo?.taxIdNumber || "—"}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* KYC & Identity */}
        <Card className="border border-muted/50 shadow-xl bg-background rounded-3xl overflow-hidden flex flex-col border-l-4 border-l-amber-500/40">
          <CardHeader className="bg-muted/30 pb-4 border-b border-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-amber-600">
              <Fingerprint className="h-4 w-4" /> Identity Verification (KYC)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-4 mb-2">
               <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1">ID Front</span>
                  <DocumentThumbnail url={seller.kyc?.idFrontUrl} title="ID Front" />
               </div>
               <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1">ID Back</span>
                  <DocumentThumbnail url={seller.kyc?.idBackUrl} title="ID Back" />
               </div>
            </div>
             <div className="flex flex-col gap-2">
                 <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Live Selfie / Face Verification</span>
                 <DocumentThumbnail url={seller.kyc?.selfieUrl} title="Seller Selfie" />
             </div>
             <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Business Reg</span>
                    <DocumentThumbnail url={seller.businessInfo?.busRegCertUrl} title="Business Registration" mimeType="application/pdf" />
                </div>
                <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1">City Council</span>
                    <DocumentThumbnail url={seller.businessInfo?.cityCouncilCertUrl} title="City Council Cert" mimeType="application/pdf" />
                </div>
                <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1">GST TIN Cert</span>
                    <DocumentThumbnail url={seller.businessInfo?.gstTinCertUrl} title="GST TIN Cert" mimeType="application/pdf" />
                </div>
                <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Proof of Address</span>
                    <DocumentThumbnail url={seller.businessInfo?.addressProofUrl} title="Proof of Address" mimeType="application/pdf" />
                </div>
             </div>
             <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between items-center"><span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tighter">ID Type</span><span className="text-xs font-bold">{seller.kyc?.idType || "—"}</span></div>
                <div className="flex justify-between items-center"><span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tighter">ID Number</span><span className="text-xs font-black">{seller.kyc?.idNumber || "—"}</span></div>
             </div>
          </CardContent>
        </Card>

        {/* Payout / Bank Details */}
        <Card className="border border-muted/50 shadow-xl bg-background rounded-3xl overflow-hidden flex flex-col border-l-4 border-l-emerald-500/40">
          <CardHeader className="bg-muted/30 pb-4 border-b border-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-emerald-600">
              <CreditCard className="h-4 w-4" /> Settlement & Bank Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-5 flex-1">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Account Holder</span>
                <span className="text-base font-black text-emerald-900">{seller.bankDetails?.accountHolderName || "—"}</span>
            </div>
            <div className="space-y-3">
               <div className="flex justify-between items-center"><span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tighter">Bank Name</span><span className="text-sm font-bold">{seller.bankDetails?.bankName || "—"}</span></div>
               <div className="flex justify-between items-center"><span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tighter">Account Number</span><span className="text-sm font-black tracking-wider">{seller.bankDetails?.accountNumber || "—"}</span></div>
               <div className="flex justify-between items-center"><span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tighter">Branch Name</span><span className="text-sm font-bold">{seller.bankDetails?.branchName || "—"}</span></div>
               <div className="flex justify-between items-center"><span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tighter">BBAN Number</span><span className="text-sm font-black">{seller.bankDetails?.bbanNumber || "—"}</span></div>
               <div className="flex justify-between items-center"><span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tighter">Payout Channel</span><Badge className="bg-emerald-500/10 text-emerald-700 border-none rounded-full font-medium text-[9px] uppercase tracking-widest">{seller.bankDetails?.preferredPayoutMethod || "Bank Transfer"}</Badge></div>
               {seller.bankDetails?.preferredPayoutMethod === "Mobile Wallet" && (
                 <div className="flex justify-between items-center"><span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tighter">Mobile Money Option</span><span className="text-sm font-bold">{seller.bankDetails?.mobileMoneyOption || "—"}</span></div>
               )}
            </div>
            <div className="pt-4 border-t grid grid-cols-2 gap-3">
               <div>
                 <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1 mb-2 block">Bank Passbook</span>
                 <DocumentThumbnail url={seller.bankDetails?.passbookUrl || seller.bankDetails?.bankProofUrl} title="Bank Passbook" />
               </div>
               <div>
                 <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1 mb-2 block">Bank Letter</span>
                 <DocumentThumbnail url={seller.bankDetails?.bankLetterUrl} title="Bank Letter" mimeType="application/pdf" />
               </div>
            </div>
          </CardContent>
        </Card>

        {/* Agreement Status */}
        <Card className="border border-muted/50 shadow-xl bg-background rounded-3xl overflow-hidden flex flex-col border-l-4 border-l-slate-500/40">
          <CardHeader className="bg-muted/30 pb-4 border-b border-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-slate-600">
              <ShieldCheck className="h-4 w-4" /> Legal Agreement
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 flex-1">
            <div className="flex flex-col gap-3">
               <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  {seller.agreement?.isAccepted ? (
                    <CheckCircle className="h-6 w-6 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-amber-500" />
                  )}
                  <div>
                    <span className="text-sm font-black block">{seller.agreement?.isAccepted ? "Agreement Accepted" : "Agreement Pending"}</span>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                      {seller.agreement?.acceptedAt ? `Accepted on ${new Date(seller.agreement.acceptedAt).toLocaleDateString()}` : "Waiting for seller signature"}
                    </span>
                  </div>
               </div>
               
               <div className="pt-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1 mb-2 block">Signed Document</span>
                  <DocumentThumbnail url={seller.agreement?.documentUrl} title="Signed Agreement" />
               </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Footer Actions */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-6 bg-muted/10 rounded-[2rem] border-2 border-dashed border-muted/50 mt-4">
          <div className="flex items-center gap-6">
            <div className="space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">Onboarding Progress {seller.onboardingCompleted && <CheckCircle className="h-3 w-3 text-emerald-500" />}</div>
              <div className="text-sm font-medium flex items-center gap-2"><Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 uppercase font-black text-[9px] tracking-widest">Step {seller.onboardingStep} of 6</Badge></div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {seller.isSuspended && (
               <Badge className="bg-red-100 text-red-700 border-red-200 px-4 py-2 rounded-2xl font-black uppercase tracking-widest text-[10px] animate-pulse">Account Suspended</Badge>
            )}
            {!seller.isApproved && (
              <div className="flex items-center gap-3">
                <Button className="rounded-full bg-blue-600 hover:bg-blue-700 font-bold px-6 uppercase tracking-widest text-[10px] h-10" disabled={!!actionLoading} onClick={() => onOpenCorrection?.(seller.id)}>Send Correction</Button>
                <Button className="rounded-full bg-green-500 hover:bg-green-600 font-bold px-8 uppercase tracking-widest text-[10px] h-10" disabled={!!actionLoading} onClick={() => onApprove?.(seller.id)}>Approve Partner</Button>
                <Button className="rounded-full bg-red-600 hover:bg-red-700 font-bold px-6 uppercase tracking-widest text-[10px] h-10" disabled={!!actionLoading} onClick={() => onOpenReject?.(seller.id)}>Reject</Button>
              </div>
            )}
            {seller.isSuspended ? (
              <Button className="rounded-full font-bold px-8 bg-emerald-600 hover:bg-emerald-700 text-white uppercase tracking-widest text-[10px] h-10 shadow-lg shadow-emerald-100" disabled={!!actionLoading} onClick={() => onUnsuspend?.(seller.id)}>Activate Partner</Button>
            ) : (
              seller.isApproved && <Button variant="destructive" className="rounded-full font-bold px-8 uppercase tracking-widest text-[10px] h-10" disabled={!!actionLoading} onClick={() => onSuspend?.(seller.id)}>Suspend Partner</Button>
            )}
          </div>
      </div>
    </div>
  )
}
