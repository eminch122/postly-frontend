"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    Sparkles, Send, RefreshCw, AlertTriangle, AlertCircle, Loader2,
    TrendingUp, Instagram, MessageSquare, Trash2, Plus,
    ArrowRight,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { apiClient } from "@/lib/api-client"
import { useWorkspace } from "@/lib/workspace-context"
import { useChat } from "@/lib/use-chat"
import { AccountSwitcher, SwitchableAccount } from "@/components/account-switcher"
import { UpgradePrompt } from "@/components/upgrade-prompt"

const SUPPORTED_PLATFORMS = ["INSTAGRAM"]

interface Recommendation {
    id: string
    title: string
    description: string
    priority: "high" | "medium" | "low"
    metric_hook?: string
    suggested_action?: string
}

interface InsightsBundle {
    summary: string
    recommendations: Recommendation[]
    starters: string[]
    generatedAt: string
    accountId: string
    accountHandle: string
    platform: string
}

function formatNumber(n: number): string {
    if (!Number.isFinite(n)) return "0"
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString()
}

const PRIORITY_STYLES: Record<Recommendation["priority"], { badge: string; bar: string }> = {
    high: { badge: "bg-destructive/10 text-destructive border-destructive/20", bar: "bg-destructive" },
    medium: { badge: "bg-warning-soft text-warning border-warning/20", bar: "bg-warning" },
    low: { badge: "bg-brand-soft text-brand border-brand/20", bar: "bg-brand" },
}

