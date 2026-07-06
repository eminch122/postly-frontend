"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  Search, Plus, MoreHorizontal, CheckCircle2, XCircle,
  Crown, Inbox, Activity, Loader2, Check, X, Play, Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useWorkspace, UserRole } from "@/lib/workspace-context"
import { useRouter } from "next/navigation"
import { PERMISSION_MATRIX, roleHas } from "@/lib/permissions"
import { apiClient, ApiError } from "@/lib/api-client"
import { UserAvatar } from "@/components/ui/user-avatar"

const roleColors: Record<UserRole, string> = {
  owner: "bg-brand-soft text-brand border-brand/20",
  admin: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  editor: "bg-success-soft text-success border-success/20",
  reviewer: "bg-warning-soft text-warning border-warning/20",
}

// Columns shown in the permission matrix. Owner is implicit (has everything),
// so we focus on the three roles where the answers actually vary.
const MATRIX_ROLES: UserRole[] = ["admin", "editor", "reviewer"]

interface PendingMedia {
  type: "IMAGE" | "VIDEO" | "CAROUSEL" | "STORY" | "REEL"
  url: string
  thumbnailUrl?: string
  mimeType: string
  altText?: string
}

interface PendingPost {
  _id: string
  title?: string
  content: { text: string }
  platforms: string[]
  media?: PendingMedia[]
  scheduledAt?: string
  submittedBy?: string
  submittedAt?: string
  rejectionReason?: string
}

/**
 * Render a single post's media inline. Images get an aspect-square crop with
 * object-cover; videos render with native controls so reviewers can scrub
 * before approving. Hidden entirely when there's nothing to show.
 */
