"use client"

import { PublicNavbar } from "./public-navbar"
import { PublicFooter } from "./public-footer"

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PublicNavbar />
      <main className="flex-1 pt-16 w-full">
        {children}
      </main>
      <PublicFooter />
    </div>
  )
}
