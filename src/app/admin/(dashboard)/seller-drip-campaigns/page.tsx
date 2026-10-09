"use client"

import { useState, useEffect } from "react"
import {
  Mail,
  Send,
  Edit,
  RotateCcw,
  CheckCircle,
  Play,
  Sparkles,
  ShoppingBag,
  Wrench,
  Hotel,
  UtensilsCrossed,
  ArrowRight,
  Info,
  Clock,
  Layers,
  Check,
  AlertCircle,
  Eye,
} from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import { Badge } from "@/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/ui/dialog"
import { Label } from "@/ui/label"
import { Switch } from "@/ui/switch"
import { Separator } from "@/ui/separator"

interface DripTemplate {
  id: string
  sellerType: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
  dayNumber: number
  subject: string
  preheader?: string
  headline: string
  body: string
  bulletPoints: string[]
  ctaText: string
  ctaUrl: string
  isActive: boolean
  isCustomized: boolean
  updatedAt?: string | null
}

export default function AdminSellerDripCampaignsPage() {
  const [templates, setTemplates] = useState<DripTemplate[]>([])
  const [stats, setStats] = useState<any>({
    totalTemplates: 28,
    customizedCount: 0,
    defaultCount: 28,
    totalSentLogs: 0,
    totalActiveSellers: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT">("PRODUCT")

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<DripTemplate | null>(null)
  const [formSubject, setFormSubject] = useState("")
  const [formPreheader, setFormPreheader] = useState("")
  const [formHeadline, setFormHeadline] = useState("")
  const [formBody, setFormBody] = useState("")
  const [formBullet1, setFormBullet1] = useState("")
  const [formBullet2, setFormBullet2] = useState("")
  const [formBullet3, setFormBullet3] = useState("")
  const [formCtaText, setFormCtaText] = useState("")
  const [formCtaUrl, setFormCtaUrl] = useState("")
  const [formIsActive, setFormIsActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Test Send Modal State
  const [isTestOpen, setIsTestOpen] = useState(false)
  const [testTemplate, setTestTemplate] = useState<DripTemplate | null>(null)
  const [testEmail, setTestEmail] = useState("")
  const [isSendingTest, setIsSendingTest] = useState(false)

  // Dry-run / Manual trigger state
  const [isCronModalOpen, setIsCronModalOpen] = useState(false)
  const [cronPreviewData, setCronPreviewData] = useState<any>(null)
  const [isCronRunning, setIsCronRunning] = useState(false)

  // Feedback Notification
  const [alertMessage, setAlertMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const showNotification = (type: "success" | "error", text: string) => {
    setAlertMessage({ type, text })
    setTimeout(() => setAlertMessage(null), 5000)
  }

  // Fetch templates & stats
  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/admin/seller-drip-campaigns")
      const data = await res.json()
      if (data.success) {
        setTemplates(data.templates || [])
        if (data.stats) setStats(data.stats)
      } else {
        showNotification("error", data.error || "Failed to load templates")
      }
    } catch (err: any) {
      showNotification("error", err?.message || "Error fetching campaigns")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  // Open Edit Modal
  const handleOpenEdit = (t: DripTemplate) => {
    setEditingTemplate(t)
    setFormSubject(t.subject || "")
    setFormPreheader(t.preheader || "")
    setFormHeadline(t.headline || "")
    setFormBody(t.body || "")
    setFormBullet1(t.bulletPoints?.[0] || "")
    setFormBullet2(t.bulletPoints?.[1] || "")
    setFormBullet3(t.bulletPoints?.[2] || "")
    setFormCtaText(t.ctaText || "Get Started")
    setFormCtaUrl(t.ctaUrl || "")
    setFormIsActive(t.isActive !== false)
    setIsEditOpen(true)
  }

  // Save Template
  const handleSaveTemplate = async () => {
    if (!editingTemplate) return
    setIsSaving(true)
    try {
      const bullets = [formBullet1.trim(), formBullet2.trim(), formBullet3.trim()].filter(Boolean)
      const res = await fetch("/api/admin/seller-drip-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          sellerType: editingTemplate.sellerType,
          dayNumber: editingTemplate.dayNumber,
          subject: formSubject,
          preheader: formPreheader,
          headline: formHeadline,
          body: formBody,
          bulletPoints: bullets,
          ctaText: formCtaText,
          ctaUrl: formCtaUrl,
          isActive: formIsActive,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showNotification("success", `Day ${editingTemplate.dayNumber} template saved successfully!`)
        setIsEditOpen(false)
        fetchTemplates()
      } else {
        showNotification("error", data.error || "Failed to save template")
      }
    } catch (err: any) {
      showNotification("error", err?.message || "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  // Reset to default
  const handleResetDefault = async (t: DripTemplate) => {
    if (!confirm(`Reset ${t.sellerType} Day ${t.dayNumber} back to original system default?`)) return
    try {
      const res = await fetch("/api/admin/seller-drip-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset-default",
          sellerType: t.sellerType,
          dayNumber: t.dayNumber,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showNotification("success", `Reset to default successfully!`)
        fetchTemplates()
      } else {
        showNotification("error", data.error || "Failed to reset")
      }
    } catch (err: any) {
      showNotification("error", err?.message || "Failed to reset")
    }
  }

  // Open Test Send Modal
  const handleOpenTest = (t: DripTemplate) => {
    setTestTemplate(t)
    setIsTestOpen(true)
  }

  // Send Test Email
  const handleSendTest = async () => {
    if (!testTemplate || !testEmail.trim()) {
      showNotification("error", "Please provide a valid destination email address")
      return
    }
    setIsSendingTest(true)
    try {
      const res = await fetch("/api/admin/seller-drip-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test-email",
          sellerType: testTemplate.sellerType,
          dayNumber: testTemplate.dayNumber,
          testEmail: testEmail.trim(),
          subject: testTemplate.subject,
          preheader: testTemplate.preheader,
          headline: testTemplate.headline,
          body: testTemplate.body,
          bulletPoints: testTemplate.bulletPoints,
          ctaText: testTemplate.ctaText,
          ctaUrl: testTemplate.ctaUrl,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showNotification("success", `Preview email successfully sent to ${testEmail}!`)
        setIsTestOpen(false)
      } else {
        showNotification("error", data.error || "Failed to send test email")
      }
    } catch (err: any) {
      showNotification("error", err?.message || "Error sending test email")
    } finally {
      setIsSendingTest(false)
    }
  }

  // Run Cron Dry Run Preview
  const handleRunCronPreview = async () => {
    setIsCronRunning(true)
    setIsCronModalOpen(true)
    setCronPreviewData(null)
    try {
      const res = await fetch("/api/cron/seller-daily-drip?dryRun=true&limit=50")
      const data = await res.json()
      setCronPreviewData(data)
    } catch (err: any) {
      setCronPreviewData({ success: false, error: err?.message || "Failed to execute dry-run preview" })
    } finally {
      setIsCronRunning(false)
    }
  }

  // Filter templates for current tab
  const tabTemplates = templates
    .filter((t) => t.sellerType === activeTab)
    .sort((a, b) => a.dayNumber - b.dayNumber)

  return (
    <div className="space-y-6 pb-12">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Mail className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Seller Daily Emails
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Automated 7-day email sequence for active & approved sellers across all 4 categories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRunCronPreview}
            className="flex items-center gap-2 border-slate-300 font-semibold"
          >
            <Play className="h-4 w-4 text-emerald-600" />
            Preview Today&apos;s Run (Dry Run)
          </Button>
        </div>
      </div>

      {/* ── ALERT NOTIFICATION ── */}
      {alertMessage && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 border transition-all ${
            alertMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {alertMessage.type === "success" ? (
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          )}
          <span className="text-sm font-medium">{alertMessage.text}</span>
        </div>
      )}

      {/* ── STATS CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalTemplates}</div>
              <div className="text-xs text-slate-500 font-medium">Total Templates (4×7)</div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.customizedCount}</div>
              <div className="text-xs text-slate-500 font-medium">Customized by Admin</div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalActiveSellers}</div>
              <div className="text-xs text-slate-500 font-medium">Active Onboarded Sellers</div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalSentLogs}</div>
              <div className="text-xs text-slate-500 font-medium">Total Emails Delivered</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── TABS FOR 4 SELLER TYPES ── */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-1">
          <TabsTrigger
            value="PRODUCT"
            className="flex items-center gap-2 rounded-xl py-2.5 text-xs md:text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm"
          >
            <ShoppingBag className="h-4 w-4 text-indigo-600" />
            Product Sellers (7)
          </TabsTrigger>
          <TabsTrigger
            value="SERVICE"
            className="flex items-center gap-2 rounded-xl py-2.5 text-xs md:text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm"
          >
            <Wrench className="h-4 w-4 text-emerald-600" />
            Service Providers (7)
          </TabsTrigger>
          <TabsTrigger
            value="HOTEL"
            className="flex items-center gap-2 rounded-xl py-2.5 text-xs md:text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm"
          >
            <Hotel className="h-4 w-4 text-amber-600" />
            Hotel Sellers (7)
          </TabsTrigger>
          <TabsTrigger
            value="RESTAURANT"
            className="flex items-center gap-2 rounded-xl py-2.5 text-xs md:text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm"
          >
            <UtensilsCrossed className="h-4 w-4 text-rose-600" />
            Restaurant Sellers (7)
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
              7-Day Journey for {activeTab === "PRODUCT" ? "Product Merchants" : activeTab === "SERVICE" ? "Service Professionals" : activeTab === "HOTEL" ? "Hotel & Stay Partners" : "Restaurant Partners"}
            </h2>
            <span className="text-xs text-slate-500">
              Sent once daily to approved sellers who completed onboarding
            </span>
          </div>

          {/* ── 7 DAY CARDS GRID ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tabTemplates.map((t) => (
              <Card
                key={`${t.sellerType}_${t.dayNumber}`}
                className={`rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between ${
                  !t.isActive
                    ? "opacity-60 border-slate-200 bg-slate-50/50 dark:bg-slate-900/30"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                }`}
              >
                <CardHeader className="p-5 pb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      className={`text-xs px-2.5 py-0.5 font-black uppercase rounded-lg ${
                        activeTab === "PRODUCT"
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          : activeTab === "SERVICE"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : activeTab === "HOTEL"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                      }`}
                    >
                      DAY {t.dayNumber}
                    </Badge>

                    <div className="flex items-center gap-1.5">
                      {t.isCustomized ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 font-bold bg-emerald-50">
                          Customized
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-slate-500">
                          Default
                        </Badge>
                      )}
                      {!t.isActive && (
                        <Badge variant="destructive" className="text-[10px]">
                          Paused
                        </Badge>
                      )}
                    </div>
                  </div>

                  <CardTitle className="text-sm font-black line-clamp-2 leading-snug">
                    {t.subject}
                  </CardTitle>
                  <CardDescription className="text-xs line-clamp-2">
                    {t.headline}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed mb-3">
                      {t.body}
                    </p>

                    {/* Bullet Points Preview */}
                    {t.bulletPoints && t.bulletPoints.length > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2.5 space-y-1 mb-3">
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                          Key Highlights:
                        </span>
                        {t.bulletPoints.slice(0, 2).map((bp, i) => (
                          <div key={i} className="text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-1.5 line-clamp-1">
                            <span className="text-emerald-500 font-bold shrink-0">✓</span>
                            <span className="truncate">{bp}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* CTA Button Preview */}
                    <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg flex items-center justify-between text-[11px] font-medium text-slate-700 dark:text-slate-300">
                      <span className="truncate font-semibold">{t.ctaText}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 ml-1 text-slate-400" />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenTest(t)}
                      className="h-8 px-2 text-xs text-slate-600"
                      title="Send Test Email"
                    >
                      <Send className="h-3.5 w-3.5 mr-1 text-indigo-500" />
                      Test
                    </Button>

                    <div className="flex items-center gap-1">
                      {t.isCustomized && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResetDefault(t)}
                          className="h-8 px-2 text-xs text-slate-500 hover:text-rose-600"
                          title="Reset to default copy"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        onClick={() => handleOpenEdit(t)}
                        className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── EDIT TEMPLATE MODAL ── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <Badge className="bg-indigo-100 text-indigo-700 uppercase font-black">
                {editingTemplate?.sellerType} • DAY {editingTemplate?.dayNumber}
              </Badge>
              <div className="flex items-center gap-2">
                <Label htmlFor="active-toggle" className="text-xs font-semibold text-slate-600">
                  Active
                </Label>
                <Switch
                  id="active-toggle"
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                />
              </div>
            </div>
            <DialogTitle className="text-xl font-black">Customize Drip Template</DialogTitle>
            <DialogDescription className="text-xs">
              Personalize the email subject, message body, highlight points, and CTA button.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-bold">Email Subject Line *</Label>
              <Input
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="e.g. 🚀 Welcome to MEEEM! Set Up Your Product Storefront"
                className="mt-1 font-medium"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Preview Text (Preheader)</Label>
              <Input
                value={formPreheader}
                onChange={(e) => setFormPreheader(e.target.value)}
                placeholder="Short snippet visible in inbox preview..."
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Email Headline / Banner Title *</Label>
              <Input
                value={formHeadline}
                onChange={(e) => setFormHeadline(e.target.value)}
                placeholder="Large prominent headline inside the email..."
                className="mt-1 font-semibold"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Message Body *</Label>
              <Textarea
                rows={5}
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Enter friendly and encouraging body text for the merchant..."
                className="mt-1 text-sm leading-relaxed"
              />
            </div>

            <Separator className="my-2" />

            <div>
              <Label className="text-xs font-bold block mb-1">
                3 Key Bullet Points / Value Highlights
              </Label>
              <div className="space-y-2">
                <Input
                  value={formBullet1}
                  onChange={(e) => setFormBullet1(e.target.value)}
                  placeholder="Highlight point 1 (e.g. Zero upfront listing fees)"
                />
                <Input
                  value={formBullet2}
                  onChange={(e) => setFormBullet2(e.target.value)}
                  placeholder="Highlight point 2 (e.g. Dedicated delivery fleet support)"
                />
                <Input
                  value={formBullet3}
                  onChange={(e) => setFormBullet3(e.target.value)}
                  placeholder="Highlight point 3 (e.g. Instant mobile money settlements)"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">CTA Button Text *</Label>
                <Input
                  value={formCtaText}
                  onChange={(e) => setFormCtaText(e.target.value)}
                  placeholder="e.g. Upload First Product →"
                  className="mt-1 font-medium"
                />
              </div>
              <div>
                <Label className="text-xs font-bold">Target Route / URL *</Label>
                <Input
                  value={formCtaUrl}
                  onChange={(e) => setFormCtaUrl(e.target.value)}
                  placeholder="e.g. /product-seller/products/create"
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {isSaving ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SEND TEST MODAL ── */}
      <Dialog open={isTestOpen} onOpenChange={setIsTestOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Send className="h-5 w-5 text-indigo-600" />
              Send Test Email
            </DialogTitle>
            <DialogDescription className="text-xs">
              Deliver a live preview of {testTemplate?.sellerType} Day {testTemplate?.dayNumber} to your inbox.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-bold">Recipient Email Address</Label>
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your-email@example.com"
                className="mt-1"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Subject will be prefixed with <span className="font-mono text-indigo-600">[TEST PREVIEW]</span>.
            </p>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsTestOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendTest}
              disabled={isSendingTest}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {isSendingTest ? "Sending..." : "Send Test Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DRY-RUN PREVIEW MODAL ── */}
      <Dialog open={isCronModalOpen} onOpenChange={setIsCronModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Play className="h-5 w-5 text-emerald-600" />
              Daily Drip Execution Preview (Dry Run)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Simulates today&apos;s cron run for active onboarded sellers without sending any emails.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {isCronRunning ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold text-slate-500">
                  Scanning active sellers and calculating progressive drip days...
                </span>
              </div>
            ) : cronPreviewData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                    <span className="text-xs text-slate-500 block">Active Sellers</span>
                    <span className="text-xl font-black text-slate-900 dark:text-white">
                      {cronPreviewData.stats?.scannedActiveSellers ?? 0}
                    </span>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl">
                    <span className="text-xs text-emerald-700 block">Eligible to Send Today</span>
                    <span className="text-xl font-black text-emerald-700">
                      {cronPreviewData.stats?.sentCount ?? 0}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                    <span className="text-xs text-slate-500 block">Already Sent Today</span>
                    <span className="text-xl font-black text-slate-700 dark:text-slate-300">
                      {cronPreviewData.stats?.skippedAlreadySentToday ?? 0}
                    </span>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-bold text-xs text-slate-700 dark:text-slate-300">
                    Recipient Breakdown (First 50 Candidates):
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                    {cronPreviewData.items && cronPreviewData.items.length > 0 ? (
                      cronPreviewData.items.map((item: any, idx: number) => (
                        <div key={idx} className="p-3 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {item.businessName || item.userName || "Merchant"}
                            </span>{" "}
                            <span className="text-slate-400">({item.userEmail})</span>
                            <div className="text-[11px] text-slate-500 truncate max-w-md">
                              {item.subject}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge className="bg-indigo-100 text-indigo-700 font-black text-[10px]">
                              {item.sellerType} • DAY {item.dayNumber}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No active sellers currently eligible to send today.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button onClick={() => setIsCronModalOpen(false)}>Close Preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
