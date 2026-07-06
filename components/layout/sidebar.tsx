"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import {
  LayoutDashboard,
  CalendarDays,
  PenSquare,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Instagram,
  Twitter,
  Linkedin,
  Facebook,
  Hash,
  Bell,
  Plus,
  Sparkles,
  TrendingUp,
  Palette,
  Library,
  CreditCard,
  Crown,
  Layers,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher"
import { useWorkspace } from "@/lib/workspace-context"
import { Capability } from "@/lib/permissions"

type NavSection = { section: string }
type NavLink = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  highlight?: boolean
  isAI?: boolean
  /** If set, the link is shown only when the active role has this capability. */
  requires?: Capability
}
type NavItem = NavSection | NavLink

const navItems: NavItem[] = [
  { section: "CORE" },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/compose", label: "Compose", icon: PenSquare, highlight: true, requires: "posts:create" },

  { section: "AI TOOLS" },
  { href: "/trends-lab", label: "Trends Lab", icon: TrendingUp, isAI: true },
  { href: "/brand-voice", label: "Brand Voice", icon: Palette, isAI: true, requires: "posts:create" },
  { href: "/media-library", label: "Media Library", icon: Library, isAI: true, requires: "posts:create" },

  { section: "INSIGHTS" },
  { href: "/insights", label: "Insights", icon: Sparkles, isAI: true, requires: "analytics:view" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, requires: "analytics:view" },

  { section: "MANAGE" },
  { href: "/team", label: "Team", icon: Users },
  { href: "/workspaces", label: "Workspaces", icon: Layers },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/pricing", label: "Pricing", icon: Crown },
  { href: "/billing", label: "Billing", icon: CreditCard, requires: "workspace:manage_billing" },
]

const SUPPORTED_PLATFORMS = [
  { id: "INSTAGRAM", icon: Instagram, color: "text-pink-400" },
  { id: "TWITTER", icon: Twitter, color: "text-sky-400" },
  { id: "LINKEDIN", icon: Linkedin, color: "text-blue-400" },
  { id: "FACEBOOK", icon: Facebook, color: "text-indigo-400" },
  { id: "TIKTOK", icon: ({ className }: { className?: string }) => <span className={cn("text-xs font-bold", className)}>TK</span>, color: "text-sidebar-foreground" },
]

const getPlatformConfig = (platform: string) => {
  const normalized = platform === "INSTAGRAM_STANDALONE" ? "INSTAGRAM" : platform;
  return SUPPORTED_PLATFORMS.find(p => p.id === normalized) || SUPPORTED_PLATFORMS[0]
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { activeWorkspace, can } = useWorkspace()
  const [accounts, setAccounts] = useState<any[]>([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)

  // Drop links the current role doesn't satisfy. Section headers are filtered
  // out if every link beneath them was hidden, to avoid orphaned headers.
  const visibleItems: NavItem[] = (() => {
    const filtered = navItems.filter((item) => {
      if ("section" in item) return true
      return !item.requires || can(item.requires)
    })
    return filtered.filter((item, idx) => {
      if (!("section" in item)) return true
      const next = filtered[idx + 1]
      return !!next && !("section" in next)
    })
  })()

  useEffect(() => {
    if (!activeWorkspace) {
      setAccounts([])
      setIsLoadingAccounts(false)
      return
    }
    const fetchAccounts = async () => {
      setIsLoadingAccounts(true)
      try {
        const data = await apiClient.get<any[]>(`/api/v1/accounts?workspaceId=${activeWorkspace.id}`)
        setAccounts(data || [])
      } catch (error) {
        console.error("Failed to fetch accounts:", error)
        setAccounts([])
      } finally {
        setIsLoadingAccounts(false)
      }
    }
    fetchAccounts()
  }, [activeWorkspace?.id])

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-sidebar-border shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand shrink-0">
          <Zap className="w-4 h-4 text-white" fill="white" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-sidebar-foreground text-sm tracking-tight">
            Postly
          </span>
        )}
      </div>

      {/* Workspace switcher */}
      <div className={cn(
        "border-b border-sidebar-border",
        collapsed ? "px-2 py-2" : "px-3 py-2"
      )}>
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {visibleItems.map((item, idx) => {
          if ("section" in item) {
            return (
              <div key={`section-${idx}`}>
                {idx > 0 && !collapsed && <div className="py-1" />}
                {!collapsed && (
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-3 py-1">
                    {item.section}
                  </p>
                )}
              </div>
            )
          }

          const { href, label, icon: Icon, highlight, isAI } = item
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                highlight && !active && "text-brand-muted",
                isAI && !active && "text-brand/60"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
              {!collapsed && (highlight || isAI) && (
                <Badge className="ml-auto text-[10px] px-1.5 py-0 bg-brand/20 text-brand-muted border-0 font-medium">
                  {highlight ? "New" : "AI"}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Connected accounts */}
      {!collapsed && (
        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Accounts
            </span>
            <Link href="/settings" className="text-muted-foreground hover:text-sidebar-foreground transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-0.5 min-h-[50px]">
            {isLoadingAccounts ? (
               <div className="flex items-center justify-center py-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
               </div>
            ) : accounts.length === 0 ? (
               <div className="text-xs text-sidebar-foreground/50 px-2 py-1">No accounts</div>
            ) : (
               accounts.map((acct) => {
                 const config = getPlatformConfig(acct.platform)
                 const Icon = config.icon
                 return (
                  <div
                    key={acct._id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors cursor-pointer"
                  >
                    <Icon className={cn("w-3.5 h-3.5 shrink-0", config.color)} />
                    <span className="text-xs text-sidebar-foreground/70 truncate">{acct.accountUsername ? `@${acct.accountUsername}` : (acct.accountName || acct.platformAccountId)}</span>
                  </div>
                 )
               })
            )}
          </div>
        </div>
      )}

      {/* Collapsed bottom icons */}
      {collapsed && (
        <div className="px-2 py-3 border-t border-sidebar-border">
          <button className="flex items-center justify-center w-10 h-10 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
            <Bell className="w-4 h-4" />
          </button>
          <button className="flex items-center justify-center w-10 h-10 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
            <Hash className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground shadow-sm transition-colors z-10"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  )
}
