"use client"

import { useEffect, useState, useCallback } from "react"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts"
import {
  TrendingUp, TrendingDown, Heart, MessageCircle,
  Eye, ArrowUpRight, Instagram, Clock,
  MoreHorizontal, CheckCircle2, Users, BarChart3,
  Calendar, Loader2, AlertCircle, MousePointerClick,
  RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import { useWorkspace } from "@/lib/workspace-context"
import { FaTiktok, FaFacebookF, FaLinkedinIn } from "react-icons/fa"
import { RiTwitterXFill } from "react-icons/ri"

// ── Types ────────────────────────────────────────────────────────────────────

interface DashboardTotals {
  totalImpressions: number
  totalReach: number
  totalLikes: number
  totalComments: number
  totalShares: number
  totalSaves: number
  totalClicks: number
  totalEngagement: number
}

interface PlatformBreakdown {
  _id: string
  totalImpressions: number
  totalReach: number
  totalLikes: number
  totalComments: number
  totalShares: number
  totalSaves: number
  totalClicks: number
  avgEngagementRate: number
  dataPoints: number
}

interface EngagementPoint {
  _id: string
  impressions: number
  likes: number
  comments: number
  shares: number
  engagement: number
}

interface TopPost {
  postId: string
  platform: string
  title: string
  impressions: number
  likes: number
  comments: number
  shares: number
  engagement: number
  engagementRate: number
  publishedAt: string
}

interface ConnectedAccount {
  _id: string
  platform: string
  accountName: string
  accountUsername: string
  profilePictureUrl?: string
  followerCount: number
}

interface UpcomingPost {
  _id: string
  title?: string
  content: { text: string }
  platforms: string[]
  platformData: { platform: string; accountId: string; status: string }[]
  scheduledAt: string
  status: string
}

interface DashboardData {
  totals: DashboardTotals
  totalFollowers: number
  platformBreakdown: PlatformBreakdown[]
  engagementOverTime: EngagementPoint[]
  topPosts: TopPost[]
  connectedAccounts: ConnectedAccount[]
  upcomingPosts: UpcomingPost[]
  recentPublishedCount: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  INSTAGRAM: { label: "Instagram", icon: Instagram, color: "text-pink-500", bg: "bg-pink-500/10" },
  INSTAGRAM_STANDALONE: { label: "Instagram", icon: Instagram, color: "text-pink-500", bg: "bg-pink-500/10" },
  TWITTER: { label: "X (Twitter)", icon: RiTwitterXFill, color: "text-foreground", bg: "bg-foreground/10" },
  LINKEDIN: { label: "LinkedIn", icon: FaLinkedinIn, color: "text-blue-600", bg: "bg-blue-600/10" },
  FACEBOOK: { label: "Facebook", icon: FaFacebookF, color: "text-blue-500", bg: "bg-blue-500/10" },
  TIKTOK: { label: "TikTok", icon: FaTiktok, color: "text-foreground", bg: "bg-foreground/10" },
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatScheduleDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return `Today, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
  } else if (diffDays === 1) {
    return `Tomorrow, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  SCHEDULED: { label: "Scheduled", cls: "bg-success-soft text-success border-0" },
  DRAFT: { label: "Draft", cls: "bg-secondary text-muted-foreground border-0" },
  PUBLISHING: { label: "Publishing", cls: "bg-brand-soft text-brand border-0" },
}

const DAY_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
]

