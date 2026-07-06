"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
    TrendingUp, RefreshCw, Loader2, AlertCircle, Hash, Clock,
    BarChart3, Layers, Sparkles, Copy, Check, Calendar,
    Image as ImageIcon, Video, FileText,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import { useWorkspace } from "@/lib/workspace-context"
import { AccountSwitcher, SwitchableAccount } from "@/components/account-switcher"
import { UpgradePrompt } from "@/components/upgrade-prompt"

const SUPPORTED_PLATFORMS = ["INSTAGRAM"]
const ALL_ACCOUNTS = "__ALL__"
const DAYS = 90

// ── Types ─────────────────────────────────────────────────────────────────────

type PostFormat = "REEL" | "CAROUSEL" | "IMAGE" | "TEXT"

interface FormatStat {
    format: PostFormat
    postCount: number
    totalImpressions: number
    totalReach: number
    totalEngagement: number
    avgEngagementRate: number
    avgImpressionsPerPost: number
}

interface FormatBreakdown {
    days: number
    formats: FormatStat[]
    hasData: boolean
}

interface TrendingHashtag {
    tag: string
    rationale: string
    relevance: "high" | "medium" | "low"
}

interface HashtagRadar {
    accountHandle: string
    platform: string
    generatedAt: string
    hashtags: TrendingHashtag[]
    pulse: string
}

interface TimingResult {
    best_times: string[]
    explanation: string
}

// ── Format metadata ──────────────────────────────────────────────────────────

const FORMAT_META: Record<PostFormat, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    REEL: { label: "Reels / Video", icon: Video, color: "text-blue-500", bg: "bg-blue-500/10" },
    CAROUSEL: { label: "Carousels", icon: Layers, color: "text-pink-500", bg: "bg-pink-500/10" },
    IMAGE: { label: "Single image", icon: ImageIcon, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    TEXT: { label: "Text only", icon: FileText, color: "text-muted-foreground", bg: "bg-secondary" },
}

const RELEVANCE_STYLES: Record<TrendingHashtag["relevance"], { badge: string; dot: string }> = {
    high: { badge: "bg-destructive/10 text-destructive border-destructive/20", dot: "bg-destructive" },
    medium: { badge: "bg-warning-soft text-warning border-warning/20", dot: "bg-warning" },
    low: { badge: "bg-brand-soft text-brand border-brand/20", dot: "bg-brand" },
}

function formatNumber(n: number): string {
    if (!Number.isFinite(n)) return "0"
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString()
}

