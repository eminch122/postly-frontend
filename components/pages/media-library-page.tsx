"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
    Library, Search, Image as ImageIcon, Video, Loader2, AlertCircle,
    Grid as GridIcon, List as ListIcon, ExternalLink, Layers, Clock, Flame, Calendar,
    PlayCircle, PenSquare, Copy, X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { apiClient } from "@/lib/api-client"
import { useWorkspace } from "@/lib/workspace-context"

// ── Types ─────────────────────────────────────────────────────────────────────

interface MediaItem {
    url: string
    type: "IMAGE" | "VIDEO" | string
    mimeType?: string
    thumbnailUrl?: string
    sizeBytes?: number
    width?: number
    height?: number
    duration?: number
    altText?: string
    usageCount: number
    firstUsedAt?: string
    lastUsedAt?: string
    postIds: string[]
}

interface MediaResponse {
    items: MediaItem[]
    page: number
    limit: number
    total: number
    stats: {
        totalUnique: number
        totalImages: number
        totalVideos: number
        totalUsage: number
    }
}

type TypeFilter = "all" | "image" | "video"
type SortKey = "recent" | "most-used" | "oldest"
type RangeKey = "7d" | "30d" | "90d" | "1y" | "all"

const SORT_OPTIONS: { value: SortKey; label: string; icon: React.ElementType }[] = [
    { value: "recent", label: "Most recent", icon: Clock },
    { value: "most-used", label: "Most used", icon: Flame },
    { value: "oldest", label: "Oldest first", icon: Calendar },
]

