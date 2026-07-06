"use client"

import { Search, ChevronDown, Sun, Moon, Plus, Settings, LogOut, User } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useWorkspace } from "@/lib/workspace-context"
import { useAuth } from "@/lib/auth-context"
import { UserAvatar } from "@/components/ui/user-avatar"
import { NotificationBell } from "@/components/layout/notification-bell"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const pageTitles: Record<string, { title: string; description: string }> = {
  "/dashboard": { title: "Dashboard", description: "Welcome back" },
  "/calendar": { title: "Content Calendar", description: "Plan and schedule your content" },
  "/compose": { title: "Compose", description: "Create a new post" },
  "/analytics": { title: "Analytics", description: "Track your performance" },
  "/insights": { title: "Insights", description: "AI recommendations for your accounts" },
  "/team": { title: "Team", description: "Manage your workspace" },
  "/settings": { title: "Settings", description: "Manage your account" },
  "/notifications": { title: "Notifications", description: "Your activity & publish history" },
  "/trends-lab": { title: "Trends Lab", description: "Stay ahead of trends" },
  "/brand-voice": { title: "Brand Voice", description: "Define your brand identity" },
  "/media-library": { title: "Media Library", description: "Manage your assets" },
  "/pricing": { title: "Pricing", description: "Choose your plan" },
  "/billing": { title: "Billing", description: "Manage your account" },
  "/workspace-settings": { title: "Workspace Settings", description: "Team management" },
}

export function Topbar({ pathname }: { pathname: string }) {
  const [dark, setDark] = useState(false)
  const { workspace } = useWorkspace()
  const { user, logout } = useAuth()
  const info = pageTitles[pathname] ?? { title: "Postly", description: "" }

  const toggleDark = () => {
    setDark(!dark)
    document.documentElement.classList.toggle("dark")
  }

  return (
    <header className="h-14 border-b border-border bg-surface-raised shrink-0 flex items-center gap-4 px-6">
      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-foreground leading-none">{info.title}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
      </div>

      {/* Search */}
      <div className="relative hidden md:flex items-center">
        <Search className="absolute left-3 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search posts, accounts..."
          className="pl-9 pr-3 py-1.5 text-sm bg-secondary border border-border rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-ring focus:w-72 transition-all placeholder:text-muted-foreground"
        />
      </div>

      {/* Quick compose */}
      <Button size="sm" className="gap-1.5 bg-brand hover:bg-brand/90 text-white shadow-sm hidden sm:flex" asChild>
        <Link href="/compose">
          <Plus className="w-3.5 h-3.5" />
          New Post
        </Link>
      </Button>

      {/* Dark mode */}
      <button
        onClick={toggleDark}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        aria-label="Toggle dark mode"
      >
        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Notifications */}
      <NotificationBell />

      {/* Settings */}
      <Link href="/workspace-settings" className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
        <Settings className="w-4 h-4" />
      </Link>

      {/* User avatar */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-ring">
            <UserAvatar
              src={user?.avatar}
              name={user?.name ?? user?.firstName}
              className="size-7"
              fallbackClassName="bg-gradient-to-br from-violet-500 to-blue-500 text-[10px]"
            />
            <div className="hidden md:block text-left">
              <p className="text-xs font-medium text-foreground leading-none">{workspace?.name || "Workspace"}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{workspace?.plan || "free"}</p>
            </div>
            <ChevronDown className="w-3 h-3 text-muted-foreground hidden md:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>
            <div className="flex items-center gap-2.5">
              <UserAvatar
                src={user?.avatar}
                name={user?.name ?? user?.firstName}
                className="size-9"
              />
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-medium leading-none truncate">{user?.name || "User"}</p>
                <p className="text-xs leading-none text-muted-foreground mt-1 truncate">{user?.email || "email@example.com"}</p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings" className="cursor-pointer w-full flex items-center">
              <User className="mr-2 h-4 w-4" />
              <span>Profile Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