export function InsightsPage() {
    const { activeWorkspace, hasFeature } = useWorkspace()
    const workspaceId = activeWorkspace?.id ?? null
    const aiUnlocked = hasFeature('ai:tools')

    const [accounts, setAccounts] = useState<SwitchableAccount[]>([])
    const [accountsLoading, setAccountsLoading] = useState(true)
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

    const [bundle, setBundle] = useState<InsightsBundle | null>(null)
    const [bundleLoading, setBundleLoading] = useState(false)
    const [bundleError, setBundleError] = useState<string | null>(null)

    const chat = useChat({
        workspaceId,
        socialAccountId: selectedAccountId,
        autoOpenLatest: true,
    })
    const [input, setInput] = useState("")
    const messagesEndRef = useRef<HTMLDivElement>(null)

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
                if (igOnly.length > 0 && !selectedAccountId) {
                    setSelectedAccountId(igOnly[0]._id)
                }
            } catch (err) {
                console.error("Failed to load accounts", err)
            } finally {
                if (!cancelled) setAccountsLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId])

    // ── Fetch recommendations when account changes ────────────────────────
    const loadBundle = useCallback(
        async (refresh = false) => {
            if (!workspaceId || !selectedAccountId) {
                setBundle(null)
                return
            }
            setBundleLoading(true)
            setBundleError(null)
            try {
                const params = new URLSearchParams({
                    workspaceId,
                    accountId: selectedAccountId,
                })
                if (refresh) params.set("refresh", "true")
                const result = await apiClient.get<InsightsBundle>(
                    `/api/v1/ai/insights/recommendations?${params.toString()}`,
                )
                setBundle(result)
            } catch (err: any) {
                setBundleError(err?.message || "Failed to load recommendations")
            } finally {
                setBundleLoading(false)
            }
        },
        [workspaceId, selectedAccountId],
    )

    useEffect(() => {
        loadBundle()
    }, [loadBundle])

    // ── Auto-scroll chat ──────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    }, [chat.messages])

    const onSend = useCallback(async () => {
        const text = input.trim()
        if (!text) return
        setInput("")
        await chat.send(text)
    }, [input, chat])

    const onStarter = useCallback(
        async (text: string) => {
            await chat.send(text)
        },
        [chat],
    )

    const selectedAccount = useMemo(
        () => accounts.find((a) => a._id === selectedAccountId) ?? null,
        [accounts, selectedAccountId],
    )

    // ── Render guards ─────────────────────────────────────────────────────
    if (!workspaceId) {
        return (
            <EmptyState
                title="Select a workspace"
                description="Insights are scoped to a workspace. Choose one from the switcher in the sidebar."
            />
        )
    }

    if (!aiUnlocked) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <UpgradePrompt
                    title="Insights are a Pro feature"
                    description="AI-generated performance recommendations and the Insights chat are available on the Pro and Enterprise plans."
                />
            </div>
        )
    }

    if (accountsLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-brand animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading Instagram accounts…</p>
                </div>
            </div>
        )
    }

    if (accounts.length === 0) {
        return (
            <EmptyState
                icon={<Instagram className="w-12 h-12 text-muted-foreground/40" />}
                title="No Instagram accounts connected"
                description="Insights currently support Instagram only. Connect an Instagram account in Settings to start receiving AI-powered recommendations."
                action={
                    <Button asChild>
                        <a href="/settings">
                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                            Connect Instagram
                        </a>
                    </Button>
                }
            />
        )
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3">
                <div>
                    <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                        Insights
                        <Badge className="text-[10px] bg-brand-soft text-brand border-0">AI</Badge>
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Performance recommendations and contextual analysis for Instagram. More platforms coming soon.
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={() => loadBundle(true)}
                        disabled={bundleLoading || !selectedAccountId}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                            bundleLoading
                                ? "bg-brand/10 text-brand border-brand/20 cursor-wait"
                                : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20",
                        )}
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", bundleLoading && "animate-spin")} />
                        {bundleLoading ? "Regenerating…" : "Regenerate"}
                    </button>
                </div>
            </div>

            {/* Account switcher (IG only) */}
            <AccountSwitcher
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onSelect={setSelectedAccountId}
                platforms={SUPPORTED_PLATFORMS}
                includeAll={false}
            />

            {/* Two-column body */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Recommendations column */}
                <div className="lg:col-span-3 space-y-4">
                    <SummaryCard
                        bundle={bundle}
                        loading={bundleLoading}
                        error={bundleError}
                        accountHandle={selectedAccount?.accountUsername ?? ""}
                        followerCount={selectedAccount?.followerCount ?? 0}
                    />
                    <RecommendationsList bundle={bundle} loading={bundleLoading} />
                </div>

                {/* Chat column */}
                <div className="lg:col-span-2">
                    <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col h-[640px] overflow-hidden">
                        {/* Chat header */}
                        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-brand" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-foreground truncate">
                                    {chat.activeConversation?.title || "Ask about your Instagram"}
                                </h3>
                                <p className="text-[11px] text-muted-foreground">
                                    Anchored to @{selectedAccount?.accountUsername}
                                </p>
                            </div>
                            {chat.activeConversation && (
                                <button
                                    onClick={chat.newConversation}
                                    title="Start a new thread"
                                    className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                            {chat.messages.length === 0 ? (
                                <ChatEmptyState
                                    starters={bundle?.starters ?? []}
                                    onPick={onStarter}
                                    loading={bundleLoading}
                                />
                            ) : (
                                chat.messages.map((m, i) => (
                                    <ChatBubble key={m._id ?? i} role={m.role} content={m.content} streaming={m.streaming} />
                                ))
                            )}
                            {chat.error && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {chat.error}
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="px-3 py-3 border-t border-border bg-secondary/40">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault()
                                            onSend()
                                        }
                                    }}
                                    placeholder={
                                        chat.isStreaming ? "Generating…" : "Ask about reach, engagement, formats…"
                                    }
                                    disabled={chat.isStreaming}
                                    className="flex-1 px-3 py-2 bg-card rounded-lg text-xs text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-brand placeholder:text-muted-foreground disabled:opacity-50"
                                />
                                <Button
                                    onClick={onSend}
                                    disabled={chat.isStreaming || !input.trim()}
                                    size="sm"
                                    className="bg-brand hover:bg-brand/90 text-white"
                                >
                                    {chat.isStreaming ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Send className="w-3.5 h-3.5" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Conversation history (compact) */}
                    {chat.conversations.length > 0 && (
                        <div className="mt-3 space-y-1">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">
                                Recent threads
                            </p>
                            {chat.conversations.slice(0, 5).map((c) => (
                                <div
                                    key={c._id}
                                    className={cn(
                                        "group flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors",
                                        chat.activeConversation?._id === c._id
                                            ? "bg-brand-soft text-brand"
                                            : "hover:bg-secondary/60 text-muted-foreground",
                                    )}
                                    onClick={() => chat.openConversation(c._id)}
                                >
                                    <MessageSquare className="w-3 h-3 shrink-0" />
                                    <span className="flex-1 truncate">{c.title}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            chat.removeConversation(c._id)
                                        }}
                                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────

function SummaryCard({
    bundle,
    loading,
    error,
    accountHandle,
    followerCount,
}: {
    bundle: InsightsBundle | null
    loading: boolean
    error: string | null
    accountHandle: string
    followerCount: number
}) {
    return (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-pink-500/10 flex items-center justify-center">
                    <Instagram className="w-4 h-4 text-pink-500" />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                        @{accountHandle || "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                        {formatNumber(followerCount)} followers · last 30 days
                    </p>
                </div>
                <Badge className="bg-brand-soft text-brand border-0 text-[10px]">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    AI summary
                </Badge>
            </div>
            {error ? (
                <div className="flex items-center gap-2 text-xs text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {error}
                </div>
            ) : loading && !bundle ? (
                <div className="space-y-2">
                    <div className="h-3 bg-secondary rounded animate-pulse" />
                    <div className="h-3 bg-secondary rounded animate-pulse w-4/5" />
                </div>
            ) : bundle ? (
                <p className="text-sm leading-relaxed text-foreground/90">{bundle.summary}</p>
            ) : (
                <p className="text-xs text-muted-foreground">Select an account to see the summary.</p>
            )}
        </div>
    )
}

function RecommendationsList({ bundle, loading }: { bundle: InsightsBundle | null; loading: boolean }) {
    if (loading && !bundle) {
        return (
            <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                        <div className="h-4 bg-secondary rounded animate-pulse w-1/3 mb-2" />
                        <div className="h-3 bg-secondary rounded animate-pulse mb-1" />
                        <div className="h-3 bg-secondary rounded animate-pulse w-4/5" />
                    </div>
                ))}
            </div>
        )
    }
    if (!bundle || bundle.recommendations.length === 0) {
        return (
            <div className="bg-card border border-border rounded-xl p-6 text-center">
                <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-foreground font-medium">No recommendations yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    We need a few posts of performance history before the AI can suggest actions. Try syncing analytics from the Analytics page.
                </p>
            </div>
        )
    }
    return (
        <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground px-1">Recommendations</h2>
            {bundle.recommendations.map((r) => {
                const style = PRIORITY_STYLES[r.priority] ?? PRIORITY_STYLES.low
                return (
                    <div
                        key={r.id}
                        className="bg-card border border-border rounded-xl p-4 shadow-sm flex gap-3"
                    >
                        <div className={cn("w-1 rounded-full shrink-0", style.bar)} />
                        <div className="flex-1">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                                <h3 className="text-sm font-semibold text-foreground">{r.title}</h3>
                                <Badge className={cn("text-[10px] border", style.badge)}>{r.priority}</Badge>
                            </div>
                            <p className="text-xs text-foreground/80 leading-relaxed">{r.description}</p>
                            {r.metric_hook && (
                                <p className="text-[11px] text-muted-foreground mt-2">
                                    <span className="font-medium">Why:</span> {r.metric_hook}
                                </p>
                            )}
                            {r.suggested_action && (
                                <p className="text-[11px] text-brand mt-1 flex items-center gap-1">
                                    <ArrowRight className="w-3 h-3" />
                                    {r.suggested_action}
                                </p>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function ChatEmptyState({
    starters,
    onPick,
    loading,
}: {
    starters: string[]
    onPick: (q: string) => void
    loading: boolean
}) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-10 h-10 rounded-lg bg-brand-soft flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5 text-brand" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Ask anything about this account</p>
            <p className="text-[11px] text-muted-foreground mb-4">Or pick a starter below</p>
            <div className="space-y-2 w-full">
                {loading && starters.length === 0 ? (
                    <>
                        <div className="h-8 bg-secondary rounded animate-pulse" />
                        <div className="h-8 bg-secondary rounded animate-pulse" />
                    </>
                ) : (
                    starters.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => onPick(s)}
                            className="w-full text-left px-3 py-2 rounded-lg bg-secondary/60 hover:bg-secondary text-xs text-foreground border border-border hover:border-brand/30 transition-all"
                        >
                            {s}
                        </button>
                    ))
                )}
            </div>
        </div>
    )
}

function ChatBubble({
    role,
    content,
    streaming,
}: {
    role: string
    content: string
    streaming?: boolean
}) {
    if (role === "user") {
        return (
            <div className="flex justify-end">
                <div className="max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed bg-brand text-white whitespace-pre-wrap">
                    {content}
                </div>
            </div>
        )
    }
    return (
        <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 text-brand" />
            </div>
            <div className="max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed bg-secondary text-foreground border border-border whitespace-pre-wrap">
                {content}
                {streaming && <span className="inline-block w-1.5 h-3 ml-1 bg-brand animate-pulse" />}
            </div>
        </div>
    )
}

function EmptyState({
    icon,
    title,
    description,
    action,
}: {
    icon?: React.ReactNode
    title: string
    description: string
    action?: React.ReactNode
}) {
    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="bg-card border border-border rounded-xl p-12 text-center">
                {icon ?? <Sparkles className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />}
                <h3 className="text-sm font-semibold text-foreground mb-2 mt-4">{title}</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">{description}</p>
                {action}
            </div>
        </div>
    )
}
