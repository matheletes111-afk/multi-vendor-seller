"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { ChevronLeft, MoreHorizontal, User, ShieldCheck } from "lucide-react"
import { SellerDetailsView } from "@/components/admin/sellers/seller-details-view"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Textarea } from "@/ui/textarea"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"
import { CheckCircle, AlertCircle } from "lucide-react"
import { PageLoader } from "@/components/ui/page-loader"

interface SellerIdClientProps {
  id: string
}

export function SellerIdClient({ id }: SellerIdClientProps) {
  const router = useRouter()
  const [seller, setSeller] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState("")
  
  const [isCommissionDialogOpen, setIsCommissionDialogOpen] = useState(false)
  const [commissionValue, setCommissionValue] = useState<number | "">("")

  // Initial Fetch
  useEffect(() => {
    fetchSeller()
  }, [id])

  const fetchSeller = async () => {
    if (!id || id === "undefined") return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/sellers/${id}`)
      if (!res.ok) throw new Error("Failed to fetch seller details")
      const data = await res.json()
      setSeller(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (sellerId: string) => {
    setActionLoading(sellerId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/approve`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to approve")
      setSuccess("Seller approved successfully")
      fetchSeller()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleSuspend = async (sellerId: string) => {
    setActionLoading(sellerId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/suspend`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to suspend")
      setSuccess("Seller suspended successfully")
      fetchSeller()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnsuspend = async (sellerId: string) => {
    setActionLoading(sellerId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/unsuspend`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to unsuspend")
      setSuccess("Seller unsuspended successfully")
      fetchSeller()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCorrection = async () => {
    if (!feedbackText.trim()) return
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/sellers/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "correction", feedback: feedbackText })
      })
      if (!res.ok) throw new Error("Failed to update status")
      setIsCorrectionDialogOpen(false)
      setFeedbackText("")
      setSuccess("Correction request sent")
      fetchSeller()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async () => {
    if (!feedbackText.trim()) return
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/sellers/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", feedback: feedbackText })
      })
      if (!res.ok) throw new Error("Failed to update status")
      setIsRejectDialogOpen(false)
      setFeedbackText("")
      setSuccess("Application rejected")
      fetchSeller()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleUpdateCommission = async () => {
    if (commissionValue === "") return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/sellers/${id}/commission`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionRate: Number(commissionValue) })
      })
      if (!res.ok) throw new Error("Failed to update commission")
      setIsCommissionDialogOpen(false)
      setSuccess("Commission rate updated")
      fetchSeller()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !seller) return <PageLoader />

  if (!seller && !loading) return (
    <div className="container mx-auto p-10 text-center space-y-4">
      <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
      <h1 className="text-xl font-bold">Seller not found</h1>
      <Button onClick={() => router.push("/admin/sellers")}>Back to List</Button>
    </div>
  )

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-7xl animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full h-10 w-10 border bg-background shadow-sm hover:bg-muted"
            onClick={() => router.push("/admin/sellers")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{seller.store?.name || seller.user?.name}</h1>
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary text-[10px] uppercase font-bold px-3">
                {seller.type}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm font-medium mt-1 uppercase tracking-wider opacity-60">Seller Profile / #{id.slice(-8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-background rounded-2xl border px-4 py-2 flex items-center gap-3 shadow-sm">
             <div className="flex flex-col">
              <span className="text-[10px] font-medium text-muted-foreground uppercase opacity-60">Status</span>
              <span className="text-xs font-bold flex items-center gap-1.5 uppercase">
                {seller.isApproved ? (
                  <><CheckCircle className="h-3 w-3 text-green-500" /> Approved</>
                ) : (
                  <><ShieldCheck className="h-3 w-3 text-blue-500" /> Pending Review</>
                )}
              </span>
            </div>
            <div className="w-px h-8 bg-muted mx-2" />
            <div className="flex flex-col pr-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase opacity-60">Commission</span>
              <span className="text-xs font-bold text-amber-600">{seller.commissionRate ?? 0}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive" className="border-none shadow-xl bg-destructive/10 text-destructive animate-in slide-in-from-top-4">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="font-medium">{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-none shadow-xl bg-green-500/10 text-green-600 animate-in slide-in-from-top-4 uppercase tracking-widest text-[10px] font-bold">
          <CheckCircle className="h-5 w-5" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Content */}
      <SellerDetailsView 
        seller={seller}
        actionLoading={actionLoading}
        onApprove={handleApprove}
        onSuspend={handleSuspend}
        onUnsuspend={handleUnsuspend}
        onOpenCommission={(id, rate) => {
          setCommissionValue(rate)
          setIsCommissionDialogOpen(true)
        }}
        onOpenCorrection={() => setIsCorrectionDialogOpen(true)}
        onOpenReject={() => setIsRejectDialogOpen(true)}
      />

      {/* Dialogs */}
      {/* Correction Dialog */}
      <Dialog open={isCorrectionDialogOpen} onOpenChange={setIsCorrectionDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" /> Correction Required
            </DialogTitle>
            <DialogDescription className="font-medium">
              Specify what needs to be fixed. The seller will be notified to update their profile.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="e.g. Identity document is blurry, Bank account name mismatch..."
              className="min-h-[120px] rounded-2xl bg-muted/30 border-muted font-medium"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCorrectionDialogOpen(false)} className="rounded-full px-6">Cancel</Button>
            <Button 
              className="rounded-full px-8 bg-amber-500 hover:bg-amber-600 font-bold"
              onClick={handleCorrection}
              disabled={actionLoading === id}
            >
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" /> Reject Application
            </DialogTitle>
            <DialogDescription className="font-medium">
              This action permanent. Please provide a clear reason for the rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection..."
              className="min-h-[120px] rounded-2xl bg-muted/30 border-muted font-medium"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)} className="rounded-full px-6">Cancel</Button>
            <Button 
              variant="destructive"
              className="rounded-full px-8 font-bold"
              onClick={handleReject}
              disabled={actionLoading === id}
            >
              Reject Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commission Dialog */}
      <Dialog open={isCommissionDialogOpen} onOpenChange={setIsCommissionDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <MoreHorizontal className="h-5 w-5 text-amber-500" /> Platform Commission
            </DialogTitle>
            <DialogDescription className="font-medium">
              Set a custom commission percentage for this seller.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground ml-1">Commission Rate (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  className="rounded-2xl h-12 bg-muted/30 border-muted font-bold text-lg pl-4 pr-10"
                  value={commissionValue}
                  onChange={(e) => setCommissionValue(e.target.value === "" ? "" : Number(e.target.value))}
                />
                <div className="absolute right-4 top-3 text-muted-foreground font-bold">%</div>
              </div>
            </div>
            <div className="p-3 bg-amber-500/5 rounded-2xl border border-amber-500/10 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
              <p className="text-[10px] font-medium text-amber-700/80 leading-relaxed uppercase">
                Changing this rate will affect all future orders processed by this seller.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsCommissionDialogOpen(false)} className="rounded-full px-6">Cancel</Button>
            <Button 
              className="rounded-full px-8 bg-amber-500 hover:bg-amber-600 font-bold"
              onClick={handleUpdateCommission}
              disabled={loading}
            >
              Set Rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Ban({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </svg>
  )
}