// ── Component ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { activeWorkspace } = useWorkspace()
  const workspaceId = activeWorkspace?.id ?? null

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)
  const [syncing, setSyncing] = useState(false)

  const fetchData = useCallback(async () => {
    if (!workspaceId) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await apiClient.get<DashboardData>(
        `/api/v1/analytics/dashboard?workspaceId=${workspaceId}&days=${days}`,
      )
      setData(result)
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }, [days, workspaceId])

  const syncAnalytics = useCallback(async () => {
    setSyncing(true)
    try {
      await apiClient.post("/api/v1/analytics/sync")
      await fetchData()
    } catch (err: any) {
      console.error("Sync failed", err)
    } finally {
      setSyncing(false)
    }
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
          <p className="text-sm text-muted-foreground">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <p className="text-sm text-foreground font-medium">Something went wrong</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button size="sm" onClick={fetchData} className="mt-2">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  const hasAnalytics = data && (
    data.totals.totalImpressions > 0 ||
    data.totals.totalEngagement > 0 ||
    data.platformBreakdown.length > 0
  )

  const chartData = (data?.engagementOverTime || []).map(p => ({
    date: formatDate(p._id),
    impressions: p.impressions,
    engagement: p.engagement,
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
  }))

  const statCards = [
    {
      label: "Total Impressions",
      value: formatNumber(data?.totals.totalImpressions || 0),
      icon: Eye,
      color: "bg-brand-soft text-brand",
    },
    {
      label: "Total Engagement",
      value: formatNumber(data?.totals.totalEngagement || 0),
      icon: Heart,
      color: "bg-pink-500/10 text-pink-500",
    },
    {
      label: "Total Followers",
      value: formatNumber(data?.totalFollowers || 0),
      icon: Users,
      color: "bg-success-soft text-success",
    },
    {
      label: "Posts Published",
      value: formatNumber(data?.recentPublishedCount || 0),
      icon: CheckCircle2,
      color: "bg-warning-soft text-warning",
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Aggregated overview across all platforms</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncAnalytics}
            disabled={syncing}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              syncing
                ? "bg-brand/10 text-brand border-brand/20 cursor-wait"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20"
            )}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync"}
          </button>
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
            {DAY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  days === opt.value
                    ? "bg-brand text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!hasAnalytics && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-foreground mb-1">No analytics data yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
            Click the Sync button above to fetch the latest metrics from your connected social accounts.
          </p>
          <button
            onClick={syncAnalytics}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-brand text-white hover:bg-brand/90 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync Analytics Now"}
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", card.color)}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      {hasAnalytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Engagement over time */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Engagement Over Time</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Impressions & engagement (all platforms)</p>
              </div>
            </div>
            {chartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dash-impressions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.52 0.22 264)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="oklch(0.52 0.22 264)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="dash-engagement" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.65 0.16 185)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="oklch(0.65 0.16 185)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.007 247)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.52 0.01 247)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.01 247)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
                      labelStyle={{ fontWeight: 600, color: "var(--color-foreground)" }}
                    />
                    <Area type="monotone" dataKey="impressions" stroke="oklch(0.52 0.22 264)" strokeWidth={2} fill="url(#dash-impressions)" name="Impressions" />
                    <Area type="monotone" dataKey="engagement" stroke="oklch(0.65 0.16 185)" strokeWidth={2} fill="url(#dash-engagement)" name="Engagement" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                    <span className="text-xs text-muted-foreground">Impressions</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-chart-2" />
                    <span className="text-xs text-muted-foreground">Engagement</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">
                No chart data available for this period
              </div>
            )}
          </div>

          {/* Engagement breakdown */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">Engagement Breakdown</h3>
            <div className="space-y-4">
              {[
                { label: "Likes", value: data?.totals.totalLikes || 0, icon: Heart, color: "text-pink-500" },
                { label: "Comments", value: data?.totals.totalComments || 0, icon: MessageCircle, color: "text-blue-500" },
                { label: "Shares", value: data?.totals.totalShares || 0, icon: TrendingUp, color: "text-green-500" },
                { label: "Clicks", value: data?.totals.totalClicks || 0, icon: MousePointerClick, color: "text-amber-500" },
              ].map(item => {
                const total = data?.totals.totalEngagement || 1
                const pct = total > 0 ? ((item.value / total) * 100) : 0
                return (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <item.icon className={cn("w-3.5 h-3.5", item.color)} />
                        <span className="text-xs text-foreground font-medium">{item.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-foreground">{formatNumber(item.value)}</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          background: item.color.includes("pink") ? "#ec4899"
                            : item.color.includes("blue") ? "#3b82f6"
                            : item.color.includes("green") ? "#22c55e"
                            : "#f59e0b"
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top posts / Upcoming posts */}
        <div className="lg:col-span-2 space-y-4">
          {/* Top posts */}
          {(data?.topPosts?.length ?? 0) > 0 && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Top Performing Posts</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Best content in the last {days} days</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Post</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Impressions</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Eng. Rate</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Likes</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Comments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data!.topPosts.map((post) => {
                      const pConfig = PLATFORM_CONFIG[post.platform] || PLATFORM_CONFIG.TWITTER
                      const PIcon = pConfig.icon
                      return (
                        <tr key={post.postId} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", pConfig.bg)}>
                                <PIcon className={cn("w-3.5 h-3.5", pConfig.color)} />
                              </div>
                              <span className="text-sm text-foreground font-medium truncate max-w-[220px]">
                                {post.title || "Untitled post"}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-semibold text-foreground">{formatNumber(post.impressions)}</td>
                          <td className="px-3 py-3 text-right">
                            <span className="text-xs font-semibold text-success bg-success-soft px-2 py-0.5 rounded-full">
                              {(post.engagementRate || 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-sm text-muted-foreground">{post.likes.toLocaleString()}</td>
                          <td className="px-3 py-3 text-right text-sm text-muted-foreground">{post.comments}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upcoming posts */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Upcoming Posts</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(data?.upcomingPosts?.length || 0)} posts scheduled
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-brand hover:text-brand/80 gap-1" asChild>
                <a href="/calendar">View Calendar <ArrowUpRight className="w-3 h-3" /></a>
              </Button>
            </div>
            {(data?.upcomingPosts?.length ?? 0) > 0 ? (
              <div className="divide-y divide-border">
                {data!.upcomingPosts.map((post) => {
                  const platform = post.platforms?.[0] || post.platformData?.[0]?.platform || "TWITTER"
                  const pConfig = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.TWITTER
                  const PIcon = pConfig.icon
                  const status = STATUS_CONFIG[post.status] || STATUS_CONFIG.DRAFT
                  return (
                    <div key={post._id} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/50 transition-colors">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", pConfig.bg)}>
                        <PIcon className={cn("w-4 h-4", pConfig.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {post.title || post.content?.text?.slice(0, 50) || "Untitled post"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{formatScheduleDate(post.scheduledAt)}</span>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px] shrink-0", status.cls)}>{status.label}</Badge>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Calendar className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No upcoming posts scheduled</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column — Platform breakdown */}
        <div className="space-y-4">
          {/* Connected platforms */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-3">Platforms</h3>
            {(data?.connectedAccounts?.length ?? 0) > 0 ? (
              <div className="space-y-3">
                {data!.connectedAccounts.map((acc) => {
                  const pConfig = PLATFORM_CONFIG[acc.platform] || PLATFORM_CONFIG.TWITTER
                  const PIcon = pConfig.icon
                  return (
                    <div key={acc._id} className="flex items-center gap-3">
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", pConfig.bg)}>
                        <PIcon className={cn("w-3.5 h-3.5", pConfig.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{acc.accountName || pConfig.label}</p>
                        <p className="text-xs text-muted-foreground">@{acc.accountUsername}</p>
                      </div>
                      <span className="text-xs font-semibold text-foreground">
                        {formatNumber(acc.followerCount || 0)}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">No platforms connected yet</p>
                <Button variant="ghost" size="sm" className="text-xs text-brand mt-2" asChild>
                  <a href="/settings">Connect Account <ArrowUpRight className="w-3 h-3 ml-1" /></a>
                </Button>
              </div>
            )}
          </div>

          {/* Per-platform metrics */}
          {(data?.platformBreakdown?.length ?? 0) > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-3">Platform Metrics</h3>
              <div className="space-y-3">
                {data!.platformBreakdown.map((pb) => {
                  const pConfig = PLATFORM_CONFIG[pb._id] || PLATFORM_CONFIG.TWITTER
                  const PIcon = pConfig.icon
                  const engagement = (pb.totalLikes || 0) + (pb.totalComments || 0) + (pb.totalShares || 0)
                  return (
                    <div key={pb._id} className="p-3 bg-secondary/50 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <PIcon className={cn("w-3.5 h-3.5", pConfig.color)} />
                        <span className="text-xs font-medium text-foreground">{pConfig.label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Impressions</p>
                          <p className="text-xs font-semibold text-foreground">{formatNumber(pb.totalImpressions)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Engagement</p>
                          <p className="text-xs font-semibold text-foreground">{formatNumber(engagement)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Eng. Rate</p>
                          <p className="text-xs font-semibold text-foreground">{(pb.avgEngagementRate || 0).toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Reach</p>
                          <p className="text-xs font-semibold text-foreground">{formatNumber(pb.totalReach)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
