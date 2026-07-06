"use client"

import { useState } from "react"
import Link from "next/link"
import { Bell, CheckCheck } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  useNotifications,
  notificationMeta,
  TONE_CLASSES,
  type AppNotification,
} from "@/lib/notifications-context"

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return ""
  }
}

function NotificationRow({
  n,
  onClick,
}: {
  n: AppNotification
  onClick: (n: AppNotification) => void
}) {
  const { icon: Icon, tone } = notificationMeta(n.type)
  const tc = TONE_CLASSES[tone]

  return (
    <button
      type="button"
      onClick={() => onClick(n)}
      className={cn(
        "w-full text-left flex gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-secondary",
        !n.isRead && "bg-secondary/50",
      )}
    >
      <div className={cn("mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0", tc.icon)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium text-foreground truncate">{n.title}</p>
          {!n.isRead && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", tc.dot)} />}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(n.createdAt)}</p>
      </div>
    </button>
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, markAsRead, markAllAsRead, refresh } = useNotifications()
  const recent = notifications.slice(0, 7)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    // Refetch on open so the dropdown is fresh even if the socket dropped.
    if (next) void refresh()
  }

  const handleRowClick = (n: AppNotification) => {
    if (!n.isRead) void markAsRead(n.id)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="relative w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-brand text-white text-[9px] font-semibold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          {unreadCount > 0 && (
            <button
              onClick={() => void markAllAsRead()}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </button>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Bell className="w-7 h-7 text-muted-foreground/40" />
            <p className="text-sm text-foreground mt-2">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Publish results and account alerts will show up here.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="p-1.5">
              {recent.map((n) => (
                <NotificationRow key={n.id} n={n} onClick={handleRowClick} />
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="border-t border-border p-1.5">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block w-full text-center text-xs font-medium text-brand hover:bg-secondary rounded-lg py-2 transition-colors"
          >
            See all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
