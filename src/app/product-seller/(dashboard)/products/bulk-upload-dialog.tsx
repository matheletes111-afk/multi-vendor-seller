"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
import { Upload, AlertTriangle, CheckCircle2, ChevronDown, HelpCircle } from "lucide-react"

type Subcategory = { id: string; name: string; slug: string }
type CategoryWithSub = { id: string; name: string; slug: string; subcategories: Subcategory[] }

const FIELD_GROUPS = [
  {
    id: "basic",
    title: "1. Basic Product Info",
    badge: "5 columns",
    fields: [
      { num: 1, header: "category", req: "Yes", desc: "Category name (matches your assigned or marketplace category)", example: "Clothing & Fashion" },
      { num: 2, header: "product_name", req: "Yes", desc: "Product title (identical names group into multi-variant product)", example: "Slim Fit T-Shirt" },
      { num: 3, header: "brand", req: "No", desc: "Brand or manufacturer name", example: "Nike" },
      { num: 4, header: "product_description", req: "No", desc: "Full product description text", example: "100% combed cotton" },
      { num: 5, header: "condition", req: "No", desc: "NEW or USED (defaults to NEW)", example: "NEW" },
    ],
  },
  {
    id: "pricing",
    title: "2. Pricing & Stock",
    badge: "4 columns",
    fields: [
      { num: 7, header: "price", req: "Yes", desc: "Original MRP / Listed Price", example: "100" },
      { num: 8, header: "discount", req: "No", desc: "Final selling price customer pays (e.g. 80)", example: "80" },
      { num: 9, header: "gst_applicable", req: "No", desc: "Tax applicable: Yes or No (default: Yes)", example: "Yes" },
      { num: 10, header: "stock", req: "Yes", desc: "Available inventory quantity", example: "50" },
    ],
  },
  {
    id: "variants",
    title: "3. Variants & Media",
    badge: "4 columns",
    fields: [
      { num: 6, header: "variant_name", req: "Yes", desc: "Variant option title (size, color, pack)", example: "Black / L" },
      { num: 11, header: "sku_code", req: "No", desc: "Your internal SKU identifier", example: "TSHIRT-BLK-L" },
      { num: 16, header: "product_variant_images", req: "No", desc: "Image URLs separated by pipe (|)", example: "https://.../1.jpg | https://.../2.jpg" },
      { num: 17, header: "variant_details", req: "No", desc: "Attributes: color: Black, size: Regular (or JSON)", example: "color: Black, size: L" },
    ],
  },
  {
    id: "shipping",
    title: "4. Shipping & Dimensions",
    badge: "5 columns",
    fields: [
      { num: 12, header: "weight", req: "Cond.", desc: "Weight in KG (mandatory if category requires weight)", example: "0.35" },
      { num: 13, header: "height", req: "No", desc: "Package height in CM (AI auto-fallback)", example: "5" },
      { num: 14, header: "width", req: "No", desc: "Package width in CM (AI auto-fallback)", example: "20" },
      { num: 15, header: "depth", req: "No", desc: "Package depth in CM (AI auto-fallback)", example: "30" },
      { num: 23, header: "delivery_days", req: "No", desc: "Estimated delivery days (default: 7)", example: "5" },
    ],
  },
  {
    id: "policies",
    title: "5. Policies & Specifications",
    badge: "5 columns",
    fields: [
      { num: 18, header: "specifications", req: "No", desc: "Technical specifications text", example: "180 GSM cotton" },
      { num: 19, header: "additional_details", req: "No", desc: "Extra notes or care instructions", example: "Machine wash cold" },
      { num: 20, header: "return_policy", req: "No", desc: "Returnable or Non-Returnable", example: "Returnable" },
      { num: 21, header: "return_limit_days", req: "No", desc: "Return window in days", example: "7" },
      { num: 22, header: "replacement_allowed", req: "No", desc: "Replacement allowed: Yes or No", example: "Yes" },
    ],
  },
]

