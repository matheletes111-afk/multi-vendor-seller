import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Button } from "@/ui/button"
import { FileText, Download, Target, Image as ImageIcon, ExternalLink } from "lucide-react"

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
    return (
      <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-muted/50 rounded-xl bg-muted/10 text-muted-foreground/40 gap-2 h-24 w-full">
        <FileText className="h-5 w-5" />
        <span className="text-[10px] font-medium uppercase tracking-widest text-center">Missing Data</span>
      </div>
    )
  }

  const isPdf = url.toLowerCase().endsWith(".pdf") || mimeType?.includes("pdf")

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
        ) : (
          <img src={url} alt={title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 scale-100 group-hover:scale-105 transition-all duration-500" />
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
                 {isPdf ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
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
            ) : (
              <img 
                src={url} 
                alt={title} 
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl ring-1 ring-white/10" 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
