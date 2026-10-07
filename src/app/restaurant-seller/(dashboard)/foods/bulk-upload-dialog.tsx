"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Button } from "@/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"
import { Upload, AlertTriangle, CheckCircle2, ChevronDown, HelpCircle, Utensils, Image as ImageIcon } from "lucide-react"

const FIELD_GROUPS = [
  {
    id: "basic",
    title: "1. Basic Dish Details",
    badge: "3 columns",
    fields: [
      { num: 1, header: "category", req: "Yes", desc: "Dish category or cuisine (e.g. Mains, Starters, Biryani, Desserts)", example: "Mains" },
      { num: 2, header: "food_name", req: "Yes", desc: "Full name of the dish as displayed on your menu", example: "Paneer Butter Masala" },
      { num: 5, header: "is_veg", req: "No", desc: "Yes for Vegetarian, No for Non-Vegetarian (defaults to Yes)", example: "Yes" },
    ],
  },
  {
    id: "pricing",
    title: "2. Pricing & Discounts",
    badge: "2 columns",
    fields: [
      { num: 3, header: "price", req: "Yes", desc: "Original Listed MRP / Regular Menu Price", example: "280" },
      { num: 4, header: "selling_price", req: "No", desc: "FINAL SELLING PRICE customer pays (e.g. 240). Stored as discount (40 = 280 - 240). Must be <= price", example: "240" },
    ],
  },
  {
    id: "media",
    title: "3. Media, Description & Status",
    badge: "3 columns",
    fields: [
      { num: 6, header: "description", req: "No", desc: "Dish preparation notes, ingredients, or allergens", example: "Rich cottage cheese in tomato cashew gravy" },
      { num: 7, header: "food_images", req: "No", desc: "Image URLs separated by pipe (|). Upload to Bulk Image gallery first, copy and paste here", example: "https://.../img1.webp | https://.../img2.webp" },
      { num: 8, header: "is_active", req: "No", desc: "Yes to make live on menu, No to save as inactive draft (defaults to Yes)", example: "Yes" },
    ],
  },
]

