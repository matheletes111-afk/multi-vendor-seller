import type { Metadata } from "next"
import { ThemeProvider } from "@/app/theme-provider"
import { CartProvider } from "@/app/cart/cart-context"
import { WishlistProvider } from "@/app/wishlist/wishlist-context"
import { SessionProvider } from "@/components/session-provider"
import "./globals.css"

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
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SessionProvider>
            <CartProvider>
              <WishlistProvider>
                {children}
              </WishlistProvider>
            </CartProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

