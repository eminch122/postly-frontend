"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts"
import {
  TrendingUp, Eye, Heart, MessageCircle,
  Users, Download, Instagram, ArrowUpRight,
  Sparkles, BarChart3, RefreshCw, AlertCircle, Loader2,
  Layers,
} from "lucide-react"
import { FaTiktok, FaFacebookF, FaLinkedinIn } from "react-icons/fa"
import { RiTwitterXFill } from "react-icons/ri"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import { useWorkspace } from "@/lib/workspace-context"

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
  title?: string
  impressions: number
  likes: number
  comments: number
  shares: number
  engagement: number
  engagementRate: number
  publishedAt?: string
}

interface ConnectedAccount {
  _id: string
  platform: string
  accountName: string
  accountUsername: string
  profilePictureUrl?: string
  followerCount: number
}

interface DashboardData {
  totals: DashboardTotals
  totalFollowers: number
  platformBreakdown: PlatformBreakdown[]
  engagementOverTime: EngagementPoint[]
  topPosts: TopPost[]
  connectedAccounts: ConnectedAccount[]
  recentPublishedCount: number
}

// ── Platform metadata ────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, {
  label: string
  icon: React.ElementType
  color: string
  bg: string
  hex: string
}> = {
  INSTAGRAM: { label: "Instagram", icon: Instagram, color: "text-pink-500", bg: "bg-pink-500/10", hex: "#ec4899" },
  INSTAGRAM_STANDALONE: { label: "Instagram", icon: Instagram, color: "text-pink-500", bg: "bg-pink-500/10", hex: "#ec4899" },
  TWITTER: { label: "X (Twitter)", icon: RiTwitterXFill, color: "text-foreground", bg: "bg-foreground/10", hex: "#0ea5e9" },
  LINKEDIN: { label: "LinkedIn", icon: FaLinkedinIn, color: "text-blue-600", bg: "bg-blue-600/10", hex: "#3b82f6" },
  FACEBOOK: { label: "Facebook", icon: FaFacebookF, color: "text-blue-500", bg: "bg-blue-500/10", hex: "#6366f1" },
  TIKTOK: { label: "TikTok", icon: FaTiktok, color: "text-foreground", bg: "bg-foreground/10", hex: "#0f172a" },
}

const FALLBACK_PLATFORM = PLATFORM_CONFIG.TWITTER

function platformOf(key: string) {
  return PLATFORM_CONFIG[key] ?? FALLBACK_PLATFORM
}

// ── Formatters ───────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ── Constants ────────────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
]

const ALL_ACCOUNTS = "__ALL__"

