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
  Hotel
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
                {categories.map((cat: string) => (
                  <Badge key={cat} variant="secondary" className="rounded-full px-3 py-1 bg-slate-100 text-slate-700 border-none font-bold text-[10px] uppercase">
                    {cat}
                  </Badge>
                ))}
                {categories.length === 0 && <span className="text-xs text-muted-foreground italic">No categories selected.</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business DNA */}
        <Card className="border border-muted/50 shadow-xl bg-background rounded-3xl overflow-hidden flex flex-col border-l-4 border-l-indigo-500/40">
          <CardHeader className="bg-muted/30 pb-4 border-b border-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-indigo-600">
              <Scale className="h-4 w-4" /> Legal Entity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 flex-1">
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
            <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between items-center"><span className="text-[10px] font-medium text-muted-foreground/60">Business Name</span><span className="text-xs font-bold">{seller.businessInfo?.businessName || "—"}</span></div>
                <div className="flex justify-between items-center"><span className="text-[10px] font-medium text-muted-foreground/60">Type</span><span className="text-xs font-bold">{seller.businessInfo?.businessType || "—"}</span></div>
                <div className="flex justify-between items-center"><span className="text-[10px] font-medium text-muted-foreground/60">Tax ID</span><span className="text-xs font-bold">{seller.businessInfo?.taxIdNumber || "—"}</span></div>
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
            {!seller.isApproved && (
              <div className="flex items-center gap-3">
                <Button className="rounded-full bg-blue-600 hover:bg-blue-700 font-bold px-6 uppercase tracking-widest text-[10px] h-10" disabled={actionLoading === seller.id} onClick={() => onOpenCorrection?.(seller.id)}>Send Correction</Button>
                <Button className="rounded-full bg-green-500 hover:bg-green-600 font-bold px-8 uppercase tracking-widest text-[10px] h-10" disabled={actionLoading === seller.id} onClick={() => onApprove?.(seller.id)}>Approve Partner</Button>
                <Button className="rounded-full bg-red-600 hover:bg-red-700 font-bold px-6 uppercase tracking-widest text-[10px] h-10" disabled={actionLoading === seller.id} onClick={() => onOpenReject?.(seller.id)}>Reject</Button>
              </div>
            )}
            {seller.isSuspended ? (
              <Button className="rounded-full font-bold px-8 bg-indigo-500 hover:bg-indigo-600 uppercase tracking-widest text-[10px] h-10" disabled={actionLoading === seller.id} onClick={() => onUnsuspend?.(seller.id)}>Unsuspend</Button>
            ) : (
              <Button variant="destructive" className="rounded-full font-bold px-8 uppercase tracking-widest text-[10px] h-10" disabled={actionLoading === seller.id} onClick={() => onSuspend?.(seller.id)}>Suspend</Button>
            )}
          </div>
      </div>
    </div>
  )
}
