"use client"

import { useState, useEffect, useCallback } from "react"
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

  async function handleDownloadTemplate(format: "csv" | "xlsx") {
    setError(null)
    setDownloading(format)
    try {
      const res = await fetch(`/api/product-seller/products/bulk-template?format=${format}`, {
        credentials: "include",
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(typeof j.error === "string" ? j.error : "Failed to download template")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = format === "xlsx" ? "product-bulk-template.xlsx" : "product-bulk-template.csv"
      a.click()
      URL.revokeObjectURL(url)
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
        <Button type="button" variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Bulk upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk upload products</DialogTitle>
          <DialogDescription className="text-left">
            Add many products at once using a spreadsheet. You can include products from different categories in the same
            file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-3">
            <p className="font-medium text-foreground">How it works</p>
            <ol className="list-decimal pl-4 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <span className="text-foreground">Download a template</span> (Excel or CSV) and open it on your computer.
              </li>
              <li>
                Each <strong className="text-foreground">row</strong> is one sellable option — for example one size or
                color. That row needs a <strong className="text-foreground">name</strong> for that option, a{" "}
                <strong className="text-foreground">price</strong>, and <strong className="text-foreground">stock</strong>{" "}
                (how many you have).
              </li>
              <li>
                Rows that belong to the <strong className="text-foreground">same product</strong> (e.g. Small, Medium,
                Large) should use the <strong className="text-foreground">same value</strong> in the first column
                (product key). The template shows an example.
              </li>
              <li>
                Pick your <strong className="text-foreground">category</strong> and optional <strong className="text-foreground">type</strong>{" "}
                from the list below. Copy the short <strong className="text-foreground">codes</strong> into the matching
                columns in the spreadsheet — the column headers use words like <code className="text-xs bg-background px-1 rounded">category_id</code>{" "}
                and <code className="text-xs bg-background px-1 rounded">subcategory_id</code>; those are just the
                spreadsheet column names for “category code” and “type code”.
              </li>
              <li>
                Using Excel? Enter your data on the sheet named <strong className="text-foreground">Products</strong>.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm space-y-2">
            <p className="font-medium text-foreground">Wrong category or type code?</p>
            <p className="text-muted-foreground leading-relaxed">
              If any <strong className="text-foreground">category_id</strong> or <strong className="text-foreground">subcategory_id</strong>{" "}
              is unknown, not yours, or doesn&apos;t match the category (e.g. a sub-type from another category), the import{" "}
              <strong className="text-foreground">stops and nothing is saved</strong>. You&apos;ll see a list of problems with
              the product name and row numbers — fix the spreadsheet and import again.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
            <p className="font-medium text-foreground">Variant attributes (optional)</p>
            <p className="text-muted-foreground leading-relaxed">
              In the manual product form, each variant can have extra fields like Size or Color. In the spreadsheet, use
              the column named <code className="text-xs bg-background px-1 rounded border">attributes_json</code> — one
              per <strong className="text-foreground">row</strong> (each row is one variant).
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Put a <strong className="text-foreground">JSON object</strong> with quote marks around names and values, e.g.{" "}
              <code className="text-xs bg-background px-1 rounded break-all">{`{"Size":"M","Color":"Blue"}`}</code>. Leave the
              cell empty if that variant has no attributes. In CSV files, wrap the whole thing in double quotes if it
              contains commas:{" "}
              <code className="text-xs bg-background px-1 rounded break-all">{`"{""Size"":""L"",""Color"":""Red""}"`}</code>
            </p>
          </div>

          {loadingCats ? (
            <p className="text-sm text-muted-foreground">Loading your categories…</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-destructive">No categories assigned. Complete onboarding or contact admin.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-base">Your categories — copy the codes into the sheet</Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Under each category name, copy the <strong className="text-foreground">Category code</strong> into the
                  category column. If you use a sub-type (e.g. Men&apos;s clothing), copy the <strong className="text-foreground">Type code</strong>{" "}
                  into the subcategory column. You can use different categories in different rows of the same file.
                </p>
                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {categories.map((cat) => (
                    <div key={cat.id} className="rounded-lg border bg-card p-3 text-sm shadow-sm">
                      <p className="font-semibold text-foreground">{cat.name}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Category code:{" "}
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded border select-all">{cat.id}</code>
                      </p>
                      {cat.subcategories?.length ? (
                        <div className="mt-2 pt-2 border-t border-border/60">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">Types (optional)</p>
                          <ul className="space-y-1.5">
                            {cat.subcategories.map((sub) => (
                              <li key={sub.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                                <span className="text-foreground">{sub.name}</span>
                                <span className="text-muted-foreground">→</span>
                                <code className="font-mono bg-muted px-1.5 py-0.5 rounded border select-all">{sub.id}</code>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={downloading !== null}
                  onClick={() => handleDownloadTemplate("csv")}
                >
                  {downloading === "csv" ? "Downloading…" : "Download CSV template"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={downloading !== null}
                  onClick={() => handleDownloadTemplate("xlsx")}
                >
                  {downloading === "xlsx" ? "Downloading…" : "Download Excel template"}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-file">Your completed file</Label>
                <p className="text-xs text-muted-foreground">CSV or Excel (.xlsx)</p>
                <InputFile id="bulk-file" onFile={(f) => setFile(f)} disabled={importing} />
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {result && <p className="text-sm text-green-600 dark:text-green-500">{result}</p>}
          {importErrors.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm max-h-40 overflow-y-auto">
              <p className="font-medium text-destructive mb-2">Please fix these in your file</p>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {importErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button type="button" disabled={!file || importing || categories.length === 0} onClick={handleImport}>
            {importing ? "Importing…" : "Import products"}
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
}: {
  id: string
  onFile: (f: File | null) => void
  disabled?: boolean
}) {
  return (
    <input
      id={id}
      type="file"
      accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      disabled={disabled}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
      onChange={(e) => {
        const f = e.target.files?.[0] ?? null
        onFile(f)
        e.target.value = ""
      }}
    />
  )
}
