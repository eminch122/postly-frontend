"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  ChevronLeft, ChevronRight, Plus, Instagram,
  LayoutGrid, CalendarDays, Loader2, AlertCircle, Trash2,
  Calendar as CalendarIcon, Clock, X, Save, Send,
  CheckCircle, AlertTriangle, FileText, Eye, GripVertical,
  RotateCcw, Image as ImageIcon, Video,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { apiClient, ApiError, getAccessToken } from "@/lib/api-client"
import { useWorkspace } from "@/lib/workspace-context"
import { FaTiktok, FaFacebookF, FaLinkedinIn } from "react-icons/fa"
import { RiTwitterXFill } from "react-icons/ri"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"]

type Platform = string

interface PostMedia {
  type?: "IMAGE" | "VIDEO"
  url: string
  mimeType?: string
}

interface Post {
  _id: string
  title?: string
  status: string
  scheduledAt: string
  platforms: string[]
  platformData?: { platform: string; accountId: string; status: string }[]
  content?: { text?: string }
  media?: PostMedia[]
}

const PLATFORM_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; ring: string }> = {
  INSTAGRAM:           { label: "Instagram", icon: Instagram,       color: "text-pink-500",  bg: "bg-pink-500/10",  ring: "ring-pink-500/30" },
  INSTAGRAM_STANDALONE:{ label: "Instagram", icon: Instagram,       color: "text-pink-500",  bg: "bg-pink-500/10",  ring: "ring-pink-500/30" },
  TWITTER:             { label: "X (Twitter)", icon: RiTwitterXFill, color: "text-foreground", bg: "bg-foreground/10", ring: "ring-foreground/30" },
  LINKEDIN:            { label: "LinkedIn",  icon: FaLinkedinIn,    color: "text-blue-600",  bg: "bg-blue-600/10",  ring: "ring-blue-600/30" },
  FACEBOOK:            { label: "Facebook",  icon: FaFacebookF,     color: "text-blue-500",  bg: "bg-blue-500/10",  ring: "ring-blue-500/30" },
  TIKTOK:              { label: "TikTok",    icon: FaTiktok,        color: "text-foreground", bg: "bg-foreground/10", ring: "ring-foreground/30" },
}

const STATUS_META: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  DRAFT:          { label: "Draft",          dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-muted-foreground/10" },
  PENDING_REVIEW: { label: "In Review",      dot: "bg-amber-500",        text: "text-amber-500",        bg: "bg-amber-500/10" },
  APPROVED:       { label: "Approved",       dot: "bg-emerald-500",      text: "text-emerald-500",      bg: "bg-emerald-500/10" },
  SCHEDULED:      { label: "Scheduled",      dot: "bg-brand",            text: "text-brand",            bg: "bg-brand/10" },
  PUBLISHING:     { label: "Publishing",     dot: "bg-brand",            text: "text-brand",            bg: "bg-brand/10" },
  PUBLISHED:      { label: "Published",      dot: "bg-success",          text: "text-success",          bg: "bg-success/10" },
  FAILED:         { label: "Failed",         dot: "bg-destructive",      text: "text-destructive",      bg: "bg-destructive/10" },
}

// A post is movable iff the backend will accept a reschedule / update for it.
// PUBLISHED & PUBLISHING are immutable; PENDING_REVIEW is locked while reviewers
// look at it. Everything else is fair game.
function isDraggable(status: string): boolean {
  return ["DRAFT", "APPROVED", "SCHEDULED", "FAILED"].includes(status)
}
function isDeletable(status: string): boolean {
  return status !== "PUBLISHING" && status !== "PUBLISHED"
}
function isEditable(status: string): boolean {
  return !["PUBLISHING", "PUBLISHED", "PENDING_REVIEW"].includes(status)
}

const samePlatformFamily = (filter: Platform | "all", platform: string): boolean => {
  if (filter === "all") return true
  if (filter === "INSTAGRAM") return platform === "INSTAGRAM" || platform === "INSTAGRAM_STANDALONE"
  return platform === filter
}

// Format like "9:30 AM" — used inside compact chips
function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

// Build the value for a datetime-local input from a Date object (no Z suffix,
// local time). Mirrors compose-page.tsx's getMinScheduledAt helper.
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Inverse of `dateKey()` below. Returns null for malformed input — the only
// caller is the pointer-drag drop logic, which already no-ops on null.
function dateKeyToDate(key: string): Date | null {
  const parts = key.split("-").map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return null
  return new Date(parts[0], parts[1], parts[2])
}

// Pixel threshold before a pointer-down on a chip becomes a drag. Below this,
// the gesture is treated as a click (open the edit dialog).
const DRAG_ACTIVATION_DISTANCE = 5