const RANGE_OPTIONS: { value: RangeKey; label: string; title: string }[] = [
    { value: "7d", label: "7d", title: "Last 7 days" },
    { value: "30d", label: "30d", title: "Last 30 days" },
    { value: "90d", label: "90d", title: "Last 90 days" },
    { value: "1y", label: "1y", title: "Last year" },
    { value: "all", label: "All", title: "All time" },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(b?: number): string {
    if (!b || !Number.isFinite(b)) return ""
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
    return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDate(s?: string): string {
    if (!s) return ""
    return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDuration(d?: number): string {
    if (!d || !Number.isFinite(d)) return ""
    const m = Math.floor(d / 60)
    const s = Math.floor(d % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
}

function filenameFrom(url: string): string {
    try {
        const u = new URL(url)
        const last = u.pathname.split("/").filter(Boolean).pop() ?? url
        return decodeURIComponent(last)
    } catch {
        return url.split("/").pop() ?? url
    }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function MediaLibraryPage() {
    const { activeWorkspace } = useWorkspace()
    const workspaceId = activeWorkspace?.id ?? null
    const router = useRouter()

    const [data, setData] = useState<MediaResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [type, setType] = useState<TypeFilter>("all")
    const [sort, setSort] = useState<SortKey>("recent")
    const [range, setRange] = useState<RangeKey>("all")
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

    const [preview, setPreview] = useState<MediaItem | null>(null)

    // Debounce the search input so we're not hammering the aggregation
    // pipeline on every keystroke.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search.trim()), 250)
        return () => clearTimeout(t)
    }, [search])

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
                type,
                sort,
                range,
                limit: "60",
            })
            if (debouncedSearch) params.set("search", debouncedSearch)
            const result = await apiClient.get<MediaResponse>(`/api/v1/media?${params.toString()}`)
            setData(result)
        } catch (err: any) {
            setError(err?.message || "Failed to load media")
        } finally {
            setLoading(false)
        }
    }, [workspaceId, type, sort, range, debouncedSearch])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const useInCompose = useCallback(
        (item: MediaItem) => {
            // Stash the asset in sessionStorage so compose can hydrate its
            // media slot without bloating the URL with a long S3 path. The
            // shape matches compose-page.tsx's `MediaItem` interface.
            const payload = {
                url: item.url,
                mimeType: item.mimeType ?? "image/jpeg",
                sizeBytes: item.sizeBytes ?? 0,
                type: item.type === "VIDEO" ? "VIDEO" : "IMAGE",
                name: filenameFrom(item.url),
                preview: item.url,
            }
            try {
                sessionStorage.setItem("postly_compose_seed_media", JSON.stringify([payload]))
            } catch {
                /* sessionStorage may be unavailable; navigation still works without seed */
            }
            router.push("/compose")
        },
        [router],
    )

    const stats = data?.stats

    const headerCards = useMemo(
        () => [
            {
                label: "Total assets",
                value: stats?.totalUnique ?? 0,
                icon: Layers,
                color: "bg-brand-soft text-brand",
            },
            {
                label: "Images",
                value: stats?.totalImages ?? 0,
                icon: ImageIcon,
                color: "bg-pink-500/10 text-pink-500",
            },
            {
                label: "Videos",
                value: stats?.totalVideos ?? 0,
                icon: Video,
                color: "bg-blue-500/10 text-blue-500",
            },
            {
                label: "Total uses across posts",
                value: stats?.totalUsage ?? 0,
                icon: Flame,
                color: "bg-warning-soft text-warning",
            },
        ],
        [stats],
    )

    // ── Render guards ─────────────────────────────────────────────────────────

    if (!workspaceId) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <Library className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="text-sm text-foreground font-medium">Select a workspace to view media</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3">
                <div>
                    <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Library className="w-5 h-5 text-brand" />
                        Media Library
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Every image and video used across this workspace’s posts. Click any asset to preview or reuse it.
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {headerCards.map((c) => (
                    <div key={c.label} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", c.color)}>
                                <c.icon className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-foreground tracking-tight">{c.value.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Type filter */}
                <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
                    {(["all", "image", "video"] as TypeFilter[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setType(t)}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize",
                                type === t
                                    ? "bg-brand text-white shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                            )}
                        >
                            {t === "all" ? "All" : t === "image" ? "Images" : "Videos"}
                        </button>
                    ))}
                </div>

                {/* Sort */}
                <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
                    {SORT_OPTIONS.map((o) => (
                        <button
                            key={o.value}
                            onClick={() => setSort(o.value)}
                            className={cn(
                                "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                sort === o.value
                                    ? "bg-brand text-white shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                            )}
                            title={o.label}
                        >
                            <o.icon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{o.label}</span>
                        </button>
                    ))}
                </div>

                {/* Time range */}
                <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground ml-1.5 mr-0.5 shrink-0" />
                    {RANGE_OPTIONS.map((o) => (
                        <button
                            key={o.value}
                            onClick={() => setRange(o.value)}
                            className={cn(
                                "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                                range === o.value
                                    ? "bg-brand text-white shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                            )}
                            title={o.title}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by filename or alt text…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand placeholder:text-muted-foreground"
                    />
                </div>

                {/* View toggle */}
                <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
                    <button
                        onClick={() => setViewMode("grid")}
                        className={cn(
                            "p-1.5 rounded transition-colors",
                            viewMode === "grid"
                                ? "bg-brand text-white"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                        title="Grid view"
                    >
                        <GridIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setViewMode("list")}
                        className={cn(
                            "p-1.5 rounded transition-colors",
                            viewMode === "list"
                                ? "bg-brand text-white"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                        title="List view"
                    >
                        <ListIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Body */}
            {error ? (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 text-center">
                    <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                    <p className="text-sm text-destructive">{error}</p>
                    <Button size="sm" className="mt-3" onClick={fetchData}>Try again</Button>
                </div>
            ) : loading && !data ? (
                <GridSkeleton viewMode={viewMode} />
            ) : !data || data.items.length === 0 ? (
                <EmptyState search={debouncedSearch} type={type} />
            ) : viewMode === "grid" ? (
                <MediaGrid items={data.items} onClick={setPreview} />
            ) : (
                <MediaList items={data.items} onClick={setPreview} onUse={useInCompose} />
            )}

            {/* Preview drawer */}
            {preview && (
                <PreviewDrawer
                    item={preview}
                    onClose={() => setPreview(null)}
                    onUse={() => {
                        useInCompose(preview)
                        setPreview(null)
                    }}
                />
            )}
        </div>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GridSkeleton({ viewMode }: { viewMode: "grid" | "list" }) {
    if (viewMode === "list") {
        return (
            <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
                {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                        <div className="w-12 h-12 bg-secondary rounded-md" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-1/3 bg-secondary rounded" />
                            <div className="h-2 w-1/4 bg-secondary rounded" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="aspect-square bg-secondary animate-pulse rounded-lg" />
            ))}
        </div>
    )
}

function EmptyState({ search, type }: { search: string; type: TypeFilter }) {
    const filtered = !!search || type !== "all"
    return (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Library className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-foreground mb-1">
                {filtered ? "No media matches those filters" : "No media yet"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {filtered
                    ? "Try clearing the search or switching the type filter."
                    : "Once you attach images or videos to posts, they’ll show up here for reuse."}
            </p>
        </div>
    )
}

function MediaGrid({ items, onClick }: { items: MediaItem[]; onClick: (m: MediaItem) => void }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((item) => (
                <button
                    key={item.url}
                    onClick={() => onClick(item)}
                    className="group relative aspect-square rounded-lg overflow-hidden bg-secondary border border-border hover:border-brand transition-all"
                >
                    {item.type === "VIDEO" ? (
                        <>
                            {item.thumbnailUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-secondary">
                                    <Video className="w-8 h-8 text-muted-foreground" />
                                </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <PlayCircle className="w-10 h-10 text-white drop-shadow" />
                            </div>
                            {item.duration ? (
                                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium">
                                    {formatDuration(item.duration)}
                                </span>
                            ) : null}
                        </>
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={item.url}
                            alt={item.altText ?? ""}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => {
                                ;(e.currentTarget as HTMLImageElement).style.display = "none"
                            }}
                        />
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                        <p className="text-[10px] text-white truncate font-medium">
                            {filenameFrom(item.url)}
                        </p>
                        <p className="text-[10px] text-white/80">
                            Used in {item.usageCount} {item.usageCount === 1 ? "post" : "posts"}
                        </p>
                    </div>

                    {item.usageCount > 1 && (
                        <Badge className="absolute top-2 right-2 text-[10px] bg-brand text-white border-0">
                            ×{item.usageCount}
                        </Badge>
                    )}
                </button>
            ))}
        </div>
    )
}

function MediaList({
    items,
    onClick,
    onUse,
}: {
    items: MediaItem[]
    onClick: (m: MediaItem) => void
    onUse: (m: MediaItem) => void
}) {
    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-4 py-2 border-b border-border bg-secondary/40 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                <div className="col-span-6">Asset</div>
                <div className="col-span-1 text-right">Type</div>
                <div className="col-span-1 text-right">Size</div>
                <div className="col-span-1 text-right">Uses</div>
                <div className="col-span-2 text-right">Last used</div>
                <div className="col-span-1 text-right">Actions</div>
            </div>
            <div className="divide-y divide-border">
                {items.map((item) => (
                    <div
                        key={item.url}
                        className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center hover:bg-secondary/30 transition-colors"
                    >
                        <button
                            onClick={() => onClick(item)}
                            className="col-span-6 flex items-center gap-3 text-left min-w-0"
                        >
                            <div className="w-10 h-10 rounded-md overflow-hidden bg-secondary border border-border shrink-0 relative">
                                {item.type === "VIDEO" ? (
                                    item.thumbnailUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Video className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    )
                                ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={item.url}
                                        alt=""
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            ;(e.currentTarget as HTMLImageElement).style.display = "none"
                                        }}
                                    />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground truncate">{filenameFrom(item.url)}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{item.mimeType}</p>
                            </div>
                        </button>
                        <div className="col-span-1 text-right">
                            <Badge
                                className={cn(
                                    "text-[10px] border-0",
                                    item.type === "VIDEO"
                                        ? "bg-blue-500/10 text-blue-500"
                                        : "bg-pink-500/10 text-pink-500",
                                )}
                            >
                                {item.type === "VIDEO" ? "Video" : "Image"}
                            </Badge>
                        </div>
                        <div className="col-span-1 text-right text-xs text-muted-foreground">{formatBytes(item.sizeBytes)}</div>
                        <div className="col-span-1 text-right text-xs font-semibold text-foreground">{item.usageCount}</div>
                        <div className="col-span-2 text-right text-xs text-muted-foreground">{formatDate(item.lastUsedAt)}</div>
                        <div className="col-span-1 flex justify-end">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onUse(item)}
                                className="h-7 px-2 text-xs"
                                title="Use in a new post"
                            >
                                <PenSquare className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function PreviewDrawer({
    item,
    onClose,
    onUse,
}: {
    item: MediaItem
    onClose: () => void
    onUse: () => void
}) {
    const [copied, setCopied] = useState(false)
    const copyUrl = () => {
        navigator.clipboard?.writeText(item.url).then(
            () => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
            },
            () => {},
        )
    }
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div
                className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground truncate">{filenameFrom(item.url)}</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
                        aria-label="Close preview"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-secondary/40 border border-border max-h-[55vh] flex items-center justify-center">
                        {item.type === "VIDEO" ? (
                            <video src={item.url} controls className="max-w-full max-h-[55vh]" />
                        ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.url} alt={item.altText ?? ""} className="max-w-full max-h-[55vh] object-contain" />
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <Meta label="Type" value={item.type === "VIDEO" ? "Video" : "Image"} />
                        <Meta label="Size" value={formatBytes(item.sizeBytes) || "—"} />
                        <Meta
                            label="Dimensions"
                            value={item.width && item.height ? `${item.width}×${item.height}` : "—"}
                        />
                        <Meta label="Duration" value={formatDuration(item.duration) || "—"} />
                        <Meta label="Used in" value={`${item.usageCount} post${item.usageCount === 1 ? "" : "s"}`} />
                        <Meta label="First used" value={formatDate(item.firstUsedAt) || "—"} />
                        <Meta label="Last used" value={formatDate(item.lastUsedAt) || "—"} />
                        <Meta label="MIME" value={item.mimeType ?? "—"} />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                        <Button size="sm" className="gap-1.5 bg-brand hover:bg-brand/90 text-white" onClick={onUse}>
                            <PenSquare className="w-3.5 h-3.5" />
                            Use in new post
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={copyUrl}>
                            <Copy className="w-3.5 h-3.5" />
                            {copied ? "Copied" : "Copy URL"}
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" asChild>
                            <a href={item.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-3.5 h-3.5" />
                                Open
                            </a>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function Meta({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-xs font-semibold text-foreground truncate" title={value}>
                {value}
            </p>
        </div>
    )
}
