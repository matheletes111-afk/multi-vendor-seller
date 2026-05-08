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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import CheckboxV2 from "@/ui/checkbox-v2"

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

  // Template states
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("")
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([])

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)

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
      setSelectedCategoryId("")
      setSelectedSubIds([])
      loadCategories()
    }
  }, [open, loadCategories])

  async function handleDownloadTemplate(format: "csv" | "xlsx") {
    if (!selectedCategoryId) {
      setError("Please select a category first.")
      return
    }
    setError(null)
    setDownloading(format)
    try {
      const subParam = selectedSubIds.length > 0 ? `&subcategoryIds=${selectedSubIds.join(",")}` : ""
      const url = `/api/product-seller/products/bulk-template?format=${format}&categoryId=${selectedCategoryId}${subParam}`
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
      a.download = format === "xlsx" ? "product-bulk-template.xlsx" : "product-bulk-template.csv"
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
          <DialogDescription className="text-left font-medium">
            Generate a custom template and add multiple products to your catalog at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Step 1: Selection */}
          <section className="space-y-4 rounded-xl border bg-muted/30 p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">1</span>
              Configure Your Template
            </h3>
            
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Select Main Category</Label>
              <Select value={selectedCategoryId} onValueChange={(val) => { setSelectedCategoryId(val); setSelectedSubIds([]) }}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={loadingCats ? "Loading categories..." : "Choose a category"} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCategory && selectedCategory.subcategories?.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Select Sub-Categories (Optional)</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 border rounded-lg bg-background">
                  {selectedCategory.subcategories.map(sub => (
                    <div key={sub.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded transition-colors">
                      <CheckboxV2 
                        id={sub.id} 
                        checked={selectedSubIds.includes(sub.id)} 
                        onChange={(e) => {
                          const isChecked = e.target.checked
                          if (isChecked) setSelectedSubIds(prev => [...prev, sub.id])
                          else setSelectedSubIds(prev => prev.filter(id => id !== sub.id))
                        }}
                      />
                      <Label htmlFor={sub.id} className="text-xs font-medium cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {sub.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="font-medium text-xs rounded-full"
                disabled={!selectedCategoryId || downloading !== null}
                onClick={() => handleDownloadTemplate("csv")}
              >
                {downloading === "csv" ? "Downloading..." : "Download CSV Template"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="font-medium text-xs rounded-full"
                disabled={!selectedCategoryId || downloading !== null}
                onClick={() => handleDownloadTemplate("xlsx")}
              >
                {downloading === "xlsx" ? "Downloading..." : "Download Excel Template"}
              </Button>
            </div>
            {!selectedCategoryId && (
              <p className="text-[10px] text-muted-foreground italic">* Select a category to enable template downloads with dummy products.</p>
            )}
          </section>

          {/* Tips Section */}
          <div className="rounded-lg border bg-blue-500/5 p-4 text-xs space-y-2">
            <p className="font-semibold text-blue-600 dark:text-blue-400">Pro Tips:</p>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground font-medium">
              <li>The template includes <strong className="text-foreground underline">dummy rows</strong> to guide you. Replace or delete them.</li>
              <li>Use the <code className="bg-background px-1 rounded border">condition</code> column to specify <strong className="text-foreground">NEW</strong> or <strong className="text-foreground">USED</strong>.</li>
              <li>New: Use <code className="bg-background px-1 rounded border">delivery_charge_per_km</code> to set a per-KM delivery rate.</li>
              <li>Multiple variants? Use the same <code className="bg-background px-1 rounded border">product_key</code> for those rows.</li>
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
