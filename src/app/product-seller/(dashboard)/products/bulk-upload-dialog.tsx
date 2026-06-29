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
import { Upload } from "lucide-react"

type Subcategory = { id: string; name: string; slug: string }
type CategoryWithSub = { id: string; name: string; slug: string; subcategories: Subcategory[] }

export function BulkUploadDialog({ onImported }: { onImported?: () => void }) {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<CategoryWithSub[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [loadingCats, setLoadingCats] = useState(false)
  const [downloading, setDownloading] = useState<"csv" | "xlsx" | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])

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
      loadCategories()
    }
  }, [open, loadCategories])

  async function handleDownloadTemplate(format: "csv" | "xlsx", dummy: boolean = true) {
    setError(null)
    setDownloading(format)
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
      setDownloading(null)
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
      onImported?.()
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
                  disabled={downloading !== null}
                  onClick={() => handleDownloadTemplate("xlsx", true)}
                >
                  {downloading === "xlsx" ? "Downloading..." : "Download Example Sheet"}
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
                  disabled={downloading !== null}
                  onClick={() => handleDownloadTemplate("xlsx", false)}
                >
                  {downloading === "xlsx" ? "Downloading..." : "Download Fresh Sheet"}
                </Button>
              </div>
            </div>
          </section>

          {/* Tips Section */}
          <div className="rounded-lg border bg-blue-500/5 p-4 text-xs space-y-2">
            <p className="font-semibold text-blue-600 dark:text-blue-400">Pro Tips & Format Guidelines:</p>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground font-medium">
              <li><strong>Variants</strong>: If you have multiple items for the same product, give them the <strong>exact same product name</strong> (e.g. "T-Shirt") in consecutive rows, and differentiate them using the <code>variant_name</code> column.</li>
              <li><strong>GST & Policy</strong>: Write <strong>Yes</strong> or <strong>No</strong> in <code>gst_applicable</code> and <code>replacement_allowed</code> columns. Use <strong>Returnable</strong> or <strong>Non-Returnable</strong> in <code>return_policy</code>.</li>
              <li><strong>Details & Specs</strong>: Input key-value JSON in <code>variant_details</code> (e.g. <code>{"{\"color\": \"red\"}"}</code>) for custom options.</li>
            </ul>
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

          {error && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{error}</p>}
          {result && <p className="text-sm font-medium text-emerald-600 dark:text-emerald-500 animate-in slide-in-from-top-1">{result}</p>}
          {importErrors.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm max-h-40 overflow-y-auto">
              <p className="font-semibold text-destructive mb-2">Import Errors:</p>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground font-medium">
                {importErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
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
