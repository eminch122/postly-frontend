"use client"

import Link from "next/link"
import { Sparkles, Menu, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand/60 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="hidden sm:inline text-foreground">Postly</span>
        </Link>

        {/* Desktop menu */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            How it Works
          </a>
          <a href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </a>
        </div>

        {/* Auth buttons */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button size="sm" className="bg-brand hover:bg-brand/90 text-white" asChild>
            <Link href="/signup">Start Free</Link>
          </Button>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-surface p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <a href="#features" className="block text-sm text-muted-foreground hover:text-foreground py-2 transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="block text-sm text-muted-foreground hover:text-foreground py-2 transition-colors">
            How it Works
          </a>
          <a href="/pricing" className="block text-sm text-muted-foreground hover:text-foreground py-2 transition-colors">
            Pricing
          </a>
          <div className="border-t border-border pt-3 space-y-2">
            <Button variant="ghost" size="sm" className="w-full justify-center" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button size="sm" className="w-full bg-brand hover:bg-brand/90 text-white" asChild>
              <Link href="/signup">Start Free</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