export function CalendarPage() {
  const { activeWorkspace, can } = useWorkspace()
  const workspaceId = activeWorkspace?.id ?? null
  const canSchedule = can("posts:schedule")
  const canDelete = can("posts:delete_own") || can("posts:delete_any")
  const canEdit = can("posts:edit_own") || can("posts:edit_any")

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [activeFilter, setActiveFilter] = useState<Platform | "all">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "draft" | "published">("all")
  const [view, setView] = useState<"month" | "week">("month")
  const [weekAnchor, setWeekAnchor] = useState<Date>(new Date()) // first day (Sun) of the visible week

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" | "info" } | null>(null)

  // Drag state — null when idle, the dragging post otherwise.
  // We use pointer events (not the HTML5 drag API) so a single press-and-move
  // immediately starts dragging — no extra click needed to "arm" the chip.
  //
  // Listeners live on window and read `dragRef`. This matters because PostChip
  // is defined inline inside this component, so every parent re-render
  // recreates it and React unmounts/remounts each chip — chip-local pointer
  // capture and refs would be wiped mid-drag, freezing the UI. Window
  // listeners survive that churn.
  const [draggingPostId, setDraggingPostId] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number; post: Post } | null>(null)
  const dragRef = useRef<{ post: Post; startX: number; startY: number; active: boolean } | null>(null)
  // After a successful drag we briefly swallow the synthetic click that would
  // otherwise reopen the edit dialog on the chip we just dropped.
  const suppressNextClickRef = useRef(false)

  // Detail/edit modal
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const selectedPost = useMemo(() => posts.find(p => p._id === selectedPostId) ?? null, [posts, selectedPostId])

  // Track the most recent fetch so a stale response (e.g. user already navigated
  // months) can't overwrite fresh data.
  const fetchSeq = useRef(0)

  const showToast = useCallback((message: string, kind: "success" | "error" | "info" = "success") => {
    setToast({ message, kind })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Date helpers ──────────────────────────────────────────────────────────
  const today = new Date()

  const firstDay = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

  // ── Fetch ────────────────────────────────────────────────────────────────
  // Fetch a generous window so view switching (month ↔ week) is instant. We
  // always grab the full visible month plus padding for the week view's edges.
  const fetchPosts = useCallback(async () => {
    if (!workspaceId) {
      setPosts([])
      setLoading(false)
      return
    }
    const seq = ++fetchSeq.current
    setLoading(true)
    setError(null)
    try {
      const from = new Date(currentYear, currentMonth - 1, 20).toISOString()
      const to = new Date(currentYear, currentMonth + 2, 10, 23, 59, 59).toISOString()
      const data = await apiClient.get<Post[]>(
        `/api/v1/posts/calendar?workspaceId=${workspaceId}&from=${from}&to=${to}`,
      )
      if (seq !== fetchSeq.current) return
      setPosts(data || [])
    } catch (err: unknown) {
      if (seq !== fetchSeq.current) return
      setError(err instanceof ApiError ? err.message : "Failed to load calendar posts")
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [currentYear, currentMonth, workspaceId])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  // ── Filtering ────────────────────────────────────────────────────────────
  const filteredPosts = useMemo(() => posts.filter(p => {
    if (statusFilter !== "all") {
      const status = p.status
      if (statusFilter === "scheduled" && !["SCHEDULED", "APPROVED"].includes(status)) return false
      if (statusFilter === "draft" && status !== "DRAFT") return false
      if (statusFilter === "published" && status !== "PUBLISHED") return false
    }
    if (activeFilter !== "all") {
      const platforms = p.platforms?.length
        ? p.platforms
        : p.platformData?.map(pd => pd.platform) ?? []
      if (!platforms.some(pl => samePlatformFamily(activeFilter, pl))) return false
    }
    return true
  }), [posts, statusFilter, activeFilter])

  // Index by ISO date string (YYYY-MM-DD) so both views (month / week) hit the
  // same lookup table.
  const postsByDateKey = useMemo(() => {
    const map: Record<string, Post[]> = {}
    filteredPosts.forEach(post => {
      if (!post.scheduledAt) return
      const date = new Date(post.scheduledAt)
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      if (!map[key]) map[key] = []
      map[key].push(post)
    })
    Object.values(map).forEach(arr => arr.sort((a, b) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    ))
    return map
  }, [filteredPosts])

  const dateKey = (y: number, m: number, d: number) => `${y}-${m}-${d}`

  // ── Month grid cells ─────────────────────────────────────────────────────
  const monthCells = useMemo(() => {
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
    return Array.from({ length: totalCells }, (_, i) => {
      const day = i - firstDay + 1
      const valid = day >= 1 && day <= daysInMonth
      const date = new Date(currentYear, currentMonth, day)
      return { day, valid, date, key: dateKey(currentYear, currentMonth, day) }
    })
  }, [firstDay, daysInMonth, currentYear, currentMonth])

  // ── Week grid cells ──────────────────────────────────────────────────────
  const weekCells = useMemo(() => {
    const start = new Date(weekAnchor)
    start.setDate(start.getDate() - start.getDay())
    start.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return {
        day: d.getDate(),
        valid: true,
        date: d,
        key: dateKey(d.getFullYear(), d.getMonth(), d.getDate()),
        weekday: d.getDay(),
        inMonth: d.getMonth() === currentMonth,
      }
    })
  }, [weekAnchor, currentMonth])

  // Keep weekAnchor in sync when month changes — anchor on the first matching week
  useEffect(() => {
    if (view === "week") {
      const cellInRange = weekCells.some(c => c.inMonth)
      if (!cellInRange) {
        setWeekAnchor(new Date(currentYear, currentMonth, 1))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, currentYear, view])

  // ── Navigation ───────────────────────────────────────────────────────────
  const goPrev = () => {
    if (view === "month") {
      if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
      else setCurrentMonth(m => m - 1)
    } else {
      const next = new Date(weekAnchor)
      next.setDate(next.getDate() - 7)
      setWeekAnchor(next)
      if (next.getMonth() !== currentMonth) {
        setCurrentMonth(next.getMonth()); setCurrentYear(next.getFullYear())
      }
    }
  }
  const goNext = () => {
    if (view === "month") {
      if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
      else setCurrentMonth(m => m + 1)
    } else {
      const next = new Date(weekAnchor)
      next.setDate(next.getDate() + 7)
      setWeekAnchor(next)
      if (next.getMonth() !== currentMonth) {
        setCurrentMonth(next.getMonth()); setCurrentYear(next.getFullYear())
      }
    }
  }
  const goToday = () => {
    const t = new Date()
    setCurrentMonth(t.getMonth()); setCurrentYear(t.getFullYear())
    setWeekAnchor(t)
  }

  // ── Reschedule (drag-and-drop OR modal edit) ─────────────────────────────
  // Preserves the time-of-day from the source date when only the day changes;
  // takes an explicit ISO string when called from the modal time picker.
  const reschedulePost = useCallback(async (post: Post, target: Date | string) => {
    if (!canSchedule) {
      showToast("You don't have permission to reschedule", "error")
      return
    }
    let newDate: Date
    if (typeof target === "string") {
      newDate = new Date(target)
    } else {
      const source = new Date(post.scheduledAt)
      newDate = new Date(target)
      newDate.setHours(source.getHours(), source.getMinutes(), 0, 0)
    }

    // Required by the schedule endpoint. For SCHEDULED posts, the backend will
    // re-enqueue at the new time; for DRAFT, this flips status to SCHEDULED.
    if (newDate.getTime() <= Date.now()) {
      // Default to a sensible "now + 10 minutes" if drop lands on the past hour
      newDate = new Date(Date.now() + 10 * 60 * 1000)
      newDate.setSeconds(0, 0)
      showToast("Adjusted to next available time", "info")
    }

    // Optimistic update — snap chip to the new day immediately
    const prevScheduledAt = post.scheduledAt
    const prevStatus = post.status
    setPosts(curr => curr.map(p => p._id === post._id
      ? { ...p, scheduledAt: newDate.toISOString(), status: p.status === "DRAFT" ? "SCHEDULED" : p.status }
      : p
    ))

    try {
      // For DRAFTs, just bumping scheduledAt via PUT keeps them as DRAFT (and
      // out of the publish queue). For everything else, the schedule endpoint
      // is the right path because it re-enqueues the BullMQ job.
      if (post.status === "DRAFT") {
        await apiClient.put(`/api/v1/posts/${post._id}`, { scheduledAt: newDate.toISOString() })
      } else {
        await apiClient.post(`/api/v1/posts/${post._id}/schedule`, { scheduledAt: newDate.toISOString() })
      }
      showToast("Post rescheduled", "success")
    } catch (err: unknown) {
      // Roll back the optimistic move
      setPosts(curr => curr.map(p => p._id === post._id
        ? { ...p, scheduledAt: prevScheduledAt, status: prevStatus }
        : p
      ))
      showToast(err instanceof ApiError ? err.message : "Failed to reschedule", "error")
    }
  }, [canSchedule, showToast])

  // ── Drag lifecycle ───────────────────────────────────────────────────────
  // beginDrag runs synchronously on chip pointerdown; the window listeners
  // below pick up move/up/cancel regardless of whether the originating chip
  // is still mounted.
  const beginDrag = useCallback((post: Post, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if (!isDraggable(post.status) || !canSchedule) return
    dragRef.current = { post, startX: e.clientX, startY: e.clientY, active: false }
  }, [canSchedule])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      if (!d.active) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_ACTIVATION_DISTANCE) return
        d.active = true
        setDraggingPostId(d.post._id)
      }
      setDragGhost({ x: e.clientX, y: e.clientY, post: d.post })
      const target = document.elementFromPoint(e.clientX, e.clientY)
      const cellEl = target?.closest("[data-day-key]") as HTMLElement | null
      const nextKey = cellEl?.dataset.dayKey ?? null
      setDragOverKey(prev => (prev === nextKey ? prev : nextKey))
    }
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current
      dragRef.current = null
      if (!d || !d.active) return
      const target = document.elementFromPoint(e.clientX, e.clientY)
      const cellEl = target?.closest("[data-day-key]") as HTMLElement | null
      const targetKey = cellEl?.dataset.dayKey
      setDraggingPostId(null)
      setDragOverKey(null)
      setDragGhost(null)
      suppressNextClickRef.current = true
      if (!targetKey) return
      const targetDate = dateKeyToDate(targetKey)
      if (!targetDate) return
      const src = new Date(d.post.scheduledAt)
      if (src.toDateString() === targetDate.toDateString()) return
      reschedulePost(d.post, targetDate)
    }
    const onCancel = () => {
      dragRef.current = null
      setDraggingPostId(null)
      setDragOverKey(null)
      setDragGhost(null)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onCancel)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onCancel)
    }
  }, [reschedulePost])

  // ── Delete ───────────────────────────────────────────────────────────────
  const deletePost = useCallback(async (post: Post) => {
    if (!canDelete) {
      showToast("You don't have permission to delete", "error")
      return
    }
    const prev = posts
    setPosts(curr => curr.filter(p => p._id !== post._id))
    setSelectedPostId(null)
    try {
      await apiClient.delete(`/api/v1/posts/${post._id}`)
      showToast("Post deleted", "success")
    } catch (err: unknown) {
      setPosts(prev)
      showToast(err instanceof ApiError ? err.message : "Failed to delete", "error")
    }
  }, [posts, canDelete, showToast])

  // ── Caption save ─────────────────────────────────────────────────────────
  const saveCaption = useCallback(async (post: Post, newText: string) => {
    const prev = posts
    setPosts(curr => curr.map(p => p._id === post._id
      ? { ...p, content: { ...p.content, text: newText } }
      : p
    ))
    try {
      await apiClient.put(`/api/v1/posts/${post._id}`, { content: { text: newText } })
      showToast("Caption updated", "success")
    } catch (err: unknown) {
      setPosts(prev)
      showToast(err instanceof ApiError ? err.message : "Failed to save changes", "error")
      throw err
    }
  }, [posts, showToast])

  // ── Media save ───────────────────────────────────────────────────────────
  // Edits the post's media array (add / remove / replace). The backend's
  // UpdatePostSchema is CreatePostSchema.partial(), so we can send `media`
  // and Object.assign on the server applies it. Uploads themselves happen in
  // the dialog (multipart to /api/v1/upload) — by the time we get here the
  // media items already point to hosted URLs.
  const saveMedia = useCallback(async (post: Post, newMedia: PostMedia[]) => {
    const prev = posts
    setPosts(curr => curr.map(p => p._id === post._id ? { ...p, media: newMedia } : p))
    try {
      await apiClient.put(`/api/v1/posts/${post._id}`, {
        media: newMedia.map(m => ({
          type: m.type,
          url: m.url,
          mimeType: m.mimeType,
        })),
      })
      showToast("Media updated", "success")
    } catch (err: unknown) {
      setPosts(prev)
      showToast(err instanceof ApiError ? err.message : "Failed to save media", "error")
      throw err
    }
  }, [posts, showToast])

  // ── Filters config ───────────────────────────────────────────────────────
  const platformFilters: { key: Platform | "all"; label: string; icon?: React.ElementType }[] = [
    { key: "all", label: "All" },
    { key: "INSTAGRAM", label: "Instagram", icon: Instagram },
    { key: "TWITTER", label: "X", icon: RiTwitterXFill },
    { key: "LINKEDIN", label: "LinkedIn", icon: FaLinkedinIn },
    { key: "FACEBOOK", label: "Facebook", icon: FaFacebookF },
    { key: "TIKTOK", label: "TikTok", icon: FaTiktok },
  ]

  // ── Render helpers ───────────────────────────────────────────────────────

  const PostChip = ({ post, compact = false }: { post: Post; compact?: boolean }) => {
    const platform = post.platforms?.[0] || post.platformData?.[0]?.platform || "TWITTER"
    const pConfig = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.TWITTER
    const status = STATUS_META[post.status] || STATUS_META.DRAFT
    const draggable = isDraggable(post.status) && canSchedule
    const isBeingDragged = draggingPostId === post._id
    const time = formatTime(new Date(post.scheduledAt))
    const text = post.content?.text || post.title || "Untitled"

    return (
      <div
        // Only seed drag state. The actual move/up tracking lives on window
        // listeners in CalendarPage — see beginDrag and the useEffect above.
        // Doing it here would break: PostChip is inlined, so every parent
        // re-render unmounts/remounts the chip mid-drag, wiping pointer
        // capture and chip-local refs.
        onPointerDown={(e) => { if (draggable) beginDrag(post, e) }}
        onClick={(e) => {
          e.stopPropagation()
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false
            return
          }
          setSelectedPostId(post._id)
        }}
        className={cn(
          "group/chip relative flex items-center gap-1.5 px-1.5 py-1 rounded-md text-xs transition-all border border-transparent select-none touch-none",
          pConfig.bg,
          "hover:border-border hover:shadow-sm",
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          isBeingDragged && "opacity-40 scale-95",
        )}
        title={`${text} · ${status.label} · ${time}`}
      >
        {draggable && (
          <GripVertical className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover/chip:opacity-100 shrink-0 transition-opacity" />
        )}
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", status.dot)} />
        <pConfig.icon className={cn("w-2.5 h-2.5 shrink-0", pConfig.color)} />
        {!compact && (
          <span className="truncate text-foreground font-medium text-[10px] flex-1 leading-tight">{text}</span>
        )}
        {!compact && (
          <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums">{time}</span>
        )}
      </div>
    )
  }

  // A day cell — used by both month & week views. Week cells are taller and
  // show every post inline (no "+N more" cutoff) since there's room for it.
  const DayCell = ({
    cell,
    tall = false,
  }: {
    cell: { day: number; valid: boolean; date: Date; key: string; inMonth?: boolean }
    tall?: boolean
  }) => {
    const dayPosts = cell.valid ? (postsByDateKey[cell.key] || []) : []
    const isToday = cell.valid
      && cell.date.toDateString() === today.toDateString()
    const isPast = cell.valid && cell.date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6
    const isDropTarget = dragOverKey === cell.key && draggingPostId !== null
    const visibleCount = tall ? dayPosts.length : 3
    const outOfMonth = cell.inMonth === false

    return (
      <div
        data-day-key={cell.valid ? cell.key : undefined}
        className={cn(
          "group/cell relative border-r border-b border-border last:border-r-0 p-2 transition-all overflow-hidden",
          tall ? "min-h-[160px]" : "min-h-[120px]",
          cell.valid ? "hover:bg-secondary/40" : "bg-secondary/20",
          isWeekend && cell.valid && !isDropTarget && "bg-secondary/10",
          outOfMonth && "opacity-60",
          isDropTarget && "bg-brand/10 ring-2 ring-brand/40 ring-inset",
        )}
      >
        {cell.valid && (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <span className={cn(
                "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                isToday ? "bg-brand text-white shadow-sm" : isPast ? "text-muted-foreground" : "text-foreground",
              )}>
                {cell.day}
              </span>
              <Link
                href="/compose"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "opacity-0 group-hover/cell:opacity-100 text-muted-foreground hover:text-brand transition-all",
                  "w-5 h-5 flex items-center justify-center rounded-md hover:bg-brand/10",
                )}
                title="Add post for this day"
              >
                <Plus className="w-3 h-3" />
              </Link>
            </div>

            {/* Posts */}
            <div className="space-y-1">
              {dayPosts.slice(0, visibleCount).map((post) => (
                <PostChip key={post._id} post={post} />
              ))}
              {!tall && dayPosts.length > visibleCount && (
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedPostId(dayPosts[visibleCount]._id) }}
                  className="text-[10px] text-muted-foreground hover:text-foreground px-1 font-medium transition-colors"
                >
                  + {dayPosts.length - visibleCount} more
                </button>
              )}
            </div>

            {/* Drop hint overlay */}
            {isDropTarget && (
              <div className="absolute inset-2 border-2 border-dashed border-brand/60 rounded-md flex items-center justify-center pointer-events-none">
                <span className="text-[10px] font-semibold text-brand bg-card/90 px-1.5 py-0.5 rounded">
                  Drop to move
                </span>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ── Headline (month vs week) ─────────────────────────────────────────────
  const headline = view === "month"
    ? `${MONTHS[currentMonth]} ${currentYear}`
    : (() => {
        const start = weekCells[0]?.date
        const end = weekCells[6]?.date
        if (!start || !end) return ""
        if (start.getMonth() === end.getMonth()) {
          return `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
        }
        return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}`
      })()

  // ── Summary counts (top-of-page glance) ──────────────────────────────────
  const summary = useMemo(() => {
    const counts = { scheduled: 0, draft: 0, published: 0, failed: 0 }
    posts.forEach(p => {
      const d = new Date(p.scheduledAt)
      if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) return
      if (p.status === "DRAFT") counts.draft++
      else if (p.status === "SCHEDULED" || p.status === "APPROVED") counts.scheduled++
      else if (p.status === "PUBLISHED") counts.published++
      else if (p.status === "FAILED") counts.failed++
    })
    return counts
  }, [posts, currentMonth, currentYear])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl animate-in slide-in-from-bottom-2 max-w-sm",
          toast.kind === "success" ? "bg-success/10 border-success/30 text-success"
            : toast.kind === "error" ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "bg-brand/10 border-brand/30 text-brand",
        )}>
          {toast.kind === "success" ? <CheckCircle className="w-4 h-4 shrink-0" />
            : toast.kind === "error" ? <AlertCircle className="w-4 h-4 shrink-0" />
              : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Header row: title + summary counts */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{headline}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {summary.scheduled} scheduled · {summary.draft} drafts · {summary.published} published
            {summary.failed > 0 && <> · <span className="text-destructive">{summary.failed} failed</span></>}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 bg-brand hover:bg-brand/90 text-white shadow-sm" asChild>
          <Link href="/compose">
            <Plus className="w-3.5 h-3.5" />
            Schedule Post
          </Link>
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Month/week nav */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1.5 py-1 shadow-sm">
          <button
            onClick={goPrev}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors p-1 rounded"
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToday}
            className="text-xs font-medium text-foreground hover:bg-secondary transition-colors px-2 py-0.5 rounded"
          >
            Today
          </button>
          <button
            onClick={goNext}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors p-1 rounded"
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-0.5 bg-card border border-border rounded-lg p-0.5 shadow-sm">
          {([
            { key: "all", label: "All" },
            { key: "scheduled", label: "Scheduled" },
            { key: "draft", label: "Drafts" },
            { key: "published", label: "Published" },
          ] as const).map(s => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                statusFilter === s.key
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Platform filter */}
        <div className="flex items-center gap-0.5 bg-card border border-border rounded-lg p-0.5 shadow-sm overflow-x-auto max-w-full hide-scrollbar">
          {platformFilters.map(f => {
            const Icon = f.icon
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                  activeFilter === f.key
                    ? "bg-brand text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                )}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {f.label}
              </button>
            )
          })}
        </div>

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-1 bg-card border border-border rounded-lg p-0.5 shadow-sm">
          <button
            onClick={() => setView("month")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md transition-colors text-xs font-medium",
              view === "month" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            title="Month view"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Month
          </button>
          <button
            onClick={() => setView("week")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md transition-colors text-xs font-medium",
              view === "week" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            title="Week view"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Week
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={fetchPosts} className="ml-auto underline text-xs flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-sm z-10 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-brand animate-spin" />
          </div>
        )}

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border bg-secondary/30">
          {DAYS.map((d, i) => (
            <div
              key={d}
              className={cn(
                "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-center border-r border-border last:border-r-0",
                view === "week"
                  ? "text-foreground"
                  : (i === 0 || i === 6) ? "text-muted-foreground/70" : "text-muted-foreground",
              )}
            >
              <div className="flex flex-col items-center">
                <span>{d}</span>
                {view === "week" && weekCells[i] && (
                  <span className={cn(
                    "text-base font-bold mt-0.5",
                    weekCells[i].date.toDateString() === today.toDateString() ? "text-brand" : "text-foreground",
                  )}>
                    {weekCells[i].day}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {view === "month"
            ? monthCells.map((cell) => <DayCell key={cell.key + cell.day} cell={cell} />)
            : weekCells.map((cell) => <DayCell key={cell.key} cell={cell} tall />)}
        </div>

        {!loading && filteredPosts.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-card/95 border border-border rounded-xl px-5 py-4 text-center pointer-events-auto shadow-lg max-w-xs">
              <CalendarIcon className="w-7 h-7 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-semibold text-foreground">No posts this {view}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {activeFilter !== "all" || statusFilter !== "all"
                  ? "Try clearing filters, or schedule something new."
                  : "Get started by scheduling your first post."}
              </p>
              <Button size="sm" className="mt-3 gap-1.5 bg-brand hover:bg-brand/90 text-white" asChild>
                <Link href="/compose">
                  <Plus className="w-3 h-3" />
                  Schedule Post
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[11px] text-muted-foreground font-medium">Status:</span>
          {[
            { label: "Published", cls: "bg-success" },
            { label: "Scheduled", cls: "bg-brand" },
            { label: "Draft", cls: "bg-muted-foreground" },
            { label: "Failed", cls: "bg-destructive" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", item.cls)} />
              <span className="text-[11px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
        {canSchedule && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <GripVertical className="w-3 h-3" />
            Drag posts between days to reschedule
          </p>
        )}
      </div>

      {/* Detail / edit modal */}
      <PostDetailDialog
        post={selectedPost}
        open={!!selectedPost}
        onOpenChange={(open) => { if (!open) setSelectedPostId(null) }}
        onDelete={deletePost}
        onSaveCaption={saveCaption}
        onSaveMedia={saveMedia}
        onReschedule={reschedulePost}
        canEdit={canEdit}
        canDelete={canDelete}
        canSchedule={canSchedule}
        showToast={showToast}
      />

      {/* Drag ghost — follows the cursor while a chip is being dragged. We
          translate by -50% so the ghost is centered on the pointer. */}
      {dragGhost && (() => {
        const ghostPlatform = dragGhost.post.platforms?.[0]
          || dragGhost.post.platformData?.[0]?.platform
          || "TWITTER"
        const ghostCfg = PLATFORM_CONFIG[ghostPlatform] || PLATFORM_CONFIG.TWITTER
        const ghostStatus = STATUS_META[dragGhost.post.status] || STATUS_META.DRAFT
        const ghostText = dragGhost.post.content?.text || dragGhost.post.title || "Untitled"
        return (
          <div
            style={{ left: dragGhost.x, top: dragGhost.y }}
            className={cn(
              "pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-1/2",
              "flex items-center gap-1.5 px-1.5 py-1 rounded-md text-xs border border-border shadow-lg",
              ghostCfg.bg,
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", ghostStatus.dot)} />
            <ghostCfg.icon className={cn("w-2.5 h-2.5 shrink-0", ghostCfg.color)} />
            <span className="truncate text-foreground font-medium text-[10px] max-w-[160px] leading-tight">
              {ghostText}
            </span>
          </div>
        )
      })()}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Post detail / edit dialog
// ─────────────────────────────────────────────────────────────────────────────

function PostDetailDialog({
  post,
  open,
  onOpenChange,
  onDelete,
  onSaveCaption,
  onSaveMedia,
  onReschedule,
  canEdit,
  canDelete,
  canSchedule,
  showToast,
}: {
  post: Post | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (post: Post) => Promise<void>
  onSaveCaption: (post: Post, text: string) => Promise<void>
  onSaveMedia: (post: Post, media: PostMedia[]) => Promise<void>
  onReschedule: (post: Post, target: Date | string) => Promise<void>
  canEdit: boolean
  canDelete: boolean
  canSchedule: boolean
  showToast: (msg: string, kind?: "success" | "error" | "info") => void
}) {
  const [editMode, setEditMode] = useState(false)
  const [draftText, setDraftText] = useState("")
  const [draftSchedule, setDraftSchedule] = useState("")
  const [draftMedia, setDraftMedia] = useState<PostMedia[]>([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Re-seed local state whenever a different post opens
  useEffect(() => {
    if (post) {
      setDraftText(post.content?.text || "")
      setDraftSchedule(toLocalInputValue(new Date(post.scheduledAt)))
      setDraftMedia(post.media ? post.media.map(m => ({ ...m })) : [])
      setEditMode(false)
      setConfirmDelete(false)
    }
  }, [post])

  if (!post) return null

  const status = STATUS_META[post.status] || STATUS_META.DRAFT
  const platforms = post.platforms?.length
    ? post.platforms
    : post.platformData?.map(pd => pd.platform) ?? []
  const date = new Date(post.scheduledAt)
  const firstMedia = post.media?.[0]

  const captionChanged = draftText.trim() !== (post.content?.text || "").trim()
  const scheduleChanged = (() => {
    if (!draftSchedule) return false
    const next = new Date(draftSchedule)
    return Math.abs(next.getTime() - date.getTime()) > 1000
  })()
  // Compare draft vs. server media by URL list — sufficient since uploads
  // produce immutable URLs and reordering isn't supported here.
  const mediaChanged = (() => {
    const prev = (post.media ?? []).map(m => m.url)
    const next = draftMedia.map(m => m.url)
    if (prev.length !== next.length) return true
    return prev.some((u, i) => u !== next[i])
  })()

  const editingAllowed = canEdit && isEditable(post.status)
  const deletingAllowed = canDelete && isDeletable(post.status)

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const incoming = Array.from(files)
    if (draftMedia.length + incoming.length > 10) {
      showToast("Maximum 10 files per post", "error")
      return
    }
    setUploadingMedia(true)
    const token = getAccessToken()
    for (const file of incoming) {
      try {
        const formData = new FormData()
        formData.append("media", file)
        const res = await fetch(`${API_BASE_URL}/api/v1/upload`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        })
        if (!res.ok) throw new Error("Upload failed")
        const result: { url: string; mimeType: string; size: number } = await res.json()
        const isImage = file.type.startsWith("image/")
        setDraftMedia(curr => [
          ...curr,
          {
            type: isImage ? "IMAGE" : "VIDEO",
            url: result.url,
            mimeType: result.mimeType || file.type,
          },
        ])
      } catch {
        showToast(`Failed to upload ${file.name}`, "error")
      }
    }
    setUploadingMedia(false)
  }

  const removeDraftMedia = (idx: number) => {
    setDraftMedia(curr => curr.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    if (!captionChanged && !scheduleChanged && !mediaChanged) { setEditMode(false); return }
    setSaving(true)
    try {
      if (captionChanged) await onSaveCaption(post, draftText)
      if (mediaChanged) await onSaveMedia(post, draftMedia)
      if (scheduleChanged && canSchedule) await onReschedule(post, new Date(draftSchedule).toISOString())
      setEditMode(false)
    } catch {
      // Toast already shown by caller
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <DialogTitle className="text-base flex items-center gap-2 flex-wrap">
                {post.title || (post.content?.text ? post.content.text.slice(0, 50) + (post.content.text.length > 50 ? "…" : "") : "Untitled post")}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 flex-wrap text-xs">
                <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium", status.bg, status.text)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", status.dot)} />
                  {status.label}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                  {" · "}
                  {formatTime(date)}
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Platforms */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">Platforms</span>
          {platforms.map(p => {
            const cfg = PLATFORM_CONFIG[p] || PLATFORM_CONFIG.TWITTER
            const Icon = cfg.icon
            return (
              <span
                key={p}
                className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium", cfg.bg, cfg.color)}
              >
                <Icon className="w-2.5 h-2.5" />
                {cfg.label}
              </span>
            )
          })}
        </div>

        {/* Media — read-only preview when viewing, editable grid when editing */}
        {!editMode && firstMedia && (
          <div className="rounded-lg overflow-hidden border border-border bg-secondary">
            {firstMedia.type === "VIDEO" || firstMedia.mimeType?.startsWith("video/") ? (
              <div className="aspect-video flex items-center justify-center gap-2 text-muted-foreground">
                <FileText className="w-5 h-5" />
                <span className="text-xs">Video attached</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={firstMedia.url}
                alt=""
                className="w-full max-h-64 object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              />
            )}
            {post.media && post.media.length > 1 && (
              <p className="px-2 py-1 text-[10px] text-muted-foreground">+{post.media.length - 1} more media</p>
            )}
          </div>
        )}

        {editMode && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Media</span>
              <span className="text-[10px] text-muted-foreground">{draftMedia.length}/10</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => { uploadFiles(e.target.files); e.target.value = "" }}
            />
            {draftMedia.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {draftMedia.map((item, idx) => {
                  const isVideo = item.type === "VIDEO" || item.mimeType?.startsWith("video/")
                  return (
                    <div
                      key={`${item.url}-${idx}`}
                      className="relative group aspect-square rounded-lg overflow-hidden bg-secondary border border-border"
                    >
                      {isVideo ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                          <Video className="w-5 h-5 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground">Video</span>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.url}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeDraftMedia(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove media"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
                {draftMedia.length < 10 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingMedia}
                    className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-brand/40 hover:bg-brand/5 flex items-center justify-center transition-colors disabled:opacity-60"
                    aria-label="Add media"
                  >
                    {uploadingMedia ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingMedia}
                className="w-full border-2 border-dashed border-border hover:border-brand/40 hover:bg-brand/5 rounded-lg p-4 text-center transition-colors disabled:opacity-60"
              >
                {uploadingMedia ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-brand" />
                    <p className="text-xs text-muted-foreground">Uploading…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                        <Video className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-brand font-medium">Add media</span> — images or video
                    </p>
                  </div>
                )}
              </button>
            )}
          </div>
        )}

        {/* Caption */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Caption</span>
            {!editMode && editingAllowed && (
              <button
                onClick={() => setEditMode(true)}
                className="text-[11px] text-brand hover:underline font-medium"
              >
                Edit
              </button>
            )}
          </div>
          {editMode ? (
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              placeholder="Write your post here…"
            />
          ) : (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap bg-secondary/50 rounded-lg p-3 border border-border">
              {post.content?.text || <span className="text-muted-foreground italic">No caption</span>}
            </p>
          )}
        </div>

        {/* Schedule editor (visible while editing, when allowed) */}
        {editMode && canSchedule && (
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
              Scheduled for
            </span>
            <input
              type="datetime-local"
              value={draftSchedule}
              onChange={(e) => setDraftSchedule(e.target.value)}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Drag the post on the calendar to reschedule by day, or set an exact time here.
            </p>
          </div>
        )}

        <DialogFooter className="flex sm:flex-row flex-col gap-2 mt-2">
          {!editMode ? (
            <>
              {deletingAllowed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                Close
              </Button>
              {editingAllowed && (
                <Button
                  size="sm"
                  onClick={() => setEditMode(true)}
                  className="gap-1.5 bg-brand hover:bg-brand/90 text-white"
                >
                  <Send className="w-3.5 h-3.5" />
                  Edit Post
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditMode(false)
                  setDraftText(post.content?.text || "")
                  setDraftSchedule(toLocalInputValue(date))
                  setDraftMedia(post.media ? post.media.map(m => ({ ...m })) : [])
                }}
                disabled={saving || uploadingMedia}
                className="gap-1.5 sm:mr-auto"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || uploadingMedia || (!captionChanged && !scheduleChanged && !mediaChanged)}
                className="gap-1.5 bg-brand hover:bg-brand/90 text-white"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Changes
              </Button>
            </>
          )}
        </DialogFooter>

        {/* Delete confirm — inline overlay so we don't stack dialogs */}
        {confirmDelete && (
          <div className="absolute inset-0 bg-card/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center rounded-lg">
            <AlertTriangle className="w-8 h-8 text-destructive mb-2" />
            <p className="text-sm font-semibold text-foreground">Delete this post?</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              This permanently removes the post. {post.status === "SCHEDULED" && "It will be unscheduled from the publish queue too."}
            </p>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={async () => { await onDelete(post); setConfirmDelete(false) }}
                className="bg-destructive hover:bg-destructive/90 text-white gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
