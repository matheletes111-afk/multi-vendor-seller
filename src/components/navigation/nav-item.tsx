"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface NavItemProps {
  href: string
  label: string
  icon?: ReactNode
  badge?: string | number
}

export function NavItem({ href, label, icon, badge }: NavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname?.startsWith(`${href}/`)

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {icon && <span className="h-4 w-4">{icon}</span>}
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
          {badge}
        </span>
      )}
    </Link>
  )
}

