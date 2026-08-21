"use client"

import React from "react"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { TableHead } from "@/ui/table"
import { cn } from "@/lib/utils"

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  field: string
  currentSortBy: string
  currentSortOrder: "asc" | "desc"
  onSort: (field: string) => void
  children: React.ReactNode
}

export function SortableTableHead({
  field,
  currentSortBy,
  currentSortOrder,
  onSort,
  children,
  className,
  ...props
}: SortableTableHeadProps) {
  const isSorted = currentSortBy.toLowerCase() === field.toLowerCase()

  return (
    <TableHead
      className={cn("cursor-pointer select-none transition-colors hover:bg-slate-100/60 dark:hover:bg-slate-800/60", className)}
      onClick={() => onSort(field)}
      title={`Sort by ${String(children)}`}
      {...props}
    >
      <div className="flex items-center gap-1.5 font-bold">
        <span>{children}</span>
        {isSorted ? (
          currentSortOrder === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 shrink-0 hover:text-muted-foreground" />
        )}
      </div>
    </TableHead>
  )
}
