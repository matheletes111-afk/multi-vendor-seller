"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar"
import { LayoutGrid, Menu, Search, Heart, LogOut, User as UserIcon, Calendar, Building2, Shield, MapPin, Mail, Phone, Facebook, Twitter, Instagram, Linkedin, Youtube } from "lucide-react"

export default function HotelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [mounted, setMounted] = useState(false)
  const isLoggedIn = status === "authenticated" && !!session?.user

  useEffect(() => setMounted(true), [])

  const userInitials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || session?.user?.email?.[0]?.toUpperCase() || "U"

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 font-sans">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/hotels" className="flex shrink-0 items-center gap-2">
            <Image src="/images/logo.png" alt="MEEEM Logo" width={120} height={36} className="h-8 w-auto object-contain" priority />
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Hotels & Stays</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Marketplace Home</Link>
            <Link href="/hotels" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">Find Stays</Link>
            {isLoggedIn && (
              <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Vendor Dashboard</Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {mounted && isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-emerald-500/10">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || ""} />
                      <AvatarFallback className="bg-emerald-500 text-white font-bold">{userInitials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 mt-1 rounded-2xl border-slate-100 shadow-xl">
                  <DropdownMenuLabel className="font-normal px-4 py-3">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold text-slate-900 leading-none">{session.user.name}</p>
                      <p className="text-xs text-slate-500 leading-none truncate">{session.user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-50" />
                  <DropdownMenuItem asChild className="rounded-xl mx-1.5 focus:bg-emerald-50 focus:text-emerald-700">
                    <Link href="/customer/settings" className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      <span>My Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-50" />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/hotels" })} className="rounded-xl mx-1.5 focus:bg-rose-50 focus:text-rose-700 text-rose-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              mounted && (
                <div className="flex items-center gap-2">
                  <Link href="/customer/login?callbackUrl=/hotels">
                    <Button variant="ghost" className="text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 rounded-xl h-10 px-4">Sign In</Button>
                  </Link>
                  <Link href="/customer/registration">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl h-10 px-5 shadow-md shadow-emerald-500/10">Sign Up</Button>
                  </Link>
                </div>
              )
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {children}
      </main>

      {/* Premium Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="container mx-auto px-6 py-10">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="space-y-4">
              <Link href="/hotels" className="flex items-center gap-2">
                <Image src="/images/logo.png" alt="MEEEM" width={130} height={40} className="h-9 w-auto object-contain" />
              </Link>
              <p className="text-sm text-slate-500 leading-relaxed">Discover luxurious stays and rooms at unbeatable rates. Seamlessly book and manage your vacation escapes.</p>
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">Quick Links</h3>
              <ul className="space-y-2.5">
                <li><Link href="/" className="text-sm text-slate-500 hover:text-emerald-600 hover:underline">Marketplace Home</Link></li>
                <li><Link href="/hotels" className="text-sm text-slate-500 hover:text-emerald-600 hover:underline">Find Stays</Link></li>
                <li><Link href="/customer/login" className="text-sm text-slate-500 hover:text-emerald-600 hover:underline">Customer Login</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">Contact Info</h3>
              <ul className="space-y-3 text-sm text-slate-500">
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                  <span>Freetown, Sierra Leone</span>
                </li>
                <li className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-slate-400 mt-0.5" />
                  <a href="mailto:support@meeemsl.com" className="hover:text-emerald-600">support@meeemsl.com</a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">Security</h3>
              <div className="flex items-center gap-2 text-sm text-emerald-600 font-semibold bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
                <Shield className="h-4 w-4 shrink-0" />
                <span>Secure Escrow Bookings</span>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-slate-100 pt-6 text-center">
            <p className="text-xs text-slate-400">© {new Date().getFullYear()} MEEEM Hotels. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