export function BulkUploadDialog({ onImported }: { onImported?: (jobId?: string) => void }) {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<CategoryWithSub[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [loadingCats, setLoadingCats] = useState(false)
  const [downloadingType, setDownloadingType] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null)

  const loadCategories = useCallback(() => {
    setLoadingCats(true)
    fetch("/api/product-seller/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CategoryWithSub[]) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]))
      .finally(() => setLoadingCats(false))
  }, [])

  useEffect(() => {
    if (open) {
      setError(null)
      setResult(null)
      setImportErrors([])
      setFile(null)
      setActiveAccordion(null)
      loadCategories()
    }
  }, [open, loadCategories])

  async function handleDownloadTemplate(format: "csv" | "xlsx", dummy: boolean = true) {
    const key = dummy ? "example" : "fresh"
    setError(null)
    setDownloadingType(key)
    try {
      const url = `/api/product-seller/products/bulk-template?format=${format}&dummy=${dummy}`
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(typeof j.error === "string" ? j.error : "Failed to download template")
        return
      }
      const blob = await res.blob()
      const dUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = dUrl
      a.download = dummy
        ? (format === "xlsx" ? "product-bulk-example.xlsx" : "product-bulk-example.csv")
        : (format === "xlsx" ? "product-bulk-template.xlsx" : "product-bulk-template.csv")
      a.click()
      URL.revokeObjectURL(dUrl)
    } finally {
      setDownloadingType(null)
    }
  }

  async function handleImport() {
    if (!file) {
      setError("Please choose a spreadsheet file (CSV or Excel).")
      return
    }
    setError(null)
    setResult(null)
    setImportErrors([])
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/product-seller/products/bulk-import", {
        method: "POST",
        body: fd,
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (Array.isArray(data.errors) && data.errors.length) {
          setImportErrors(data.errors)
        }
        setError(typeof data.error === "string" ? data.error : "Import failed")
        return
      }
      setResult(`Created ${data.createdProducts} product(s) with ${data.createdVariants} variant(s).`)
      setFile(null)
      onImported?.(data.jobId)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="rounded-full shadow-sm hover:scale-105 transition-all">
          <Upload className="mr-2 h-4 w-4" />
          Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Products</DialogTitle>
          <DialogDescription className="text-left font-medium text-muted-foreground">
            Simplify adding products. Use category names in your sheet and group variants by using the exact same product name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Available Categories Badges */}
          <div className="space-y-3 rounded-xl border bg-muted/20 p-5 shadow-sm">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your Available Categories
            </Label>

            {loadingCats ? (
              <div className="text-xs text-muted-foreground animate-pulse">Loading categories...</div>
            ) : categories.length === 0 ? (
              <div className="text-xs text-destructive">No active categories assigned. Complete onboarding first.</div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {categories.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 border border-blue-500/20 hover:scale-105 transition-all shadow-sm"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] font-medium text-muted-foreground/80 italic mt-2">
              💡 Use these exact category names in the Excel sheet under the <strong>category</strong> column. The system will match them automatically (even with minor typos!).
            </p>
          </div>

          {/* Download Templates Section */}
          <section className="space-y-4 rounded-xl border bg-muted/30 p-5 shadow-sm">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">1</span>
              Get the Excel Template
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col justify-between p-4 border rounded-xl bg-background shadow-xs hover:border-primary/50 transition-all">
                <div>
                  <h4 className="font-semibold text-xs text-foreground mb-1">Example Excel Sheet</h4>
                  <p className="text-[11px] text-muted-foreground mb-4">Includes sample dummy products to show how variants and details are formatted.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full font-semibold text-xs rounded-full bg-secondary hover:bg-secondary/80"
                  disabled={downloadingType !== null}
                  onClick={() => handleDownloadTemplate("xlsx", true)}
                >
                  {downloadingType === "example" ? "Downloading..." : "Download Example Sheet"}
                </Button>
              </div>

              <div className="flex flex-col justify-between p-4 border rounded-xl bg-background shadow-xs hover:border-primary/50 transition-all">
                <div>
                  <h4 className="font-semibold text-xs text-foreground mb-1">Fresh Excel Sheet</h4>
                  <p className="text-[11px] text-muted-foreground mb-4">A clean template containing only headers so you can start adding your own data immediately.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full font-semibold text-xs rounded-full"
                  disabled={downloadingType !== null}
                  onClick={() => handleDownloadTemplate("xlsx", false)}
                >
                  {downloadingType === "fresh" ? "Downloading..." : "Download Fresh Sheet"}
                </Button>
              </div>
            </div>
          </section>

          {/* Tips Section */}
          <div className="rounded-lg border bg-blue-500/5 p-4 text-xs space-y-2">
            <p className="font-semibold text-blue-600 dark:text-blue-400">Pro Tips & Format Guidelines:</p>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground font-medium">
              <li><strong>Price & Discount</strong>: In <code>price</code> enter original MRP (e.g. 100). In <code>discount</code>, enter the <strong>final price you want to sell</strong> (e.g. if Price = 100 and you enter 80, customer pays 80).</li>
              <li><strong>Multiple Variants</strong>: To create 1 product with multiple variants (e.g. Size S, M, L), use the <strong>exact same product_name</strong> in consecutive rows.</li>
              <li><strong>Variant Details</strong>: Write simple key-value pairs like <code>color: Black, size: Regular</code> (no quotes or JSON braces required).</li>
              <li><strong>Images</strong>: Separate multiple image URLs with vertical pipe <code>|</code>.</li>
            </ul>
          </div>

          {/* Detailed Field-by-Field Reference Accordion View (by default off) */}
          <div className="rounded-xl border bg-muted/20 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-primary" />
                  Field-by-Field Column Guide (24 Columns Reference)
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Click any category below to inspect field formats and examples.
                </p>
              </div>
              {activeAccordion && (
                <button
                  type="button"
                  onClick={() => setActiveAccordion(null)}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Collapse
                </button>
              )}
            </div>

            <div className="divide-y divide-border/60 rounded-lg border bg-background overflow-hidden">
              {FIELD_GROUPS.map((group) => {
                const isOpen = activeAccordion === group.id
                return (
                  <div key={group.id} className="transition-colors">
                    <button
                      type="button"
                      onClick={() => setActiveAccordion((prev) => (prev === group.id ? null : group.id))}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/40 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{group.title}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {group.badge}
                        </span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-primary" : ""
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="p-3 pt-0 animate-in fade-in-50 duration-200">
                        <div className="overflow-x-auto rounded-md border bg-muted/10">
                          <table className="w-full text-left border-collapse text-[11px]">
                            <thead>
                              <tr className="border-b bg-muted/50 font-semibold text-muted-foreground">
                                <th className="p-2 w-8">#</th>
                                <th className="p-2">Header</th>
                                <th className="p-2">Required</th>
                                <th className="p-2">What to put</th>
                                <th className="p-2">Example</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {group.fields.map((f) => (
                                <tr key={f.header} className="hover:bg-muted/20">
                                  <td className="p-2 font-mono text-muted-foreground">{f.num}</td>
                                  <td className="p-2 font-semibold font-mono text-foreground">{f.header}</td>
                                  <td className="p-2">
                                    {f.req === "Yes" ? (
                                      <span className="text-destructive font-medium">Yes</span>
                                    ) : f.req === "Cond." ? (
                                      <span className="text-amber-600 dark:text-amber-400 font-medium">Cond.</span>
                                    ) : (
                                      <span className="text-muted-foreground">No</span>
                                    )}
                                  </td>
                                  <td className="p-2 text-foreground/90">{f.desc}</td>
                                  <td className="p-2 text-muted-foreground font-mono text-[10px]">{f.example}</td>
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

          {/* Step 2: Upload */}
          <section className="space-y-4 rounded-xl border bg-muted/30 p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">2</span>
              Upload & Import
            </h3>
            <div className="space-y-2">
              <Label htmlFor="bulk-file" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Choose your completed file</Label>
              <InputFile id="bulk-file" onFile={(f) => setFile(f)} disabled={importing} file={file} />
              <p className="text-[10px] text-muted-foreground">Supported formats: .csv, .xlsx</p>
            </div>
          </section>

          {result && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs animate-in slide-in-from-top-1 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-300 text-sm">Import Successful!</p>
                <p className="text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">{result}</p>
              </div>
            </div>
          )}

          {(error || importErrors.length > 0) && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs space-y-3 animate-in slide-in-from-top-1">
              <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                <span>{error || "Import Validation Failed"}</span>
                {importErrors.length > 0 && (
                  <span className="ml-auto rounded-full bg-destructive/20 px-2.5 py-0.5 text-[11px] font-bold text-destructive">
                    {importErrors.length} {importErrors.length === 1 ? "Issue" : "Issues"}
                  </span>
                )}
              </div>

              {importErrors.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-destructive/20 bg-background/80 p-3 space-y-1 text-[11px]">
                  {importErrors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-destructive/90 font-medium leading-relaxed">
                      <span className="font-bold shrink-0 text-destructive">•</span>
                      <span>{e}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button type="button" variant="outline" className="rounded-full font-medium" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-full font-medium bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
            disabled={!file || importing}
            onClick={handleImport}
          >
            {importing ? "Importing Products..." : "Start Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InputFile({
  id,
  onFile,
  disabled,
  file,
}: {
  id: string
  onFile: (f: File | null) => void
  disabled?: boolean
  file: File | null
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file && ref.current) {
      ref.current.value = ""
    }
  }, [file])

  return (
    <input
      ref={ref}
      id={id}
      type="file"
      accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      disabled={disabled}
      className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-semibold cursor-pointer file:cursor-pointer"
      onChange={(e) => {
        const f = e.target.files?.[0] ?? null
        onFile(f)
      }}
    />
  )
}
