"use client"

import { useCallback, useState } from "react"
import { Check, Share2 } from "lucide-react"
import { Button } from "@/ui/button"
import { cn } from "@/lib/utils"

type ShareButtonProps = {
  /** Shared title (e.g. product name) for Web Share API */
  title?: string
  className?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "icon" | "sm" | "lg"
}

export function ShareButton({ title, className, variant = "outline", size = "icon" }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const onShare = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    const shareTitle = title?.trim() || (typeof document !== "undefined" ? document.title : "")
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url })
        return
      } catch (e) {
        if ((e as Error).name === "AbortError") return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }, [title])

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={() => void onShare()}
      aria-label={copied ? "Link copied" : "Share"}
      title={copied ? "Copied!" : "Share or copy link"}
    >
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4" />}
    </Button>
  )
}
