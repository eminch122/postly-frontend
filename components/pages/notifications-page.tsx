"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, CheckCheck, Loader2, RefreshCw } from "lucide-react"
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import {
  useNotifications,
  notificationMeta,
  TONE_CLASSES,
  type AppNotification,
} from "@/lib/notifications-context"

const PAGE_SIZE = 20

type Filter = "all" | "unread"

interface RawNotification {
  id?: string
  _id?: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  isRead?: boolean
  createdAt: string
}

interface ListResponse {
  notifications: RawNotification[]
  total: number
  page: number
  limit: number
}

function normalize(raw: RawNotification): AppNotification {
  return {
    id: String(raw.id ?? raw._id),
    type: raw.type,
    title: raw.title,
    message: raw.message,
    data: raw.data,
    isRead: raw.isRead ?? false,
    createdAt: raw.createdAt,
  }
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  return format(d, "MMMM d, yyyy")
}

export function NotificationsPage() {
  const { markAsRead, markAllAsRead, unreadCount } = useNotifications()
  const [items, setItems] = useState<AppNotification[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<Filter>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const fetchPage = useCallback(
    async (pageNum: number, currentFilter: Filter, append: boolean) => {
      if (append) setIsLoadingMore(true)
      else setIsLoading(true)
      try {
        const res = await apiClient.get<ListResponse>(
          `/api/v1/notifications?page=${pageNum}&limit=${PAGE_SIZE}&unreadOnly=${currentFilter === "unread"}`,
        )
        const mapped = (res.notifications ?? []).map(normalize)
        setItems((prev) => (append ? [...prev, ...mapped] : mapped))
        setTotal(res.total ?? mapped.length)
        setPage(pageNum)
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [],
  )

  useEffect(() => {
    void fetchPage(1, filter, false)
  }, [filter, fetchPage])

  const handleRowClick = (n: AppNotification) => {
    if (n.isRead) return
    setItems((prev) =>
      filter === "unread"
        ? prev.filter((x) => x.id !== n.id)
        : prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
    )
    void markAsRead(n.id)
  }

  const handleMarkAll = () => {
    if (filter === "unread") setItems([])
    else setItems((prev) => prev.map((x) => ({ ...x, isRead: true })))
    void markAllAsRead()
  }

  const hasMore = items.length < total

  // Group consecutive items by day for section headers.
  const groups: Array<{ label: string; items: AppNotification[] }> = []
  for (const n of items) {
    const label = dayLabel(n.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(n)
    else groups.push({ label, items: [n] })
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      {/* Header / controls */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="inline-flex items-center gap-1 p-0.5 bg-secondary rounded-lg">
          {(["all", "unread"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize",
                filter === f
                  ? "bg-surface-raised text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
              {f === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 text-[10px] text-brand">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => void fetchPage(1, filter, false)}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleMarkAll}>
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
            <Bell className="w-6 h-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-foreground mt-3">
            {filter === "unread" ? "No unread notifications" : "No notifications yet"}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            When you publish posts, we&apos;ll keep a record here — including the reason if anything
            fails.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-2 px-1">
                {group.label}
              </p>
              <div className="rounded-xl border border-border bg-surface-raised divide-y divide-border overflow-hidden">
                {group.items.map((n) => {
                  const { icon: Icon, tone, label } = notificationMeta(n.type)
                  const tc = TONE_CLASSES[tone]
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleRowClick(n)}
                      className={cn(
                        "w-full text-left flex gap-3 px-4 py-3 transition-colors hover:bg-secondary/60",
                        !n.isRead && "bg-secondary/40",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          tc.icon,
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                          <span className="text-[10px] text-muted-foreground/60 border border-border rounded px-1.5 py-0.5 shrink-0">
                            {label}
                          </span>
                          {!n.isRead && (
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", tc.dot)} />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 break-words">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                          {format(new Date(n.createdAt), "h:mm a")} ·{" "}
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={isLoadingMore}
                onClick={() => void fetchPage(page + 1, filter, true)}
              >
                {isLoadingMore ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  `Load more (${total - items.length})`
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
