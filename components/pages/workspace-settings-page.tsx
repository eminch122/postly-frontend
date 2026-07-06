'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Mail, Trash2, Clock, Settings, Plus,
  Crown, Copy, X, Loader2,
  RefreshCw, CheckCircle, AlertCircle, LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWorkspace, UserRole } from '@/lib/workspace-context'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api-client'
import { assignableRoles } from '@/lib/permissions'
import { UserAvatar } from '@/components/ui/user-avatar'

// ── Toast helper ───────────────────────────────────────────────────────────────

type ToastType = { message: string; kind: 'success' | 'error' }

function useToast() {
  const [toast, setToast] = useState<ToastType | null>(null)
  const show = (message: string, kind: ToastType['kind'] = 'success') => {
    setToast({ message, kind })
    setTimeout(() => setToast(null), 3500)
  }
  return { toast, show }
}

// ── Role badge colors ──────────────────────────────────────────────────────────

const roleBadge: Record<UserRole, string> = {
  owner:  'bg-brand/20 text-brand',
  admin:  'bg-blue-500/20 text-blue-400',
  editor: 'bg-success/20 text-success',
  reviewer: 'bg-warning/20 text-warning',
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function WorkspaceSettingsPage() {
  const {
    workspace,
    isLoading,
    inviteMember,
    revokeInvite,
    removeMember,
    updateWorkspaceName,
    fetchWorkspace,
    deleteWorkspace,
    leaveWorkspace,
    currentUserRole,
    can,
  } = useWorkspace()
  const { user } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'members' | 'settings' | 'billing'>('members')
  const { toast, show: showToast } = useToast()

  // Roles this user is allowed to assign at invite time. Mirrors backend rule:
  // strictly lower level than the inviter, and owner is never assignable.
  const roleOptions = assignableRoles(currentUserRole)

  // Invite form state. Default to the highest role this inviter can grant so
  // owners don't have to manually pick "admin" every time.
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>(roleOptions[0] ?? 'editor')
  const [inviting, setInviting] = useState(false)

  // Remove member state
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Revoke invite state
  const [revokingId, setRevokingId] = useState<string | null>(null)

  // Settings form — keep in sync when active workspace changes (e.g. after switcher)
  const [wsName, setWsName] = useState(workspace?.name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (workspace?.name) setWsName(workspace.name)
  }, [workspace?.id, workspace?.name])

  if (isLoading && !workspace) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    )
  }

  if (!workspace) return (
    <div className="p-6 text-center text-muted-foreground">
      No workspace found. Complete onboarding first.
    </div>
  )

  // No unsafe fallback: currentUserRole comes straight from the workspace
  // context, which returns null if membership isn't resolved. We treat null as
  // "no permissions" everywhere.
  const canManageMembers = can('members:invite')
  const canUpdateWorkspace = can('workspace:update')
  const canDeleteWorkspace = can('workspace:delete')
  const slotsLeft = Math.max(0, workspace.memberLimit - workspace.members.length - workspace.pendingInvites.length)

  const tabs = [
    { id: 'members', label: 'Members', icon: Users },
    { id: 'settings', label: 'Workspace Settings', icon: Settings },
    { id: 'billing', label: 'Billing & Usage', icon: Crown },
  ]

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      await inviteMember(inviteEmail.trim(), inviteRole)
      setInviteEmail('')
      showToast(`Invitation sent to ${inviteEmail}`)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to send invite'
      showToast(msg, 'error')
    } finally {
      setInviting(false)
    }
  }

  const handleRevoke = async (id: string) => {
    setRevokingId(id)
    try {
      await revokeInvite(id)
      showToast('Invitation revoked')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to revoke invite'
      showToast(msg, 'error')
    } finally {
      setRevokingId(null)
    }
  }

  const handleRemove = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from this workspace?`)) return
    setRemovingId(memberId)
    try {
      await removeMember(memberId)
      showToast(`${memberName} has been removed`)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to remove member'
      showToast(msg, 'error')
    } finally {
      setRemovingId(null)
    }
  }

  const handleSaveName = async () => {
    if (!wsName.trim() || wsName === workspace.name) return
    setSavingName(true)
    try {
      await updateWorkspaceName(wsName.trim())
      showToast('Workspace name updated')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to update name'
      showToast(msg, 'error')
    } finally {
      setSavingName(false)
    }
  }

  const handleDelete = async () => {
    if (!workspace) return
    const confirmText = `Delete "${workspace.name}"? This permanently removes all posts, social account connections, and pending invites for this workspace. This cannot be undone.`
    if (!confirm(confirmText)) return
    setDeleting(true)
    try {
      await deleteWorkspace(workspace.id)
      showToast('Workspace deleted')
      router.push('/workspaces')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to delete workspace'
      showToast(msg, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleLeave = async () => {
    if (!workspace) return
    if (!confirm(`Leave "${workspace.name}"? You will lose access until someone invites you back.`)) return
    setLeaving(true)
    try {
      await leaveWorkspace(workspace.id)
      showToast('You have left the workspace')
      router.push('/workspaces')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to leave workspace'
      showToast(msg, 'error')
    } finally {
      setLeaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl animate-in slide-in-from-bottom-2',
          toast.kind === 'success'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-destructive/10 border-destructive/30 text-destructive',
        )}>
          {toast.kind === 'success'
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Workspace Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your workspace, team, and billing</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={fetchWorkspace} disabled={isLoading}>
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                activeTab === tab.id
                  ? 'border-brand text-brand'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Members Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          {/* Invite section */}
          <div className="border border-border rounded-xl p-6 bg-card space-y-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Invite Team Members</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {slotsLeft > 0
                  ? `Add up to ${slotsLeft} more member${slotsLeft !== 1 ? 's' : ''} (${workspace.memberLimit} max on the ${workspace.plan} plan)`
                  : `Member limit reached (${workspace.memberLimit} on the ${workspace.plan} plan)`}
              </p>
            </div>

            {canManageMembers && slotsLeft > 0 && (
              <div className="flex gap-2">
                <input
                  type="email"
                  id="invite-email"
                  placeholder="name@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground capitalize"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <Button
                  id="invite-send-btn"
                  className="gap-2 bg-brand hover:bg-brand/90 text-white"
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                >
                  {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Send Invite
                </Button>
              </div>
            )}
          </div>

          {/* Members list */}
          <div className="border border-border rounded-xl p-6 bg-card space-y-4">
            <h3 className="text-lg font-bold text-foreground">Team Members ({workspace.members.length})</h3>

            <div className="space-y-3">
              {workspace.members.map(member => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-secondary/40 rounded-lg border border-border/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <UserAvatar
                      src={member.avatar}
                      name={member.name}
                      className="size-10"
                      fallbackClassName="text-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {member.name}
                        {member.id === user?.id && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge className={cn('capitalize text-xs border-0', roleBadge[member.role])}>
                      {member.role === 'owner' && <Crown className="w-3 h-3 mr-1" />}
                      {member.role}
                    </Badge>

                    {can('members:remove')
                      && member.id !== user?.id
                      && member.role !== 'owner'
                      // Admins cannot remove other admins; only owners can.
                      && !(member.role === 'admin' && currentUserRole !== 'owner') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(member.id, member.name)}
                        disabled={removingId === member.id}
                      >
                        {removingId === member.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending invites */}
          {workspace.pendingInvites.length > 0 && (
            <div className="border border-border rounded-xl p-6 bg-card space-y-4">
              <h3 className="text-lg font-bold text-foreground">
                Pending Invitations ({workspace.pendingInvites.length})
              </h3>

              <div className="space-y-3">
                {workspace.pendingInvites.map(invite => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 bg-secondary/40 rounded-lg border border-border/50"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{invite.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Invited {new Date(invite.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · <span className="capitalize">{invite.role}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className="flex gap-1 bg-yellow-500/20 text-yellow-500 border-0 text-xs">
                        <Clock className="w-3 h-3" />
                        Pending
                      </Badge>
                      {canManageMembers && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleRevoke(invite.id)}
                          disabled={revokingId === invite.id}
                        >
                          {revokingId === invite.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <X className="w-4 h-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Settings Tab ────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="border border-border rounded-xl p-6 bg-card space-y-4">
            <h3 className="text-lg font-bold text-foreground">Workspace Information</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Workspace Name</label>
                <input
                  type="text"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  onFocus={() => setWsName(workspace.name)}
                  disabled={!canUpdateWorkspace}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Workspace Slug</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={workspace.slug}
                    disabled
                    className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-sm opacity-50"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(workspace.slug)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {canUpdateWorkspace && (
              <Button
                className="bg-brand hover:bg-brand/90 text-white gap-2"
                onClick={handleSaveName}
                disabled={savingName || wsName === workspace.name}
              >
                {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save Changes
              </Button>
            )}
          </div>

          <div className="border border-destructive/30 rounded-xl p-6 bg-destructive/5 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Danger Zone</h3>
              <p className="text-sm text-muted-foreground mt-1">These actions cannot be undone</p>
            </div>
            {canDeleteWorkspace ? (
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Trash2 className="w-4 h-4 mr-2" />}
                Delete Workspace
              </Button>
            ) : (
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={handleLeave}
                disabled={leaving}
              >
                {leaving
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <LogOut className="w-4 h-4 mr-2" />}
                Leave Workspace
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Billing Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Team Members', value: `${workspace.members.length}/${workspace.memberLimit}`, icon: Users },
              { label: 'Social Accounts', value: `${workspace.socialAccounts}/${workspace.socialAccountLimit}`, icon: Crown },
            ].map((stat, i) => {
              const Icon = stat.icon
              return (
                <div key={i} className="border border-border rounded-xl p-4 bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-brand" />
                    <label className="text-xs font-semibold text-muted-foreground">{stat.label}</label>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
              )
            })}
          </div>

          <div className="bg-gradient-to-r from-brand/10 to-brand/5 border border-brand/20 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Ready to Scale?</h3>
              <p className="text-sm text-muted-foreground mt-1">Upgrade to add more team members and social accounts</p>
            </div>
            <Button className="gap-2 bg-brand hover:bg-brand/90 text-white">
              <Crown className="w-4 h-4" />
              View Plans
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
