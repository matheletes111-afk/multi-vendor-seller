import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, ShoppingBag, Store, Users, Zap } from "lucide-react"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" />
            <span className="text-xl font-semibold">Marketplace</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Button asChild>
              <Link href="/register">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto flex flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mb-8 inline-flex items-center rounded-full border bg-muted px-3 py-1 text-sm">
          <Zap className="mr-2 h-4 w-4" />
          <span>Modern multivendor platform</span>
        </div>
        <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl">
          Build your business on
          <br />
          <span className="text-primary">our marketplace</span>
        </h1>
        <p className="mb-8 max-w-2xl text-lg text-muted-foreground">
          A full-featured multivendor e-commerce and services platform. Sell products,
          offer services, and grow your business with powerful tools and analytics.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/register">
              Get started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/browse">Browse marketplace</Link>
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t bg-muted/50">
        <div className="container mx-auto px-4 py-24">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Everything you need</h2>
            <p className="text-muted-foreground">
              Powerful features to help you succeed
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-6">
              <Store className="mb-4 h-8 w-8 text-primary" />
              <h3 className="mb-2 text-xl font-semibold">Multi-vendor Support</h3>
              <p className="text-muted-foreground">
                Enable multiple sellers to list products and services on a single platform.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <Users className="mb-4 h-8 w-8 text-primary" />
              <h3 className="mb-2 text-xl font-semibold">Role-Based Access</h3>
              <p className="text-muted-foreground">
                Manage customers, sellers, and admins with granular permissions and controls.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <Zap className="mb-4 h-8 w-8 text-primary" />
              <h3 className="mb-2 text-xl font-semibold">Fast & Reliable</h3>
              <p className="text-muted-foreground">
                Built with modern technology for speed, scalability, and reliability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              <span className="text-sm font-medium">Marketplace</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Marketplace. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

