"use client"

import { useEffect, useRef, useState } from "react"

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string
          callback?: (token: string) => void
          "expired-callback"?: () => void
          "error-callback"?: (error: any) => void
          theme?: "light" | "dark" | "auto"
          size?: "normal" | "compact" | "flexible"
        }
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
    onloadTurnstileCallback?: () => void
  }
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  theme?: "light" | "dark" | "auto"
  className?: string
}

export function TurnstileWidget({ onVerify, theme = "auto", className = "" }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "0x4AAAAAAF0n2El0pAXQnkOT"

  // 1. Load Cloudflare Turnstile Script if not already loaded
  useEffect(() => {
    if (typeof window === "undefined") return

    if (window.turnstile) {
      setScriptLoaded(true)
      return
    }

    const existingScript = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')
    if (existingScript) {
      existingScript.addEventListener("load", () => setScriptLoaded(true))
      if ((existingScript as any).readyState === "loaded" || (existingScript as any).readyState === "complete") {
        setScriptLoaded(true)
      }
      return
    }

    const script = document.createElement("script")
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    script.async = true
    script.defer = true
    script.onload = () => setScriptLoaded(true)
    document.head.appendChild(script)
  }, [])

  // 2. Render Widget when script is ready
  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !window.turnstile) return

    // If already rendered, remove previous
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current)
      } catch {}
      widgetIdRef.current = null
    }

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          onVerify(token)
        },
        "expired-callback": () => {
          onVerify("")
        },
        "error-callback": () => {
          console.warn("[Turnstile] Challenge encounter error or failed to load")
          onVerify("")
        },
        theme,
      })
    } catch (err) {
      console.warn("[Turnstile] Render error:", err)
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {}
        widgetIdRef.current = null
      }
    }
  }, [scriptLoaded, siteKey, theme, onVerify])

  return (
    <div className={`flex justify-center my-3 min-h-[65px] ${className}`}>
      <div ref={containerRef} />
    </div>
  )
}