export function RestaurantBulkUploadDialog({ onImported }: { onImported?: () => void }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [downloadingType, setDownloadingType] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      setResult(null)
      setImportErrors([])
      setFile(null)
      setActiveAccordion(null)
    }
  }, [open])

  async function handleDownloadTemplate(format: "csv" | "xlsx", dummy: boolean = true) {
    const key = `${format}-${dummy ? "example" : "fresh"}`
    setError(null)
    setDownloadingType(key)
    try {
      const url = `/api/restaurant-seller/foods/bulk-template?format=${format}&dummy=${dummy}`
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || "Failed to download template")
      }
      const blob = await res.blob()
      const ext = format === "xlsx" ? "xlsx" : "csv"
      const filename = dummy ? `restaurant-food-template-example.${ext}` : `restaurant-food-template-blank.${ext}`
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
    } catch (e: any) {
      setError(e.message || "Failed to download template")
    } finally {
      setDownloadingType(null)
    }
  }

  async function handleImport() {
    if (!file) {
      setError("Please select a file to upload.")
      return
    }
    setError(null)
    setResult(null)
    setImportErrors([])
    setImporting(true)

    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/restaurant-seller/foods/bulk-import", {
        method: "POST",
        body: fd,
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || "Import failed.")
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          setImportErrors(data.errors)
        }
        return
      }

      setResult(data.message || `Import successful! Added ${data.count} food items.`)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      onImported?.()
    } catch (e: any) {
      setError(e.message || "Network error during upload.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="rounded-xl border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-bold shadow-sm"
        >
          <Upload className="mr-2 h-4 w-4 text-emerald-600" />
          Bulk Upload Foods
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-black">Bulk Upload Food Menu</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Add multiple dishes, appetizers, and beverages to your restaurant menu at once via Excel or CSV.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Important Notice regarding Pricing and Images */}
          <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/60 p-4 text-xs text-emerald-900 space-y-1.5">
            <p className="font-bold flex items-center gap-1.5 text-emerald-800">
              <HelpCircle className="h-4 w-4 shrink-0 text-emerald-600" />
              How Selling Price & Images Work:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-emerald-800/90 leading-relaxed">
              <li>
                <strong>Selling Price:</strong> Enter the regular MRP in <code className="font-mono bg-white/70 px-1 rounded">price</code> (e.g. 200). In <code className="font-mono bg-white/70 px-1 rounded">selling_price</code>, enter the <strong>final price customer pays</strong> (e.g. 160). The discount amount (40 = 200 - 160) is saved automatically in the database.
              </li>
              <li>
                <strong>Bulk Dish Photos:</strong> Upload your photos using{" "}
                <Link
                  href="/restaurant-seller/foods/bulk-image-upload"
                  target="_blank"
                  className="font-bold underline text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-0.5"
                >
                  <ImageIcon className="h-3 w-3 inline" /> Bulk Image Upload
                </Link>
                , click <em>Copy Selected URLs</em>, and paste them separated by <code className="font-mono bg-white/70 px-1 rounded">|</code> into the spreadsheet.
              </li>
            </ul>
          </div>

          {/* Download Templates Section */}
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Step 1: Download Food Import Template
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border border-border/60 rounded-2xl p-4 bg-muted/20 space-y-2">
                <p className="text-xs font-bold">With Sample Dishes (Recommended)</p>
                <p className="text-[11px] text-muted-foreground">
                  Includes pre-filled sample items tailored to your restaurant cuisines.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={downloadingType !== null}
                    onClick={() => handleDownloadTemplate("xlsx", true)}
                  >
                    {downloadingType === "xlsx-example" ? "Downloading..." : "Download Excel (.xlsx)"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs font-semibold"
                    disabled={downloadingType !== null}
                    onClick={() => handleDownloadTemplate("csv", true)}
                  >
                    {downloadingType === "csv-example" ? "..." : "CSV"}
                  </Button>
                </div>
              </div>

              <div className="border border-border/60 rounded-2xl p-4 bg-muted/20 space-y-2">
                <p className="text-xs font-bold">Blank Template</p>
                <p className="text-[11px] text-muted-foreground">
                  Empty template with column headers ready for your menu data.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl text-xs font-bold border-border"
                    disabled={downloadingType !== null}
                    onClick={() => handleDownloadTemplate("xlsx", false)}
                  >
                    {downloadingType === "xlsx-fresh" ? "Downloading..." : "Blank Excel (.xlsx)"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs font-semibold"
                    disabled={downloadingType !== null}
                    onClick={() => handleDownloadTemplate("csv", false)}
                  >
                    {downloadingType === "csv-fresh" ? "..." : "CSV"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Accordion Guide */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Column Specifications Guide (All 8 Columns)
            </Label>
            <div className="border border-border/60 rounded-2xl divide-y divide-border/40 overflow-hidden bg-background">
              {FIELD_GROUPS.map((group) => {
                const isOpen = activeAccordion === group.id
                return (
                  <div key={group.id} className="text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveAccordion(isOpen ? null : group.id)}
                      className="w-full flex items-center justify-between p-3.5 text-left font-bold hover:bg-muted/30 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        {group.title}
                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-semibold">
                          {group.badge}
                        </span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="p-3.5 bg-muted/10 border-t border-border/30 space-y-2">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-border/40 text-[11px] text-muted-foreground">
                                <th className="py-1.5 pr-2 font-bold">#</th>
                                <th className="py-1.5 pr-2 font-bold">Header</th>
                                <th className="py-1.5 pr-2 font-bold">Req?</th>
                                <th className="py-1.5 pr-2 font-bold">Description</th>
                                <th className="py-1.5 font-bold">Example</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20 text-[11px]">
                              {group.fields.map((f) => (
                                <tr key={f.header}>
                                  <td className="py-2 pr-2 text-muted-foreground">{f.num}</td>
                                  <td className="py-2 pr-2 font-mono font-bold text-foreground">{f.header}</td>
                                  <td className="py-2 pr-2">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        f.req === "Yes"
                                          ? "bg-rose-100 text-rose-800"
                                          : "bg-slate-100 text-slate-700"
                                      }`}
                                    >
                                      {f.req}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-2 text-muted-foreground">{f.desc}</td>
                                  <td className="py-2 font-mono text-[10px] text-slate-800 bg-muted/40 px-1.5 rounded">
                                    {f.example}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Upload File Section */}
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Step 2: Choose Filled Excel or CSV File
            </Label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  setFile(f)
                  setError(null)
                  setResult(null)
                  setImportErrors([])
                }}
                className="block w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer border border-border/60 rounded-2xl p-2"
              />
              <Button
                type="button"
                disabled={!file || importing}
                onClick={handleImport}
                className="rounded-2xl h-11 px-6 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-md shadow-emerald-600/20"
              >
                {importing ? "Importing Menu..." : "Upload & Import"}
              </Button>
            </div>
          </div>

          {/* Error & Success States */}
          {error && (
            <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="font-semibold text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {importErrors.length > 0 && (
            <div className="border border-destructive/30 rounded-2xl p-4 bg-destructive/5 space-y-2">
              <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Row Validation Errors ({importErrors.length}):
              </p>
              <ul className="text-xs text-destructive/90 space-y-1 list-disc pl-5 max-h-48 overflow-y-auto">
                {importErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {result && (
            <Alert className="rounded-2xl border-emerald-500/20 bg-emerald-500/10 text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="font-bold text-xs">{result}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="pt-4 border-t border-border/40 mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
