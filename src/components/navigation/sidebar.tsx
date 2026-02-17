"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

interface SidebarProps {
  children: ReactNode
  className?: string
}

export function Sidebar({ children, className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background transition-transform",
        className
      )}
    >
      <div className="flex h-full flex-col">{children}</div>
    </aside>
  )
}

interface SidebarHeaderProps {
  children: ReactNode
  className?: string
}

export function SidebarHeader({ children, className }: SidebarHeaderProps) {
  return (
    <div className={cn("flex items-center justify-center border-b px-6 py-4", className)}>
      {children}
    </div>
  )
}

interface SidebarContentProps {
  children: ReactNode
  className?: string
}

export function SidebarContent({ children, className }: SidebarContentProps) {
  return (
    <nav className={cn("flex-1 space-y-1 overflow-y-auto px-3 py-4", className)}>
      {children}
    </nav>
  )
}

interface SidebarFooterProps {
  children: ReactNode
  className?: string
}

export function SidebarFooter({ children, className }: SidebarFooterProps) {
  return (
    <div className={cn("border-t p-4", className)}>
      {children}
    </div>
  )
}

