"use client"

import React, { useState } from "react"
import { CheckCircle2, AlertCircle, FileText, ChevronRight, ExternalLink, ShieldCheck, ShieldAlert } from "lucide-react"
import { Badge } from "@/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/popover"
import { Button } from "@/ui/button"
import { cn } from "@/lib/utils"
import type { SellerDocumentEvaluation } from "@/lib/seller-approval-validation"

interface SellerDocumentBadgeProps {
  evaluation?: SellerDocumentEvaluation | null
  className?: string
  compact?: boolean
  showMissingList?: boolean
}

export function SellerDocumentBadge({ evaluation, className, compact = false, showMissingList = true }: SellerDocumentBadgeProps) {
  const [open, setOpen] = useState(false)

  if (!evaluation) {
    return (
      <Badge variant="outline" className={cn("text-xs font-normal text-muted-foreground border-dashed", className)}>
        Pending Check
      </Badge>
    )
  }

  const { isComplete, uploadedCount, totalRequired, missingCount, missingDocuments, documentsList } = evaluation

  return (
    <div className={cn("flex flex-col items-start gap-1 max-w-[240px]", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer",
              isComplete
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
            )}
            title="Click to view document checklist"
          >
            {isComplete ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{compact ? "Complete" : `Complete (${uploadedCount}/${totalRequired})`}</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
                <span className="font-semibold">{compact ? `${missingCount} Missing` : `Incomplete (${missingCount} missing)`}</span>
              </>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-80 p-0 shadow-xl border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden z-50" align="start">
          <div className={cn(
            "px-4 py-3 border-b flex items-center justify-between",
            isComplete ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40" : "bg-amber-50/70 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/40"
          )}>
            <div className="flex items-center gap-2">
              {isComplete ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
              <div>
                <p className="text-xs font-bold text-foreground">
                  {isComplete ? "All Documents Complete" : `${missingCount} Documents Incomplete`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {uploadedCount} of {totalRequired} required items verified
                </p>
              </div>
            </div>
            <Badge
              variant={isComplete ? "default" : "secondary"}
              className={cn("text-[10px] font-semibold uppercase px-2 py-0.5", isComplete ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-500/20 text-amber-800 dark:text-amber-300")}
            >
              {Math.round((uploadedCount / (totalRequired || 1)) * 100)}%
            </Badge>
          </div>

          <div className="p-3 max-h-72 overflow-y-auto space-y-1.5">
            {documentsList && documentsList.length > 0 ? (
              documentsList.map((doc, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors",
                    doc.isUploaded
                      ? "bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300"
                      : doc.isOptional
                      ? "bg-slate-50/50 dark:bg-slate-900/30 text-slate-500 border border-slate-200/50 dark:border-slate-800"
                      : "bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 border border-amber-200/50 dark:border-amber-900/40"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {doc.isUploaded ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : doc.isOptional ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0 ml-1 mr-1" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    )}
                    <span className={cn("truncate font-medium", !doc.isUploaded && !doc.isOptional && "font-semibold")}>
                      {doc.name} {doc.isOptional && <span className="text-[10px] text-muted-foreground font-normal">(Optional)</span>}
                    </span>
                  </div>

                  {doc.isUploaded && doc.url ? (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-0.5 shrink-0 hover:underline"
                      title="View uploaded document"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className={cn(
                      "text-[10px] font-bold shrink-0",
                      doc.isUploaded ? "text-emerald-600" : doc.isOptional ? "text-slate-400 font-normal" : "text-amber-700 dark:text-amber-400"
                    )}>
                      {doc.isUploaded ? "Verified" : doc.isOptional ? "Not uploaded" : "Missing"}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">No documents checklist available</p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Inline Missing Documents Names in Column */}
      {showMissingList && !isComplete && missingDocuments && missingDocuments.length > 0 && (
        <div className="flex flex-col gap-0.5 mt-0.5 w-full">
          {missingDocuments.slice(0, 3).map((name, i) => (
            <span
              key={i}
              className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1 leading-tight truncate"
              title={`Missing: ${name}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span className="truncate">{name}</span>
            </span>
          ))}
          {missingDocuments.length > 3 && (
            <button
              type="button"
              className="text-[10px] text-muted-foreground font-semibold pl-2.5 text-left hover:underline cursor-pointer"
              onClick={() => setOpen(true)}
            >
              +{missingDocuments.length - 3} more missing...
            </button>
          )}
        </div>
      )}
    </div>
  )
}
