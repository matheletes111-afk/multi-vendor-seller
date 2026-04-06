"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/ui/sheet"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription } from "@/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"
import { PageLoader } from "@/components/ui/page-loader"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog"
import { Plus, Pencil, Trash2, Upload, X, ImageIcon } from "lucide-react"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { cn } from "@/lib/utils"

type Ad = {
  id: string
  title: string
  description?: string | null
  image?: string | null
  isActive: boolean
}

export function AdManagementPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))
  const params = {
    error: searchParams.get("error") ?? undefined,
    success: searchParams.get("success") ?? undefined,
  }

  const [data, setData] = useState<{
    ads: Ad[]
    totalCount: number
    totalPages: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFetchError(null)
    fetch(`/api/admin/admanage?page=${page}&perPage=${perPage}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch ads")
        return res.json()
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((e) => {
        if (!cancelled) setFetchError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, perPage])

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Advertisement Management</h1>
          <p className="text-muted-foreground mt-2 text-lg font-medium">Manage your platform&apos;s visual real estate and marketing assets</p>
        </div>
        <AddAdForm />
      </div>

      {params?.error && (
        <Alert variant="destructive" className="border-none shadow-xl bg-destructive/10 text-destructive animate-in slide-in-from-top-4 duration-500">
          <AlertDescription className="font-medium">{decodeURIComponent(params.error)}</AlertDescription>
        </Alert>
      )}
      {params?.success && (
        <Alert className="border-none shadow-xl bg-green-500/10 text-green-600 animate-in slide-in-from-top-4 duration-500">
          <AlertDescription className="font-medium text-xs">Action completed: {decodeURIComponent(params.success)}</AlertDescription>
        </Alert>
      )}

      <Card className="border-none shadow-2xl overflow-hidden rounded-3xl bg-gradient-to-br from-background via-background to-muted/20">
        <CardHeader className="pb-4 border-b border-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-medium">Creative Assets</CardTitle>
              <CardDescription className="text-sm font-medium">Review and moderate all platform advertisements</CardDescription>
            </div>
            {data && (
              <Badge variant="outline" className="px-4 py-1 font-medium rounded-full shadow-sm bg-background border-primary/20 text-primary">
                {data.totalCount} Ad Units
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="py-32">
              <PageLoader message="Loading creative engine…" />
            </div>
          ) : fetchError ? (
            <div className="py-24 text-center">
              <p className="text-destructive font-medium">{fetchError}</p>
            </div>
          ) : !data ? null : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40 transition-none">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="py-5 pl-8 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Asset Preview</TableHead>
                      <TableHead className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Creative Title</TableHead>
                      <TableHead className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Narrative</TableHead>
                      <TableHead className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Status</TableHead>
                      <TableHead className="text-right pr-8 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Control</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.ads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-24 text-center">
                          <Plus className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                          <p className="text-muted-foreground font-medium text-xs">No advertisements identified</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.ads.map((ad) => (
                        <TableRow key={ad.id} className="group transition-all hover:bg-muted/20 border-b border-muted/30">
                          <TableCell className="pl-8">
                            <AdImage image={ad.image} title={ad.title} />
                          </TableCell>
                          <TableCell className="py-5">
                            <span className="text-sm font-medium truncate max-w-[200px] block">{ad.title}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-[10px] text-muted-foreground/60 italic line-clamp-1 max-w-[240px] block font-medium">
                              {ad.description || "Detailed creative narrative pending"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "rounded-full text-[9px] font-medium uppercase tracking-widest px-3 py-0.5 border-none shadow-sm shadow-black/5",
                              ad.isActive ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                            )}>
                              {ad.isActive ? "Live" : "Holding"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-8">
                            <div className="flex justify-end gap-2 transition-all duration-300">
                              <EditAdForm ad={ad} />
                              <DeleteAdButton adId={ad.id} adTitle={ad.title} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="p-8 bg-muted/10 border-t border-muted/20 rounded-b-3xl">
                <AdminPagination
                  basePath="/admin/admanagement"
                  currentPage={page}
                  totalPages={data.totalPages}
                  totalCount={data.totalCount}
                  pageSize={perPage}
                  params={params}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AdImage({ image, title }: { image: string | null | undefined; title: string }) {
  const [imageError, setImageError] = useState(false)
  if (!image || imageError) {
    return (
      <div className="w-24 h-14 rounded-2xl bg-muted/50 flex items-center justify-center border-2 border-dashed border-muted shrink-0 shadow-inner">
        <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
      </div>
    )
  }
  return (
    <div className="relative w-24 h-14 rounded-2xl overflow-hidden bg-muted shadow-lg border border-muted/50 transition-transform group-hover:scale-105 duration-500 shrink-0">
      <Image src={image} alt={title} fill sizes="80px" className="object-cover" onError={() => setImageError(true)} />
    </div>
  )
}

function AddAdForm() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const router = useRouter()

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file?.type.startsWith("image/")) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    } else if (file) alert("Please select an image file")
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (typeof window !== "undefined") {
      const el = document.getElementById("image-upload") as HTMLInputElement
      if (el) el.value = ""
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      const submitFormData = new FormData()
      submitFormData.append("title", (formData.get("title") as string) ?? "")
      submitFormData.append("description", (formData.get("description") as string) ?? "")
      submitFormData.append("isActive", formData.get("isActive") === "on" ? "true" : "false")
      if (imageFile) submitFormData.append("image", imageFile)

      const res = await fetch("/api/admin/admanage/create", { method: "POST", body: submitFormData })
      const data = await res.json()
      if (data.success) {
        setOpen(false)
        setImagePreview(null)
        setImageFile(null)
        router.refresh()
        router.push("/admin/admanagement?success=Ad created successfully")
      } else {
        router.push(`/admin/admanagement?error=${encodeURIComponent(data.error)}`)
      }
    } catch {
      router.push("/admin/admanagement?error=Failed to create ad")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="rounded-full px-6 font-medium text-xs h-12 shadow-lg shadow-primary/20 hover:scale-105 transition-all">
          <Plus className="mr-2 h-4 w-4" />
          Add Advertisement
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto rounded-l-3xl border-none shadow-2xl bg-gradient-to-b from-background to-muted/20">
        <SheetHeader className="pb-8">
          <SheetTitle className="text-2xl font-medium uppercase tracking-tight">Deploy Creative</SheetTitle>
          <SheetDescription className="text-base font-medium">Create a new advertisement image and content strategy</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-2 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">Asset Title *</Label>
            <Input id="title" name="title" className="rounded-2xl border-muted bg-muted/30 focus-visible:ring-primary h-11" placeholder="e.g., Seasonal Global Campaign" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">Narrative Deck</Label>
            <Textarea id="description" name="description" className="rounded-2xl border-muted bg-muted/30 focus-visible:ring-primary min-h-[120px]" placeholder="Outline the marketing objective..." rows={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">Hero Asset</Label>
            {!imagePreview ? (
              <label htmlFor="image-upload" className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-muted rounded-[2rem] cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-all group">
                <div className="p-4 bg-muted/50 rounded-2xl group-hover:bg-primary/10 transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                </div>
                <p className="mt-3 text-xs font-medium uppercase tracking-widest text-muted-foreground group-hover:text-primary">Stash Creative Asset</p>
                <input id="image-upload" name="image" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            ) : (
              <div className="relative w-full h-48 rounded-[2rem] overflow-hidden shadow-xl border border-muted ring-offset-4 ring-2 ring-transparent hover:ring-primary/20 transition-all">
                <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                <button type="button" onClick={removeImage} className="absolute top-4 right-4 p-2 bg-destructive text-white rounded-full hover:bg-destructive/90 shadow-lg transform hover:scale-110 transition-all">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-2xl">
            <input id="isActive" name="isActive" type="checkbox" defaultChecked className="h-5 w-5 rounded-lg border-muted text-primary focus:ring-primary" />
            <Label htmlFor="isActive" className="text-xs font-medium uppercase tracking-widest">Enable immediate deployment</Label>
          </div>
          <div className="flex gap-3 pt-6">
            <Button type="submit" className="flex-1 rounded-full h-12 font-medium uppercase tracking-widest text-xs shadow-xl shadow-primary/20" disabled={loading}>{loading ? "Synchronizing..." : "Initiate Unit"}</Button>
            <Button type="button" variant="outline" className="rounded-full h-12 px-6 font-medium uppercase tracking-widest text-xs" onClick={() => { setOpen(false); setImagePreview(null); setImageFile(null) }} disabled={loading}>Discard</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function EditAdForm({ ad }: { ad: Ad }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const router = useRouter()

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file?.type.startsWith("image/")) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    } else if (file) alert("Please select an image file")
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (typeof window !== "undefined") {
      const el = document.getElementById("edit-image-upload") as HTMLInputElement
      if (el) el.value = ""
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      const submitData = new FormData()
      submitData.append("title", (formData.get("title") as string) ?? "")
      submitData.append("description", (formData.get("description") as string) ?? "")
      submitData.append("isActive", formData.get("isActive") === "on" ? "true" : "false")
      if (imageFile) submitData.append("image", imageFile)

      const res = await fetch(`/api/admin/admanage/edit/${ad.id}`, { method: "PUT", body: submitData })
      const data = await res.json()
      if (data.success) {
        setOpen(false)
        router.refresh()
        window.location.href = "/admin/admanagement?success=Ad updated successfully"
      } else {
        window.location.href = `/admin/admanagement?error=${encodeURIComponent(data.error || "Update failed")}`
      }
    } catch {
      window.location.href = "/admin/admanagement?error=Failed to update ad"
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
          <Pencil className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto rounded-l-3xl border-none shadow-2xl bg-gradient-to-b from-background to-muted/20">
        <SheetHeader className="pb-8">
          <SheetTitle className="text-2xl font-medium uppercase tracking-tight">Refine Creative</SheetTitle>
          <SheetDescription className="text-base font-medium">Update advertisement visuals and strategic content</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-2 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">Asset Title *</Label>
            <Input id="title" name="title" defaultValue={ad.title} className="rounded-2xl border-muted bg-muted/30 focus-visible:ring-primary h-11" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">Narrative Deck</Label>
            <Textarea id="description" name="description" className="rounded-2xl border-muted bg-muted/30 focus-visible:ring-primary min-h-[100px]" rows={3} defaultValue={ad.description || ""} />
          </div>
          {ad.image && !imagePreview && (
            <div className="relative w-full h-32 rounded-2xl border border-muted/50 overflow-hidden shadow-inner bg-muted/10">
              <Image src={ad.image} alt={ad.title} fill className="object-contain" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="edit-image-upload" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">Visual Replacement</Label>
            {!imagePreview ? (
              <label htmlFor="edit-image-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted rounded-[2rem] cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-all">
                <Upload className="w-6 h-6 mb-2 text-muted-foreground" />
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Upload New Hero Asset</p>
                <input id="edit-image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            ) : (
              <div className="relative w-full h-40 rounded-[2rem] border-2 border-primary/20 overflow-hidden shadow-xl">
                <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                <button type="button" onClick={removeImage} className="absolute top-3 right-3 p-1.5 bg-destructive text-white rounded-full hover:bg-destructive/90 transform hover:scale-110 transition-all shadow-lg">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-2xl">
            <input id="isActive" name="isActive" type="checkbox" defaultChecked={ad.isActive} className="h-5 w-5 rounded-lg border-muted text-primary focus:ring-primary" />
            <Label htmlFor="isActive" className="text-xs font-medium uppercase tracking-widest whitespace-nowrap">Live Deployment Enabled</Label>
          </div>
          <div className="flex gap-3 pt-6">
            <Button type="submit" className="flex-1 rounded-full h-12 font-medium uppercase tracking-widest text-xs shadow-xl shadow-primary/20" disabled={loading}>{loading ? "Synchronizing..." : "Update Creative"}</Button>
            <Button type="button" variant="outline" className="rounded-full h-12 px-6 font-medium uppercase tracking-widest text-xs" onClick={() => setOpen(false)}>Discard</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function DeleteAdButton({ adId, adTitle }: { adId: string; adTitle: string }) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/admanage/delete/${adId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setOpen(false)
        router.refresh()
        router.push("/admin/admanagement?success=Ad deleted successfully")
      } else {
        router.push(`/admin/admanagement?error=${encodeURIComponent(data.error)}`)
      }
    } catch {
      router.push("/admin/admanagement?error=Failed to delete ad")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">Archive Advertisement</DialogTitle>
          <DialogDescription className="text-base font-medium pt-2">
            Are you sure you want to permanently discard &quot;<span className="text-foreground font-bold">{adTitle}</span>&quot;? This asset will be immediately removed from all live marketing inventories.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0 mt-6">
          <Button variant="outline" className="rounded-full px-6 font-bold uppercase tracking-widest text-[10px]" onClick={() => setOpen(false)} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" className="rounded-full px-6 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-destructive/20" onClick={handleDelete} disabled={isDeleting}>{isDeleting ? "Archiving..." : "Confirm Removal"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
