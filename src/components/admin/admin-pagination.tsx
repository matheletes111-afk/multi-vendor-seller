"use client"

import Link from "next/link"
import { Button } from "@/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { buildAdminPageUrl } from "@/lib/admin-pagination"

export type AdminPaginationProps = {
  basePath: string
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
  params?: { error?: string; success?: string }
}

export function AdminPagination({
  basePath,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  params,
}: AdminPaginationProps) {
  if (totalCount === 0) return null
  if (totalPages <= 1) {
    return (
      <p className="text-sm text-muted-foreground pt-2">
        Showing all {totalCount} item{totalCount !== 1 ? "s" : ""}
      </p>
    )
  }

  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalCount)

  const prevUrl = currentPage > 1 ? buildAdminPageUrl(basePath, currentPage - 1, params) : null
  const nextUrl = currentPage < totalPages ? buildAdminPageUrl(basePath, currentPage + 1, params) : null

  const pageNumbers: number[] = []
  const showLeft = currentPage > 2
  const showRight = currentPage < totalPages - 1
  for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
    pageNumbers.push(i)
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
      <p className="text-sm text-muted-foreground order-2 sm:order-1">
        Showing {start}–{end} of {totalCount}
      </p>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        {prevUrl ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={prevUrl}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
        )}

        <div className="flex items-center gap-1 px-2">
          {showLeft && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={buildAdminPageUrl(basePath, 1, params)}>1</Link>
              </Button>
              {currentPage > 3 && <span className="text-muted-foreground px-1">…</span>}
            </>
          )}
          {pageNumbers.map((n) => (
            <Button
              key={n}
              variant={n === currentPage ? "default" : "outline"}
              size="sm"
              asChild={n !== currentPage}
            >
              {n === currentPage ? (
                <span>{n}</span>
              ) : (
                <Link href={buildAdminPageUrl(basePath, n, params)}>{n}</Link>
              )}
            </Button>
          ))}
          {showRight && (
            <>
              {currentPage < totalPages - 2 && <span className="text-muted-foreground px-1">…</span>}
              <Button variant="outline" size="sm" asChild>
                <Link href={buildAdminPageUrl(basePath, totalPages, params)}>{totalPages}</Link>
              </Button>
            </>
          )}
        </div>

        {nextUrl ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={nextUrl}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