function formatIsoToReadable(iso: string): string {
    try {
        const d = new Date(iso)
        return d.toLocaleString("en-US", {
            weekday: "long",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        })
    } catch {
        return iso
    }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function TrendsLabPage() {
    const { activeWorkspace, hasFeature } = useWorkspace()
    const workspaceId = activeWorkspace?.id ?? null
    const aiUnlocked = hasFeature('ai:tools')

    const [accounts, setAccounts] = useState<SwitchableAccount[]>([])
    const [accountsLoading, setAccountsLoading] = useState(true)
    const [selectedAccountId, setSelectedAccountId] = useState<string>(ALL_ACCOUNTS)

    const [formats, setFormats] = useState<FormatBreakdown | null>(null)
    const [formatsLoading, setFormatsLoading] = useState(false)
    const [formatsError, setFormatsError] = useState<string | null>(null)

    const [hashtags, setHashtags] = useState<HashtagRadar | null>(null)
    const [hashtagsLoading, setHashtagsLoading] = useState(false)
    const [hashtagsError, setHashtagsError] = useState<string | null>(null)

    const [timing, setTiming] = useState<TimingResult | null>(null)
    const [timingLoading, setTimingLoading] = useState(false)
    const [timingError, setTimingError] = useState<string | null>(null)

    const isAllAccounts = selectedAccountId === ALL_ACCOUNTS

    // ── Fetch IG accounts ─────────────────────────────────────────────────
    useEffect(() => {
        if (!workspaceId) {
            setAccounts([])
            setAccountsLoading(false)
            return
        }
        let cancelled = false
        ;(async () => {
            setAccountsLoading(true)
            try {
                const all = await apiClient.get<SwitchableAccount[]>(
                    `/api/v1/accounts?workspaceId=${workspaceId}`,
                )
                if (cancelled) return
                const igOnly = (all ?? []).filter((a) =>
                    SUPPORTED_PLATFORMS.includes((a.platform || "").replace("_STANDALONE", "")),
                )
                setAccounts(igOnly)
            } catch (err) {
                console.error("Failed to load accounts", err)
            } finally {
                if (!cancelled) setAccountsLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [workspaceId])

    // ── Format breakdown ──────────────────────────────────────────────────
    const loadFormats = useCallback(async () => {
        if (!workspaceId) return
        setFormatsLoading(true)
        setFormatsError(null)
        try {
            const params = new URLSearchParams({ workspaceId, days: String(DAYS) })
            if (!isAllAccounts) params.set("accountId", selectedAccountId)
            const result = await apiClient.get<FormatBreakdown>(
                `/api/v1/ai/trends/formats?${params.toString()}`,
            )
            setFormats(result)
        } catch (err: any) {
            setFormatsError(err?.message || "Failed to load formats")
        } finally {
            setFormatsLoading(false)
        }
    }, [workspaceId, selectedAccountId, isAllAccounts])

    // ── Hashtag radar (per account only) ──────────────────────────────────
    const loadHashtags = useCallback(
        async (refresh = false) => {
            if (!workspaceId || isAllAccounts) {
                setHashtags(null)
                return
            }
            setHashtagsLoading(true)
            setHashtagsError(null)
            try {
                const params = new URLSearchParams({ workspaceId, accountId: selectedAccountId })
                if (refresh) params.set("refresh", "true")
                const result = await apiClient.get<HashtagRadar>(
                    `/api/v1/ai/trends/hashtags?${params.toString()}`,
                )
                setHashtags(result)
            } catch (err: any) {
                setHashtagsError(err?.message || "Failed to load hashtags")
            } finally {
                setHashtagsLoading(false)
            }
        },
        [workspaceId, selectedAccountId, isAllAccounts],
    )

    // ── Best posting times (per account only) ─────────────────────────────
    const loadTiming = useCallback(async () => {
        if (!workspaceId || isAllAccounts) {
            setTiming(null)
            return
        }
        setTimingLoading(true)
        setTimingError(null)
        try {
            const tz =
                typeof Intl !== "undefined"
                    ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
                    : "UTC"
            const result = await apiClient.post<TimingResult>(`/api/v1/ai/optimize/timing`, {
                workspaceId,
                account_id: selectedAccountId,
                platform: "INSTAGRAM",
                timezone: tz,
            })
            setTiming(result)
        } catch (err: any) {
            setTimingError(err?.message || "Failed to load posting times")
        } finally {
            setTimingLoading(false)
        }
    }, [workspaceId, selectedAccountId, isAllAccounts])

    useEffect(() => {
        loadFormats()
    }, [loadFormats])
    useEffect(() => {
        loadHashtags()
    }, [loadHashtags])
    useEffect(() => {
        loadTiming()
    }, [loadTiming])

    const refreshAll = useCallback(() => {
        loadFormats()
        loadHashtags(true)
        loadTiming()
    }, [loadFormats, loadHashtags, loadTiming])

    const selectedAccount = useMemo(
        () => accounts.find((a) => a._id === selectedAccountId) ?? null,
        [accounts, selectedAccountId],
    )

    // ── Render guards ─────────────────────────────────────────────────────
    if (!workspaceId) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <TrendingUp className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="text-sm text-foreground font-medium">
                        Select a workspace to explore trends
                    </p>
                </div>
            </div>
        )
    }

    if (!aiUnlocked) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <UpgradePrompt
                    title="Trends Lab is a Pro feature"
                    description="Format performance breakdowns, AI hashtag radar, and best-time-to-post live on the Pro and Enterprise plans."
                />
            </div>
        )
    }

    if (accountsLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-brand animate-spin" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3">
                <div>
                    <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-brand" />
                        Trends Lab
                        <Badge className="text-[10px] bg-brand-soft text-brand border-0">AI</Badge>
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Format performance from your own posts, niche-aware hashtag radar, and best posting windows.
                    </p>
                </div>
                <div className="ml-auto">
                    <button
                        onClick={refreshAll}
                        disabled={formatsLoading || hashtagsLoading || timingLoading}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                            "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20",
                            (formatsLoading || hashtagsLoading || timingLoading) && "opacity-60 cursor-wait",
                        )}
                    >
                        <RefreshCw
                            className={cn(
                                "w-3.5 h-3.5",
                                (formatsLoading || hashtagsLoading || timingLoading) && "animate-spin",
                            )}
                        />
                        Regenerate
                    </button>
                </div>
            </div>

            {/* Account switcher */}
            {accounts.length > 0 ? (
                <AccountSwitcher
                    accounts={accounts}
                    selectedAccountId={selectedAccountId}
                    onSelect={setSelectedAccountId}
                    onSelectAll={() => setSelectedAccountId(ALL_ACCOUNTS)}
                    platforms={SUPPORTED_PLATFORMS}
                    includeAll={true}
                    allValue={ALL_ACCOUNTS}
                />
            ) : (
                <div className="bg-card border border-border rounded-xl p-6 text-center text-xs text-muted-foreground">
                    No Instagram accounts connected. Format breakdown still works on workspace-wide posts; connect an
                    account to unlock the hashtag radar and timing recommendations.
                </div>
            )}

            {/* Section 1: format breakdown */}
            <FormatSection
                breakdown={formats}
                loading={formatsLoading}
                error={formatsError}
                days={DAYS}
                onRetry={loadFormats}
            />

            {/* Section 2 + 3 grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <HashtagSection
                        radar={hashtags}
                        loading={hashtagsLoading}
                        error={hashtagsError}
                        disabled={isAllAccounts}
                        accountHandle={selectedAccount?.accountUsername ?? null}
                        onRefresh={() => loadHashtags(true)}
                    />
                </div>
                <div>
                    <TimingSection
                        timing={timing}
                        loading={timingLoading}
                        error={timingError}
                        disabled={isAllAccounts}
                        onRetry={loadTiming}
                    />
                </div>
            </div>
        </div>
    )
}

// ── Sections ──────────────────────────────────────────────────────────────────

function FormatSection({
    breakdown,
    loading,
    error,
    days,
    onRetry,
}: {
    breakdown: FormatBreakdown | null
    loading: boolean
    error: string | null
    days: number
    onRetry: () => void
}) {
    // When IG doesn't return per-post impressions (common for older media),
    // every format ends up with avgEngagementRate=0. Detect that and fall
    // back to engagement-per-post so the bars stay meaningful.
    const useRate = useMemo(
        () => breakdown?.formats.some((f) => (f.avgEngagementRate || 0) > 0) ?? false,
        [breakdown],
    )
    const engPerPost = useCallback(
        (f: FormatStat) => (f.postCount > 0 ? f.totalEngagement / f.postCount : 0),
        [],
    )
    const maxEng = useMemo(() => {
        if (!breakdown) return 0
        const values = useRate
            ? breakdown.formats.map((f) => f.avgEngagementRate || 0)
            : breakdown.formats.map(engPerPost)
        return Math.max(...values, 0.0001)
    }, [breakdown, useRate, engPerPost])
    const maxPosts = useMemo(
        () =>
            breakdown
                ? Math.max(...breakdown.formats.map((f) => f.postCount || 0), 1)
                : 1,
        [breakdown],
    )

    return (
        <section className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <SectionHeader
                icon={BarChart3}
                title="Your top formats"
                subtitle={`How your post formats actually perform — last ${days} days, your own data.`}
            />

            {error ? (
                <ErrorState message={error} onRetry={onRetry} />
            ) : loading && !breakdown ? (
                <SkeletonRows />
            ) : !breakdown || breakdown.formats.length === 0 ? (
                <div className="text-xs text-muted-foreground py-6 text-center">
                    No posts published in the last {days} days.
                </div>
            ) : (
                <div className="space-y-3">
                    {!useRate && breakdown.hasData && (
                        <div className="flex items-start gap-2 bg-secondary/50 border border-border rounded-lg px-3 py-2 text-[11px] text-muted-foreground">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>
                                Instagram doesn’t return impressions for older posts, so engagement rate isn’t computable. Comparing by average likes + comments per post instead.
                            </span>
                        </div>
                    )}
                    {!breakdown.hasData && (
                        <div className="flex items-start gap-2 bg-warning-soft border border-warning/20 rounded-lg px-3 py-2 text-xs text-warning">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>
                                We have post counts but no engagement data yet. Run a sync from Analytics to populate
                                metrics.
                            </span>
                        </div>
                    )}
                    {breakdown.formats.map((f) => {
                        const meta = FORMAT_META[f.format] ?? FORMAT_META.IMAGE
                        const engSignal = useRate ? f.avgEngagementRate || 0 : engPerPost(f)
                        const engPct = (engSignal / maxEng) * 100
                        const postPct = (f.postCount / maxPosts) * 100
                        const subline = useRate
                            ? `${f.postCount} ${f.postCount === 1 ? "post" : "posts"} · avg ${formatNumber(f.avgImpressionsPerPost)} impressions/post`
                            : `${f.postCount} ${f.postCount === 1 ? "post" : "posts"} · ${f.totalEngagement.toLocaleString()} total likes + comments`
                        return (
                            <div
                                key={f.format}
                                className="p-3 rounded-lg bg-secondary/30 border border-border/60 space-y-2"
                            >
                                <div className="flex items-center gap-2.5">
                                    <div
                                        className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center",
                                            meta.bg,
                                        )}
                                    >
                                        <meta.icon className={cn("w-4 h-4", meta.color)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                                        <p className="text-[11px] text-muted-foreground">{subline}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-foreground">
                                            {useRate
                                                ? `${(f.avgEngagementRate || 0).toFixed(2)}%`
                                                : Math.round(engPerPost(f)).toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {useRate ? "eng. rate" : "avg eng/post"}
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Bar pct={engPct} color="bg-brand" label={useRate ? "Eng. rate" : "Eng./post"} />
                                    <Bar pct={postPct} color="bg-brand/40" label="Post volume" />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </section>
    )
}

function HashtagSection({
    radar,
    loading,
    error,
    disabled,
    accountHandle,
    onRefresh,
}: {
    radar: HashtagRadar | null
    loading: boolean
    error: string | null
    disabled: boolean
    accountHandle: string | null
    onRefresh: () => void
}) {
    const [copied, setCopied] = useState<string | null>(null)
    const copyTag = (tag: string) => {
        navigator.clipboard?.writeText(tag).then(
            () => {
                setCopied(tag)
                setTimeout(() => setCopied((c) => (c === tag ? null : c)), 1500)
            },
            () => {},
        )
    }
    return (
        <section className="bg-card border border-border rounded-xl p-5 shadow-sm h-full">
            <div className="flex items-start justify-between mb-3">
                <SectionHeader
                    icon={Hash}
                    title="Niche hashtag radar"
                    subtitle={
                        accountHandle
                            ? `Hashtags with momentum for @${accountHandle}'s niche.`
                            : "Pick an account to generate hashtags."
                    }
                    inline
                />
                {!disabled && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onRefresh}
                        disabled={loading}
                        className="h-7 px-2 text-xs gap-1"
                    >
                        <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
                        Refresh
                    </Button>
                )}
            </div>

            {disabled ? (
                <div className="text-xs text-muted-foreground py-6 text-center">
                    Hashtag radar runs per account. Pick one above.
                </div>
            ) : error ? (
                <ErrorState message={error} onRetry={onRefresh} />
            ) : loading && !radar ? (
                <SkeletonRows />
            ) : radar ? (
                <>
                    {radar.pulse && (
                        <p className="text-xs text-foreground/80 leading-relaxed mb-3 px-3 py-2 rounded-lg bg-brand/5 border border-brand/15">
                            <Sparkles className="w-3 h-3 inline mr-1 text-brand" />
                            {radar.pulse}
                        </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {radar.hashtags.map((h) => {
                            const style = RELEVANCE_STYLES[h.relevance]
                            return (
                                <button
                                    key={h.tag}
                                    onClick={() => copyTag(h.tag)}
                                    className="group text-left p-2.5 rounded-lg bg-secondary/30 border border-border/60 hover:border-brand/30 hover:bg-secondary transition-all"
                                    title={h.rationale}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
                                        <span className="text-xs font-semibold text-foreground flex-1 truncate">
                                            {h.tag}
                                        </span>
                                        {copied === h.tag ? (
                                            <Check className="w-3 h-3 text-success" />
                                        ) : (
                                            <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                                        {h.rationale}
                                    </p>
                                </button>
                            )
                        })}
                    </div>
                </>
            ) : null}
        </section>
    )
}

function TimingSection({
    timing,
    loading,
    error,
    disabled,
    onRetry,
}: {
    timing: TimingResult | null
    loading: boolean
    error: string | null
    disabled: boolean
    onRetry: () => void
}) {
    return (
        <section className="bg-card border border-border rounded-xl p-5 shadow-sm h-full">
            <SectionHeader
                icon={Clock}
                title="Best posting windows"
                subtitle="AI-suggested times for your timezone."
            />
            {disabled ? (
                <div className="text-xs text-muted-foreground py-6 text-center">Pick an account above.</div>
            ) : error ? (
                <ErrorState message={error} onRetry={onRetry} />
            ) : loading && !timing ? (
                <SkeletonRows />
            ) : !timing || timing.best_times.length === 0 ? (
                <div className="text-xs text-muted-foreground py-6 text-center">No timing data yet.</div>
            ) : (
                <div className="space-y-2">
                    {timing.best_times.slice(0, 3).map((t, i) => (
                        <div
                            key={t}
                            className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/60"
                        >
                            <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                                <Calendar className="w-4 h-4 text-brand" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">
                                    {formatIsoToReadable(t)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">Window #{i + 1}</p>
                            </div>
                        </div>
                    ))}
                    {timing.explanation && (
                        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{timing.explanation}</p>
                    )}
                </div>
            )}
        </section>
    )
}

// ── Atoms ─────────────────────────────────────────────────────────────────────

function SectionHeader({
    icon: Icon,
    title,
    subtitle,
    inline,
}: {
    icon: React.ElementType
    title: string
    subtitle: string
    inline?: boolean
}) {
    return (
        <div className={cn(inline ? "" : "mb-4")}>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Icon className="w-4 h-4 text-brand" />
                {title}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
    )
}

function Bar({ pct, color, label }: { pct: number; color: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className="w-20 text-[10px] text-muted-foreground shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                    className={cn("h-full transition-all", color)}
                    style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
                />
            </div>
        </div>
    )
}

function SkeletonRows() {
    return (
        <div className="space-y-2">
            {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-secondary/40 animate-pulse" />
            ))}
        </div>
    )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">{message}</span>
            <Button size="sm" variant="ghost" onClick={onRetry} className="h-6 px-2 text-xs">
                Retry
            </Button>
        </div>
    )
}