function MediaGrid({ media }: { media?: PendingMedia[] }) {
  if (!media || media.length === 0) return null

  // 1 item full-width, 2-4 in a 2-col grid, 5+ in a 3-col grid.
  const cols = media.length === 1 ? "grid-cols-2" : media.length <= 4 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
  return (
    <div className={cn("grid gap-2", cols)}>
      {media.map((item, idx) => {
        const isVideo = item.type === "VIDEO" || item.mimeType?.startsWith("video/")
        return (
          <div
            key={`${item.url}-${idx}`}
            className="relative bg-secondary rounded-lg overflow-hidden aspect-square border border-border"
          >
            {isVideo ? (
              <video
                src={item.url}
                poster={item.thumbnailUrl}
                controls
                preload="metadata"
                className="w-full h-full object-cover bg-black"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                alt={item.altText ?? `attachment ${idx + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            )}
            {isVideo && (
              <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium pointer-events-none">
                <Play className="w-2.5 h-2.5" />
                Video
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function TeamPage() {
  const { workspace, activeWorkspace, can, currentUserRole } = useWorkspace()
  const members = workspace?.members || []
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"members" | "approvals" | "activity">("members")

  const canManageMembers = can("members:invite")
  const canApprove = can("posts:approve")

  // ── Approvals tab data ─────────────────────────────────────────────────
  const [pending, setPending] = useState<PendingPost[]>([])
  const [loadingPending, setLoadingPending] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  const fetchPending = useCallback(async () => {
    if (!activeWorkspace?.id || !canApprove) {
      setPending([])
      return
    }
    setLoadingPending(true)
    setError(null)
    try {
      const data = await apiClient.get<PendingPost[]>(
        `/api/v1/posts/pending-review?workspaceId=${activeWorkspace.id}`,
      )
      setPending(data ?? [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load pending posts")
      setPending([])
    } finally {
      setLoadingPending(false)
    }
  }, [activeWorkspace?.id, canApprove])

  useEffect(() => {
    if (activeTab === "approvals") fetchPending()
  }, [activeTab, fetchPending])

  const handleApprove = async (postId: string) => {
    setActingId(postId)
    try {
      await apiClient.post(`/api/v1/posts/${postId}/approve`, {})
      await fetchPending()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Approval failed")
    } finally {
      setActingId(null)
    }
  }

  const handleReject = async (postId: string) => {
    if (!rejectReason.trim()) {
      setError("Provide a reason for rejection")
      return
    }
    setActingId(postId)
    try {
      await apiClient.post(`/api/v1/posts/${postId}/reject`, { reason: rejectReason.trim() })
      setRejectingId(null)
      setRejectReason("")
      await fetchPending()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Rejection failed")
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1 shadow-sm">
          {(["members", "approvals", "activity"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-all",
                activeTab === tab ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        {activeTab === "members" && canManageMembers && (
          <Button onClick={() => router.push("/workspace-settings")} size="sm" className="gap-1.5 bg-brand hover:bg-brand/90 text-white shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Members tab */}
      {activeTab === "members" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              placeholder="Search members..."
            />
          </div>

          {/* Members table */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Member</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Role</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">Joined</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map(m => (
                  <tr key={m.id} className="hover:bg-secondary/30 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <UserAvatar src={m.avatar} name={m.name} className="size-8" />
                        <div>
                          <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                            {m.name}
                            {m.role === "owner" && <Crown className="w-3 h-3 text-warning" />}
                          </p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge className={cn("text-xs border font-medium capitalize", roleColors[m.role] || "bg-secondary")}>
                        {m.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-3.5 text-xs text-muted-foreground hidden md:table-cell">
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Roles & permissions — generated from lib/permissions so it never
              drifts from the backend's actual enforcement. */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-1">Role Permissions</h3>
            <p className="text-xs  mb-4">
              Owners have every permission. The table below shows where the other roles differ.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Permission</th>
                    {MATRIX_ROLES.map(r => (
                      <th key={r} className="text-center py-2 px-3 font-semibold text-foreground capitalize">{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {PERMISSION_MATRIX.map(({ label, capability }) => (
                    <tr key={capability} className="hover:bg-secondary/20">
                      <td className="py-2.5 pr-4 text-muted-foreground">{label}</td>
                      {MATRIX_ROLES.map(role => (
                        <td key={role} className="text-center py-2.5 px-3">
                          {roleHas(role, capability)
                            ? <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                            : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Approvals tab */}
      {activeTab === "approvals" && (
        <div className="space-y-3">
          {!canApprove ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-secondary flex items-center justify-center mb-3">
                <Inbox className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Approvals are restricted</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Only Owners, Admins, and Reviewers can approve or reject posts. Your current role is <span className="capitalize font-medium">{currentUserRole ?? "unknown"}</span>.
              </p>
            </div>
          ) : loadingPending ? (
            <div className="bg-card border border-border rounded-xl p-12 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-brand" />
            </div>
          ) : pending.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-secondary flex items-center justify-center mb-3">
                <Inbox className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">No pending approvals</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Reviewers will see drafts here once teammates submit posts for review.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive">{error}</div>
              )}
              {pending.map(post => {
                const submitter = post.submittedBy
                  ? members.find(m => m.id === post.submittedBy)
                  : undefined
                const scheduledFor = post.scheduledAt ? new Date(post.scheduledAt) : null
                const willSchedule = scheduledFor !== null && scheduledFor.getTime() > Date.now()
                return (
                  <div key={post._id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden ">
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 border-b border-border flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          {post.title && <p className="text-sm font-semibold text-foreground truncate">{post.title}</p>}
                          {post.platforms.map(p => (
                            <Badge key={p} className="text-[10px] bg-secondary text-muted-foreground border-0">{p}</Badge>
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground/70 flex items-center flex-wrap gap-x-2">
                          <span>
                            Submitted by <span className="font-medium text-foreground">{submitter?.name ?? "Unknown"}</span>
                            {post.submittedAt && ` · ${new Date(post.submittedAt).toLocaleString()}`}
                          </span>
                          {willSchedule && (
                            <span className="inline-flex items-center gap-1 text-brand">
                              <Calendar className="w-3 h-3" />
                              Will publish {scheduledFor!.toLocaleString()}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-3">
                      {post.content.text && (
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{post.content.text}</p>
                      )}
                      <MediaGrid media={post.media} />
                      {(!post.content.text && (!post.media || post.media.length === 0)) && (
                        <p className="text-xs italic text-muted-foreground">This post has no content or media.</p>
                      )}
                    </div>

                    {/* Footer / actions */}
                    <div className="px-4 py-3 border-t border-border bg-secondary/20 flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/5"
                        onClick={() => { setRejectingId(post._id); setRejectReason(""); setError(null) }}
                        disabled={actingId === post._id}
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-success hover:bg-success/90 text-white"
                        onClick={() => handleApprove(post._id)}
                        disabled={actingId === post._id}
                      >
                        {actingId === post._id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Check className="w-3.5 h-3.5" />}
                        {willSchedule ? "Approve & Schedule" : "Approve & Publish"}
                      </Button>
                    </div>

                    {rejectingId === post._id && (
                      <div className="px-4 py-3 border-t border-border bg-secondary/20 space-y-2">
                        <label className="text-xs text-muted-foreground">Reason (required)</label>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={2}
                          maxLength={500}
                          className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                          placeholder="Tell the author what to change…"
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setRejectReason("") }}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="bg-destructive hover:bg-destructive/90 text-white"
                            onClick={() => handleReject(post._id)}
                            disabled={!rejectReason.trim() || actingId === post._id}
                          >
                            Send Rejection
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* Activity tab — awaiting backend (no activity feed endpoint yet) */}
      {activeTab === "activity" && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-secondary flex items-center justify-center mb-3">
            <Activity className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No activity yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Recent edits, comments, and approvals will show up here once your team starts collaborating on this workspace.
          </p>
        </div>
      )}
    </div>
  )
}
