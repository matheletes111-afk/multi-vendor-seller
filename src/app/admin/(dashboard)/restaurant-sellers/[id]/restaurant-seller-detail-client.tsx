"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { 
  Building2, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Ban, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  CreditCard,
  Briefcase,
  UtensilsCrossed as RestaurantIcon,
  ExternalLink,
  ShieldCheck,
  Globe,
  Utensils
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RestaurantSellerDetailsView } from "@/components/admin/sellers/restaurant-seller-details-view"
import Link from "next/link"


interface RestaurantSellerDetailClientProps {
  seller: any
}

export function RestaurantSellerDetailClient({ seller }: RestaurantSellerDetailClientProps) {
  const router = useRouter()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectDialog, setRejectDialog] = useState({ open: false, id: "", action: "" })
  const [feedback, setFeedback] = useState("")

  const handleStatusUpdate = async (id: string, action: string, feedbackText?: string) => {
    try {
      setActionLoading(id)
      const res = await fetch(`/api/admin/restaurant-sellers/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, feedback: feedbackText }),
      })

      if (res.ok) {
        router.refresh()
        setRejectDialog({ open: false, id: "", action: "" })
        setFeedback("")
      }
    } catch (error: any) {
      console.error(error)
    } finally {
      setActionLoading(null)
    }
  }

  const openFeedbackDialog = (id: string, action: string) => {
    setRejectDialog({ open: true, id, action })
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 bg-white shadow-sm border border-slate-200" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black tracking-tight text-slate-900">{seller.businessInfo?.businessName || "Restaurant Partner"}</h1>
              <Badge className={cn(
                "rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-widest border-none",
                seller.isApproved ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
              )}>
                {seller.isApproved ? "Verified Partner" : "Verification Pending"}
              </Badge>
              {seller.isSuspended && (
                <Badge variant="destructive" className="rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest animate-pulse">Account Suspended</Badge>
              )}
            </div>
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" /> {seller.user.email} • ID: {seller.id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!seller.isApproved && (
            <>
              <Button 
                variant="outline" 
                className="rounded-full border-blue-200 text-blue-700 hover:bg-blue-50 font-bold px-6 h-12 uppercase tracking-widest text-[10px]"
                onClick={() => openFeedbackDialog(seller.id, "correction")}
                disabled={!!actionLoading}
              >
                Request Correction
              </Button>
              <Button 
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 h-12 shadow-lg shadow-emerald-200 uppercase tracking-widest text-[10px]"
                onClick={() => handleStatusUpdate(seller.id, "approve")}
                disabled={!!actionLoading}
              >
                Approve Partner
              </Button>
            </>
          )}
          {seller.isApproved && (
             seller.isSuspended ? (
              <Button 
                className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 h-12 uppercase tracking-widest text-[10px]"
                onClick={() => handleStatusUpdate(seller.id, "unsuspend")}
                disabled={!!actionLoading}
              >
                Lift Suspension
              </Button>
             ) : (
              <Button 
                variant="destructive"
                className="rounded-full font-bold px-8 h-12 uppercase tracking-widest text-[10px]"
                onClick={() => handleStatusUpdate(seller.id, "suspend")}
                disabled={!!actionLoading}
              >
                Suspend Partner
              </Button>
             )
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-12">
          <RestaurantSellerDetailsView 
            seller={seller}
            actionLoading={actionLoading}
            onApprove={(id) => handleStatusUpdate(id, "approve")}
            onSuspend={(id) => handleStatusUpdate(id, "suspend")}
            onUnsuspend={(id) => handleStatusUpdate(id, "unsuspend")}
            onOpenCorrection={(id) => openFeedbackDialog(id, "correction")}
            onOpenReject={(id) => openFeedbackDialog(id, "reject")}
          />
        </div>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={val => !val && setRejectDialog({ open: false, id: "", action: "" })}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Administrative Feedback</DialogTitle>
            <DialogDescription className="text-slate-500 font-medium">
              Provide clear instructions to the partner on why this action is being taken.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Feedback Message</Label>
              <Textarea 
                placeholder="Details of corrections needed or reasons for rejection..." 
                className="min-h-[150px] rounded-2xl bg-slate-50 border-slate-100 focus:ring-blue-500"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-full font-bold px-6" onClick={() => setRejectDialog({ open: false, id: "", action: "" })}>Cancel</Button>
            <Button 
              className={cn(
                "rounded-full font-bold px-8 uppercase tracking-widest text-[10px]",
                rejectDialog.action === "REJECTED" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
              )}
              onClick={() => handleStatusUpdate(rejectDialog.id, rejectDialog.action, feedback)}
              disabled={!feedback.trim() || !!actionLoading}
            >
              Confirm {rejectDialog.action === "REJECTED" ? "Rejection" : "Correction Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
