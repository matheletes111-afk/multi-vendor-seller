"use client"

import React from "react"
import Link from "next/link"
import { ShieldCheck, HelpCircle, FileText, Trash2, Mail, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardFooterProps {
  className?: string
  panelName?: string
}

export function DashboardFooter({ className, panelName }: DashboardFooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      className={cn(
        "mt-auto border-t border-slate-200/80 bg-white/80 backdrop-blur-sm px-4 py-4 sm:px-6 sm:py-5 text-xs text-slate-500",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left / Branding & Copyright */}
        <div className="flex flex-wrap items-center gap-2 text-center sm:text-left">
          <span className="font-semibold text-slate-700">© {currentYear} MEEEM Marketplace.</span>
          <span className="hidden sm:inline text-slate-300">•</span>
          <span>All rights reserved.</span>
          {panelName && (
            <span className="hidden md:inline text-slate-400 font-medium">({panelName})</span>
          )}
        </div>

        {/* Right / Quick Navigation Links */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link
            href="/terms"
            className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-semibold transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-500" />
            <span>All Terms</span>
          </Link>

          <span className="text-slate-300">•</span>

          <Link
            href="/terms-and-conditions"
            className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-medium transition-colors"
          >
            <span>Terms & Conditions</span>
          </Link>

          <span className="text-slate-300">•</span>

          <Link
            href="/privacy-policy"
            className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-medium transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Privacy Policy</span>
          </Link>

          <span className="text-slate-300">•</span>

          <Link
            href="/support"
            className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-medium transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
            <span>Support</span>
          </Link>

          <span className="text-slate-300">•</span>

          <Link
            href="/delete-account"
            className="inline-flex items-center gap-1 text-slate-600 hover:text-rose-600 font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Delete Account</span>
          </Link>
        </div>
      </div>
    </footer>
  )
}
