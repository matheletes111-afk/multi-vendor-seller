import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/app/theme-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Multivendor Marketplace",
  description: "A full-featured multivendor e-commerce and services platform",
  icons: {
    icon: "/images/logo-two.jpeg",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

