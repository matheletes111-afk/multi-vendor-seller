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
  Hotel as HotelIcon,
  Bed,
  ExternalLink,
  ShieldCheck,
  Globe
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { HotelSellerDetailsView } from "@/components/admin/sellers/hotel-seller-details-view"
import Link from "next/link"

interface Hotel {
  id: string
  name: string
  city: string
  state: string
  starRating: number
  isActive: boolean
  images: any
  _count: { rooms: number }
}

interface Seller {
  id: string
  userId: string
  onboardingStep: number
  onboardingCompleted: boolean
  isApproved: boolean
  isSuspended: boolean
  status: string
  adminFeedback: string | null
  user: {
    name: string
    email: string
    phone: string
    phoneCountryCode: string
  }
  businessInfo: any
  kyc: any
  bankDetails: any
  subscription: any
  hotels: Hotel[]
}

export function HotelSellerDetailClient({ seller }: { seller: Seller }) {
  const router = useRouter()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string; action: string }>({ open: false, id: "", action: "" })
  const [feedback, setFeedback] = useState("")

  const handleStatusAction = async (id: string, action: string, fb?: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/hotel-sellers/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, feedback: fb })
      })
      if (res.ok) {
        setRejectDialog({ open: false, id: "", action: "" })
        setFeedback("")
        router.refresh()
      }
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="rounded-full shadow-md" onClick={() => router.push("/admin/hotel-sellers")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Building2 className="h-8 w-8 text-blue-600" />
              {seller.user.name}
            </h1>
            <p className="text-muted-foreground font-medium">{seller.businessInfo?.businessName || "Hotel Partner"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={cn(
            "rounded-full px-4 py-1 uppercase tracking-widest text-[10px] font-black",
            seller.isApproved ? "bg-green-500 text-white" : "bg-blue-500 text-white"
          )}>
            {seller.isApproved ? "Approved" : "Pending Review"}
          </Badge>
          {seller.isSuspended && <Badge variant="destructive" className="rounded-full px-4 py-1 uppercase tracking-widest text-[10px] font-black animate-pulse">Account Suspended</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Onboarding & Business Details */}
        <div className="lg:col-span-2 space-y-8">
          <HotelSellerDetailsView 
            seller={seller} 
            actionLoading={actionLoading}
            onApprove={() => handleStatusAction(seller.id, "approve")}
            onSuspend={() => handleStatusAction(seller.id, "suspend")}
            onUnsuspend={() => handleStatusAction(seller.id, "unsuspend")}
            onOpenCorrection={(id) => setRejectDialog({ open: true, id, action: "correction" })}
            onOpenReject={(id) => setRejectDialog({ open: true, id, action: "reject" })}
          />

          <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-br from-background to-blue-50/30">
            <CardHeader className="pb-4 pt-8 px-8">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <HotelIcon className="h-5 w-5 text-blue-600" /> Listed Properties
              </CardTitle>
              <CardDescription>Hotels and rooms currently managed by this seller</CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {seller.hotels.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-muted/20 rounded-3xl border-2 border-dashed border-muted">
                    <HotelIcon className="h-12 w-12 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-muted-foreground font-bold text-sm uppercase tracking-wider">No hotels listed yet</p>
                  </div>
                ) : (
                  seller.hotels.map((hotel) => (
                    <Card key={hotel.id} className="rounded-3xl border-muted/50 overflow-hidden hover:shadow-xl transition-all group">
                      <div className="aspect-[16/9] relative overflow-hidden bg-muted">
                        {hotel.images?.[0] ? (
                          <img src={hotel.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground/20 uppercase font-black text-xs">No Image</div>
                        )}
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-black/60 backdrop-blur-md text-white border-none rounded-full px-3 py-1 font-bold text-[10px] uppercase">
                            {hotel.starRating} Stars
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="p-5">
                        <h4 className="font-bold text-lg leading-tight mb-1">{hotel.name}</h4>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
                          <MapPin className="h-3 w-3" />
                          {hotel.city}, {hotel.state}
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-muted/50">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="rounded-lg font-bold">
                              {hotel._count.rooms} Room Types
                            </Badge>
                          </div>
                          <Badge variant={hotel.isActive ? "default" : "outline"} className={cn("rounded-lg", hotel.isActive ? "bg-green-500" : "")}>
                            {hotel.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Quick Stats & Administrative Actions */}
        <div className="space-y-8">
          <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-blue-600 text-white">
            <CardHeader className="pb-2 pt-8 px-8">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-3xl p-4 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1 tracking-widest">Total Hotels</p>
                  <p className="text-3xl font-black">{seller.hotels.length}</p>
                </div>
                <div className="bg-white/10 rounded-3xl p-4 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1 tracking-widest">Total Rooms</p>
                  <p className="text-3xl font-black">{seller.hotels.reduce((acc, h) => acc + h._count.rooms, 0)}</p>
                </div>
              </div>
              
              <div className="pt-4 border-t border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl"><Mail className="h-4 w-4" /></div>
                  <div>
                    <p className="text-[9px] font-bold uppercase opacity-60 tracking-widest">Email Address</p>
                    <p className="text-sm font-medium">{seller.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl"><Phone className="h-4 w-4" /></div>
                  <div>
                    <p className="text-[9px] font-bold uppercase opacity-60 tracking-widest">Contact Number</p>
                    <p className="text-sm font-medium">+{seller.user.phoneCountryCode} {seller.user.phone}</p>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>


        </div>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={val => !val && setRejectDialog({ open: false, id: "", action: "" })}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Administrative Feedback</DialogTitle>
            <DialogDescription className="pt-2 font-medium">Provide details for the seller to correct or reason for rejection.</DialogDescription>
          </DialogHeader>
          <div className="py-6">
             <Label className="text-xs font-black uppercase tracking-widest mb-3 block text-muted-foreground ml-1">Your Memo</Label>
             <Textarea 
                placeholder="Type your message here..." 
                className="rounded-3xl min-h-[150px] p-6 bg-muted/20 border-none shadow-inner focus-visible:ring-primary/20" 
                value={feedback} 
                onChange={e => setFeedback(e.target.value)}
             />
          </div>
          <DialogFooter className="gap-2">
             <Button variant="outline" className="rounded-full px-8 h-12 font-bold" onClick={() => setRejectDialog({ open: false, id: "", action: "" })}>Cancel</Button>
             <Button className="rounded-full bg-red-600 hover:bg-red-700 font-bold px-10 h-12 shadow-lg shadow-red-500/20" onClick={() => handleStatusAction(rejectDialog.id, rejectDialog.action, feedback)} disabled={!feedback || !!actionLoading}>Send Feedback</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