// ── Component ────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const { activeWorkspace } = useWorkspace()
  const workspaceId = activeWorkspace?.id ?? null

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)
  const [selectedAccountId, setSelectedAccountId] = useState<string>(ALL_ACCOUNTS)
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
      const params = new URLSearchParams({
        workspaceId,
        days: String(days),
      })
      if (selectedAccountId !== ALL_ACCOUNTS) {
        params.set("accountId", selectedAccountId)
      }
      const result = await apiClient.get<DashboardData>(
        `/api/v1/analytics/dashboard?${params.toString()}`,
      )
      setData(result)
    } catch (err: any) {
      setError(err?.message || "Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }, [workspaceId, days, selectedAccountId])

  const syncAnalytics = useCallback(async () => {
    setSyncing(true)
    try {
      await apiClient.post("/api/v1/analytics/sync")
      await fetchData()
    } catch (err) {
      console.error("Sync failed", err)
    } finally {
      setSyncing(false)
    }
  }, [fetchData])

  const exportCsv = useCallback(async () => {
    if (!workspaceId) return
    try {
      const token = (await import("@/lib/api-client")).getAccessToken()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/analytics/export?workspaceId=${workspaceId}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      )
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Export failed", err)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Derived data ──────────────────────────────────────────────────────────

  const selectedAccount = useMemo(() => {
    if (selectedAccountId === ALL_ACCOUNTS || !data) return null
    return data.connectedAccounts.find((a) => a._id === selectedAccountId) ?? null
  }, [selectedAccountId, data])

  const isFiltered = selectedAccountId !== ALL_ACCOUNTS

  const totals = data?.totals
  const engagementRateAgg = useMemo(() => {
    if (!data?.platformBreakdown.length) return 0
    const valid = data.platformBreakdown.filter((p) => p.avgEngagementRate > 0)
    if (!valid.length) return 0
    return valid.reduce((sum, p) => sum + p.avgEngagementRate, 0) / valid.length
  }, [data])

  const chartData = useMemo(() => {
    return (data?.engagementOverTime ?? []).map((p) => ({
      date: formatDate(p._id),
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      engagement: p.engagement,
      impressions: p.impressions,
    }))
  }, [data])

  const platformShare = useMemo(() => {
    const total = (data?.platformBreakdown ?? []).reduce(
      (sum, p) => sum + (p.totalImpressions || 0),
      0,
    )
    if (total === 0) return []
    return (data?.platformBreakdown ?? []).map((p) => ({
      name: platformOf(p._id).label,
      value: Math.round((p.totalImpressions / total) * 100),
      color: platformOf(p._id).hex,
      raw: p.totalImpressions,
    }))
  }, [data])

  const audienceData = useMemo(() => {
    // Per-platform totals as a single grouped bar (for current period)
    if (!data?.platformBreakdown.length) return []
    const row: Record<string, number | string> = { label: "Followers" }
    for (const acct of data.connectedAccounts) {
      const key = platformOf(acct.platform).label
      row[key] = (typeof row[key] === "number" ? (row[key] as number) : 0) + (acct.followerCount || 0)
    }
    return [row]
  }, [data])

  const audienceKeys = useMemo(() => {
    if (!data?.connectedAccounts.length) return []
    const seen = new Set<string>()
    return data.connectedAccounts
      .map((a) => platformOf(a.platform))
      .filter((p) => {
        if (seen.has(p.label)) return false
        seen.add(p.label)
        return true
      })
  }, [data])

  const hasAnalytics = !!(
    data &&
    (data.totals.totalImpressions > 0 ||
      data.totals.totalEngagement > 0 ||
      data.platformBreakdown.length > 0)
  )

  // ── Render ────────────────────────────────────────────────────────────────

  if (!workspaceId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-sm text-foreground font-medium">Select a workspace to view analytics</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
          <p className="text-sm text-muted-foreground">Loading analytics…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <p className="text-sm text-foreground font-medium">Couldn’t load analytics</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button size="sm" onClick={fetchData} className="mt-2">Try again</Button>
        </div>
      </div>
    )
  }

  const metricCards = [
    {
      label: "Total Impressions",
      value: formatNumber(totals?.totalImpressions || 0),
      icon: Eye,
      color: "bg-brand-soft text-brand",
    },
    {
      label: "Total Engagement",
      value: formatNumber(totals?.totalEngagement || 0),
      icon: Heart,
      color: "bg-pink-500/10 text-pink-500",
    },
    {
      label: isFiltered ? "Followers" : "Total Followers",
      value: formatNumber(data?.totalFollowers || 0),
      icon: Users,
      color: "bg-success-soft text-success",
    },
    {
      label: "Avg. Engagement Rate",
      value: `${engagementRateAgg.toFixed(2)}%`,
      icon: TrendingUp,
      color: "bg-warning-soft text-warning",
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">Analytics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isFiltered && selectedAccount
              ? `Metrics for @${selectedAccount.accountUsername}`
              : "Aggregated metrics across all connected accounts"}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  days === opt.value
                    ? "bg-brand text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={syncAnalytics}
            disabled={syncing}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              syncing
                ? "bg-brand/10 text-brand border-brand/20 cursor-wait"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20",
            )}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync"}
          </button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Account tabs */}
      {(data?.connectedAccounts.length ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <AccountTab
            active={selectedAccountId === ALL_ACCOUNTS}
            onClick={() => setSelectedAccountId(ALL_ACCOUNTS)}
            label="All accounts"
            sublabel={`${data!.connectedAccounts.length} connected`}
            iconNode={
              <div className="w-7 h-7 rounded-full bg-brand-soft text-brand flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </div>
            }
          />
          {data!.connectedAccounts.map((acc) => {
            const cfg = platformOf(acc.platform)
            const Icon = cfg.icon
            return (
              <AccountTab
                key={acc._id}
                active={selectedAccountId === acc._id}
                onClick={() => setSelectedAccountId(acc._id)}
                label={acc.accountName || cfg.label}
                sublabel={acc.accountUsername ? `@${acc.accountUsername}` : cfg.label}
                iconNode={
                  acc.profilePictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={acc.profilePictureUrl}
                      alt={acc.accountName}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center", cfg.bg)}>
                      <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                    </div>
                  )
                }
              />
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!hasAnalytics && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {isFiltered ? "No data for this account yet" : "No analytics data yet"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
            {isFiltered
              ? "Either this account hasn’t been synced, or its metrics fall outside the selected period."
              : "Click Sync above to fetch the latest metrics from your connected accounts."}
          </p>
          <button
            onClick={syncAnalytics}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-brand text-white hover:bg-brand/90 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((m) => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", m.color)}>
                <m.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight">{m.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {hasAnalytics && (
        <>
          {/* Charts row 1: Engagement trend + Platform share */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Engagement Trend</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Likes, comments and shares over time
                  </p>
                </div>
              </div>
              {chartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        {[
                          { id: "likes", color: "oklch(0.52 0.22 264)" },
                          { id: "comments", color: "oklch(0.65 0.16 185)" },
                          { id: "shares", color: "oklch(0.72 0.19 45)" },
                        ].map((g) => (
                          <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={g.color} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={g.color} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.007 247)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.52 0.01 247)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "oklch(0.52 0.01 247)" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }} />
                      <Area type="monotone" dataKey="likes" stroke="oklch(0.52 0.22 264)" strokeWidth={2} fill="url(#likes)" name="Likes" />
                      <Area type="monotone" dataKey="comments" stroke="oklch(0.65 0.16 185)" strokeWidth={2} fill="url(#comments)" name="Comments" />
                      <Area type="monotone" dataKey="shares" stroke="oklch(0.72 0.19 45)" strokeWidth={2} fill="url(#shares)" name="Shares" />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2">
                    {[
                      { label: "Likes", color: "bg-brand" },
                      { label: "Comments", color: "bg-chart-2" },
                      { label: "Shares", color: "bg-chart-3" },
                    ].map((l) => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", l.color)} />
                        <span className="text-xs text-muted-foreground">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">
                  No data points in this range
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {isFiltered ? "Engagement Mix" : "Platform Distribution"}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                {isFiltered ? "Likes / comments / shares" : "Share of total impressions"}
              </p>

              {isFiltered ? (
                <EngagementMixDonut totals={totals} />
              ) : platformShare.length > 0 ? (
                <>
                  <div className="flex justify-center">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={platformShare}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {platformShare.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
                          formatter={(value: number, _: string, props: any) =>
                            [`${value}% (${formatNumber(props.payload.raw)})`, props.payload.name]
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-1">
                    {platformShare.map((p) => (
                      <div key={p.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                        <span className="text-xs text-muted-foreground flex-1">{p.name}</span>
                        <span className="text-xs font-semibold text-foreground">{p.value}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
                  No impressions yet
                </div>
              )}
            </div>
          </div>

          {/* Charts row 2: Audience + Per-platform metrics */}
          {!isFiltered ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-1">Followers by Platform</h3>
                <p className="text-xs text-muted-foreground mb-4">Current audience size per connected account</p>
                {audienceData.length > 0 && audienceKeys.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={audienceData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.007 247)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "oklch(0.52 0.01 247)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "oklch(0.52 0.01 247)" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatNumber(v as number)} />
                      <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }} />
                      {audienceKeys.map((k) => (
                        <Bar key={k.label} dataKey={k.label} fill={k.hex} radius={[2, 2, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">
                    Connect an account to see followers
                  </div>
                )}
              </div>

              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-1">Per-Platform Metrics</h3>
                <p className="text-xs text-muted-foreground mb-4">Headline numbers for the last {days} days</p>
                <PlatformMetricsList items={data!.platformBreakdown} />
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-1">Account Snapshot</h3>
              <p className="text-xs text-muted-foreground mb-4">
                {selectedAccount?.accountName} — last {days} days
              </p>
              <AccountSnapshot totals={totals} engagementRate={engagementRateAgg} />
            </div>
          )}

          {/* Top posts */}
          {data!.topPosts.length > 0 && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Top Performing Posts</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Best content from the last {days} days{isFiltered ? " for this account" : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-xs text-brand gap-1" asChild>
                  <a href="/posts">View All <ArrowUpRight className="w-3 h-3" /></a>
                </Button>
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
                      const cfg = platformOf(post.platform)
                      const Icon = cfg.icon
                      return (
                        <tr key={post.postId} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", cfg.bg)}>
                                <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                              </div>
                              <span className="text-sm text-foreground font-medium truncate max-w-[260px]">
                                {post.title || "Untitled post"}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-semibold text-foreground">
                            {formatNumber(post.impressions)}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="text-xs font-semibold text-success bg-success-soft px-2 py-0.5 rounded-full">
                              {(post.engagementRate || 0).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-sm text-muted-foreground">
                            {post.likes.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right text-sm text-muted-foreground">
                            {post.comments}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function AccountTab({
  active,
  onClick,
  label,
  sublabel,
  iconNode,
}: {
  active: boolean
  onClick: () => void
  label: string
  sublabel: string
  iconNode: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all shrink-0 min-w-[180px]",
        active
          ? "bg-brand-soft border-brand/30 shadow-sm"
          : "bg-card border-border hover:border-foreground/20 hover:bg-secondary/50",
      )}
    >
      <span className="shrink-0">{iconNode}</span>
      <span className="flex-1 min-w-0 text-left">
        <span className={cn("block text-xs font-semibold truncate", active ? "text-brand" : "text-foreground")}>
          {label}
        </span>
        <span className="block text-[10px] text-muted-foreground truncate">{sublabel}</span>
      </span>
    </button>
  )
}

function EngagementMixDonut({ totals }: { totals?: DashboardTotals }) {
  const data = useMemo(() => {
    if (!totals) return []
    const items = [
      { name: "Likes", value: totals.totalLikes, color: "#ec4899" },
      { name: "Comments", value: totals.totalComments, color: "#3b82f6" },
      { name: "Shares", value: totals.totalShares, color: "#22c55e" },
      { name: "Saves", value: totals.totalSaves, color: "#f59e0b" },
    ].filter((d) => d.value > 0)
    return items
  }, [totals])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
        No engagement yet
      </div>
    )
  }

  const sum = data.reduce((s, d) => s + d.value, 0)

  return (
    <>
      <div className="flex justify-center">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
              formatter={(value: number) => formatNumber(value)}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2 mt-1">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
            <span className="text-xs font-semibold text-foreground">
              {Math.round((d.value / sum) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

function PlatformMetricsList({ items }: { items: PlatformBreakdown[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">
        No platform data yet
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {items.map((pb) => {
        const cfg = platformOf(pb._id)
        const Icon = cfg.icon
        const engagement = (pb.totalLikes || 0) + (pb.totalComments || 0) + (pb.totalShares || 0)
        return (
          <div key={pb._id} className="p-3 bg-secondary/40 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
              <span className="text-xs font-medium text-foreground">{cfg.label}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Impressions" value={formatNumber(pb.totalImpressions)} />
              <Stat label="Engagement" value={formatNumber(engagement)} />
              <Stat label="Eng. Rate" value={`${(pb.avgEngagementRate || 0).toFixed(2)}%`} />
              <Stat label="Reach" value={formatNumber(pb.totalReach)} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AccountSnapshot({
  totals,
  engagementRate,
}: {
  totals?: DashboardTotals
  engagementRate: number
}) {
  if (!totals) return null
  const items = [
    { label: "Impressions", value: totals.totalImpressions, icon: Eye },
    { label: "Reach", value: totals.totalReach, icon: Users },
    { label: "Likes", value: totals.totalLikes, icon: Heart },
    { label: "Comments", value: totals.totalComments, icon: MessageCircle },
    { label: "Shares", value: totals.totalShares, icon: TrendingUp },
    { label: "Saves", value: totals.totalSaves, icon: Sparkles },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {items.map((it) => (
        <div key={it.label} className="p-3 bg-secondary/40 rounded-lg">
          <div className="flex items-center gap-2 mb-1.5">
            <it.icon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
              {it.label}
            </span>
          </div>
          <p className="text-base font-semibold text-foreground">{formatNumber(it.value)}</p>
        </div>
      ))}
      <div className="p-3 bg-brand-soft rounded-lg">
        <div className="flex items-center gap-2 mb-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-brand" />
          <span className="text-[10px] text-brand font-medium uppercase tracking-wide">
            Avg. Engagement Rate
          </span>
        </div>
        <p className="text-base font-semibold text-brand">{engagementRate.toFixed(2)}%</p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold text-foreground">{value}</p>
    </div>
  )
}
