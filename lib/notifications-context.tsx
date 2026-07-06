"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react"
import { io, Socket } from "socket.io-client"
import { toast } from "sonner"
import {
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3,
  Unplug,
  KeyRound,
  ClipboardList,
  ThumbsUp,
  ThumbsDown,
  type LucideIcon,
} from "lucide-react"

import { apiClient, getAccessToken } from "./api-client"
import { useAuth } from "./auth-context"

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  isRead: boolean
  createdAt: string
}

export type NotificationTone = "success" | "error" | "warning" | "info"

interface NotificationsContextType {
  notifications: AppNotification[]
  unreadCount: number
  isLoading: boolean
  refresh: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

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

// ── Presentation metadata (shared by the bell dropdown and history page) ───────

export function notificationMeta(type: string): {
  tone: NotificationTone
  icon: LucideIcon
  label: string
} {
  switch (type) {
    case "POST_PUBLISHED":
      return { tone: "success", icon: CheckCircle2, label: "Published" }
    case "POST_FAILED":
      return { tone: "error", icon: XCircle, label: "Publish failed" }
    case "POST_SUBMITTED_FOR_REVIEW":
      return { tone: "info", icon: ClipboardList, label: "Review" }
    case "POST_APPROVED":
      return { tone: "success", icon: ThumbsUp, label: "Approved" }
    case "POST_REJECTED":
      return { tone: "warning", icon: ThumbsDown, label: "Changes requested" }
    case "JOB_COMPLETED":
      return { tone: "success", icon: CheckCircle2, label: "Completed" }
    case "JOB_FAILED":
      return { tone: "error", icon: AlertTriangle, label: "Job failed" }
    case "ANALYTICS_READY":
      return { tone: "info", icon: BarChart3, label: "Analytics" }
    case "ACCOUNT_DISCONNECTED":
      return { tone: "warning", icon: Unplug, label: "Account" }
    case "TOKEN_EXPIRING":
      return { tone: "warning", icon: KeyRound, label: "Token expiring" }
    default:
      return { tone: "info", icon: Bell, label: "Notification" }
  }
}

export const TONE_CLASSES: Record<NotificationTone, { icon: string; dot: string }> = {
  success: { icon: "text-success bg-success-soft", dot: "bg-success" },
  error: { icon: "text-destructive bg-destructive/10", dot: "bg-destructive" },
  warning: { icon: "text-warning bg-warning-soft", dot: "bg-warning" },
  info: { icon: "text-brand bg-brand-soft", dot: "bg-brand" },
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

// ── Context ───────────────────────────────────────────────────────────────────

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

const PAGE_SIZE = 30

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return
    setIsLoading(true)
    try {
      const [listRes, countRes] = await Promise.all([
        apiClient.get<{ notifications: RawNotification[] }>(
          `/api/v1/notifications?limit=${PAGE_SIZE}`,
        ),
        apiClient.get<{ count: number }>(`/api/v1/notifications/unread-count`),
      ])
      setNotifications((listRes.notifications ?? []).map(normalize))
      setUnreadCount(countRes.count ?? 0)
    } catch {
      // Stay quiet — a transient fetch failure shouldn't spam the user.
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  const markAsRead = useCallback(async (id: string) => {
    let wasUnread = false
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === id && !n.isRead) wasUnread = true
        return n.id === id ? { ...n, isRead: true } : n
      }),
    )
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1))
    try {
      await apiClient.patch(`/api/v1/notifications/${id}/read`)
    } catch {
      /* optimistic — ignore */
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
    try {
      await apiClient.patch(`/api/v1/notifications/read-all`)
    } catch {
      /* optimistic — ignore */
    }
  }, [])

  // Initial load + reset on auth changes.
  useEffect(() => {
    if (isAuthenticated) {
      void refresh()
    } else {
      setNotifications([])
      setUnreadCount(0)
    }
  }, [isAuthenticated, refresh])

  // Real-time push over the existing WebSocket (per-user room on the gateway).
  useEffect(() => {
    if (!isAuthenticated) return
    const token = getAccessToken()
    if (!token) return

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    })
    socketRef.current = socket

    socket.on("notification", (raw: RawNotification) => {
      const incoming = normalize({ ...raw, isRead: false })
      setNotifications((prev) => {
        if (prev.some((n) => n.id === incoming.id)) return prev
        return [incoming, ...prev].slice(0, 50)
      })
      setUnreadCount((c) => c + 1)

      const { tone } = notificationMeta(incoming.type)
      const opts = { description: incoming.message }
      if (tone === "error") toast.error(incoming.title, opts)
      else if (tone === "success") toast.success(incoming.title, opts)
      else if (tone === "warning") toast.warning(incoming.title, opts)
      else toast(incoming.title, opts)
    })

    return () => {
      socket.off("notification")
      socket.disconnect()
      socketRef.current = null
    }
  }, [isAuthenticated])

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, isLoading, refresh, markAsRead, markAllAsRead }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications(): NotificationsContextType {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error("useNotifications must be used within a NotificationsProvider")
  return ctx
}
