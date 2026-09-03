import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Button } from "@/ui/button"
import { FileText, Download, Target, Image as ImageIcon, ExternalLink } from "lucide-react"
import { isPdfUrl, isImageUrl } from "@/lib/onboarding-file-validation"

interface DocumentViewerProps {
  url: string | null | undefined
  title: string
  mimeType?: string // Optional, but helps guess if PDF. Otherwise checks extension
}

/**
 * A tiny thumbnail card representing a document.
 * Clicking it opens the full DocumentViewer modal.
 */
export function DocumentThumbnail({ url, title, mimeType }: DocumentViewerProps) {
  const [open, setOpen] = useState(false)

  if (!url) {
    const isOpt = title?.toLowerCase().includes("optional")
    return (
      <div className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-muted/50 rounded-xl bg-muted/10 text-muted-foreground/50 gap-1 min-h-24 w-full text-center">
        <FileText className="h-5 w-5 opacity-40" />
        <span className="text-[10px] font-semibold text-muted-foreground/70 block uppercase tracking-wider px-1 truncate max-w-full">{title}</span>
        <span className="text-[9px] font-medium text-muted-foreground/40">{isOpt ? "Not Provided (Optional)" : "Not Uploaded"}</span>
      </div>
    )
  }

  const isPdf = isPdfUrl(url) || mimeType?.includes("pdf")
  const isImage = mimeType?.startsWith("image/") || isImageUrl(url)

  return (
    <>
      <div 
        onClick={() => setOpen(true)}
        className="group flex flex-col items-center justify-center border border-muted/50 rounded-xl bg-muted/10 hover:bg-muted/30 hover:border-primary/30 transition-all cursor-pointer overflow-hidden relative h-28 w-full"
      >
        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors z-10 flex items-center justify-center">
            <div className="bg-background/80 p-1.5 rounded-full backdrop-blur-sm shadow-sm scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all">
                <ExternalLink className="h-4 w-4 text-primary" />
            </div>
        </div>
        
        {isPdf ? (
          <div className="w-full h-full flex items-center justify-center bg-red-500/5">
            <FileText className="h-8 w-8 text-red-500/60" />
          </div>
        ) : isImage ? (
          <img src={url} alt={title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 scale-100 group-hover:scale-105 transition-all duration-500" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-500/5 text-slate-500 gap-1 p-2">
            <FileText className="h-7 w-7 text-slate-400" />
            <span className="text-[9px] font-medium uppercase tracking-wider text-center text-slate-400">Document</span>
          </div>
        )}
      </div>
      
      <div className="mt-2 text-center">
         <span className="text-[10px] font-medium text-muted-foreground/80 block uppercase tracking-widest truncate px-1">{title}</span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col p-0 overflow-hidden bg-muted/10 backdrop-blur-xl border-muted">
          <DialogHeader className="p-4 border-b bg-background/50 backdrop-blur-md">
            <DialogTitle className="flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                 {isPdf ? <FileText className="h-4 w-4 text-red-500" /> : isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4 text-slate-500" />}
                 {title}
              </span>
              <Button asChild size="sm" className="h-8 rounded-full px-4 gap-2 mr-6 shadow-sm">
                <a href={url} target="_blank" download rel="noopener noreferrer">
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-black/5 flex items-center justify-center p-4">
            {isPdf ? (
              <iframe 
                src={url} 
                className="w-full h-full rounded-xl border bg-white shadow-xl"
                title={title}
              />
            ) : isImage ? (
              <img 
                src={url} 
                alt={title} 
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl ring-1 ring-white/10" 
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-3">
                <FileText className="h-16 w-16 text-slate-400" />
                <p className="text-sm font-medium">In-browser preview is only supported for PDF and image files.</p>
                <p className="text-xs text-muted-foreground">Please use the Download button above to view this file.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
