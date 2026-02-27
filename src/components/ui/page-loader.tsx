"use client"

import { cn } from "@/lib/utils"

type PageLoaderVariant = "default" | "listing" | "detail"

interface PageLoaderProps {
  variant?: PageLoaderVariant
  message?: string
  className?: string
}

/** E‑commerce style full-page loader: spinner + optional message or skeleton. */
export function PageLoader({
  variant = "default",
  message,
  className,
}: PageLoaderProps) {
  if (variant === "listing") {
    return <ListingLoader className={className} message={message} />
  }
  if (variant === "detail") {
    return <DetailLoader className={className} message={message} />
  }
  return (
    <div
      className={cn(
        "flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 py-16",
        className
      )}
      role="status"
      aria-label={message ?? "Loading"}
    >
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute h-14 w-14 rounded-full border-2 border-primary/20" />
        <div className="absolute h-14 w-14 animate-spin rounded-full border-2 border-transparent border-t-primary" />
        <div className="absolute h-8 w-8 rounded-full border-2 border-transparent border-b-primary/60 animate-spin [animation-duration:0.8s] [animation-direction:reverse]" />
      </div>
      {message && (
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          {message}
        </p>
      )}
    </div>
  )
}

function ListingLoader({ className, message }: { className?: string; message?: string }) {
  return (
    <div
      className={cn("container mx-auto space-y-8 px-4 py-8", className)}
      role="status"
      aria-label={message ?? "Loading"}
    >
      <div className="flex items-center gap-3">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border bg-card shadow-sm"
          >
            <div className="aspect-square w-full animate-pulse bg-muted" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DetailLoader({ className, message }: { className?: string; message?: string }) {
  return (
    <div
      className={cn("mx-auto max-w-6xl px-4 py-8", className)}
      role="status"
      aria-label={message ?? "Loading"}
    >
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="shrink-0 space-y-3 lg:w-[380px]">
          <div className="aspect-square w-full animate-pulse rounded-lg bg-muted" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 w-16 shrink-0 animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-4">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-10 w-32 animate-pulse rounded bg-muted" />
          <div className="flex gap-3 pt-4">
            <div className="h-12 w-32 animate-pulse rounded-lg bg-muted" />
            <div className="h-12 w-28 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    </div>
  )
}
