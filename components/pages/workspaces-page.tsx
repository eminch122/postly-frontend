'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Users, Layers, Crown, Check, Loader2,
  ArrowRight, Settings, Sparkles, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useWorkspace, Workspace } from '@/lib/workspace-context'
import { useAuth } from '@/lib/auth-context'
import { ApiError } from '@/lib/api-client'
import { cn } from '@/lib/utils'

// ── Helpers ────────────────────────────────────────────────────────────────────

const GRADIENTS = [
  'from-violet-500 to-blue-500',
  'from-rose-500 to-orange-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-yellow-500',
  'from-sky-500 to-cyan-500',
  'from-fuchsia-500 to-pink-500',
]

function wsGradient(name: string) {
  return GRADIENTS[name.charCodeAt(0) % GRADIENTS.length]
}

const PLAN_META: Record<string, { label: string; color: string; bar: string }> = {
  free: {
    label: 'Free',
    color: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
    bar: 'bg-gradient-to-r from-slate-400 to-slate-500',
  },
  pro: {
    label: 'Pro',
    color: 'bg-brand/15 text-brand border-brand/20',
    bar: 'bg-gradient-to-r from-violet-500 to-brand',
  },
  enterprise: {
    label: 'Enterprise',
    color: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    bar: 'bg-gradient-to-r from-amber-500 to-orange-500',
  },
}

const ROLE_META: Record<string, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-brand/15 text-brand border-brand/20' },
  admin: { label: 'Admin', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  editor: { label: 'Editor', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  reviewer: { label: 'Reviewer', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
}

// ── Workspace Card ─────────────────────────────────────────────────────────────

interface WorkspaceCardProps {
  workspace: Workspace
  isActive: boolean
  currentUserId: string
  onSwitch: () => void
}

function WorkspaceCard({ workspace, isActive, currentUserId, onSwitch }: WorkspaceCardProps) {
  const router = useRouter()
  const plan = PLAN_META[workspace.plan] ?? PLAN_META.free
  const myMember = workspace.members.find((m) => m.id === currentUserId)
  const myRole = myMember?.role ?? 'editor'
  const role = ROLE_META[myRole] ?? ROLE_META.editor
  const gradient = wsGradient(workspace.name)
  const canManage = myRole === 'owner' || myRole === 'admin'

  return (
    <div
      className={cn(
        'group relative flex flex-col bg-card border rounded-2xl overflow-hidden transition-all duration-200',
        isActive
          ? 'border-brand/40 shadow-lg shadow-brand/10 ring-1 ring-brand/20'
          : 'border-border hover:border-border/80 hover:shadow-md',
      )}
    >
      {/* Plan color bar */}
      <div className={cn('h-1 w-full', plan.bar)} />

      {/* Card body */}
      <div className="p-5 flex-1 space-y-4">
        {/* Header: avatar + name */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-11 h-11 rounded-xl bg-gradient-to-br shrink-0 flex items-center justify-center text-white font-bold text-lg shadow-sm',
              gradient,
            )}
          >
            {workspace.name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-semibold text-foreground truncate leading-tight">
              {workspace.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">/{workspace.slug}</p>
          </div>
          {isActive && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-brand/15 rounded-full border border-brand/20 shrink-0">
              <Check className="w-3 h-3 text-brand" />
              <span className="text-[10px] font-semibold text-brand">Active</span>
            </div>
          )}
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 border font-medium', plan.color)}>
            {plan.label}
          </Badge>
          <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 border font-medium', role.color)}>
            {myRole === 'owner' && <Crown className="w-2.5 h-2.5 mr-1" />}
            {role.label}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-secondary/60 rounded-xl">
            <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {workspace.members.length}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {workspace.members.length === 1 ? 'member' : 'members'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-secondary/60 rounded-xl">
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {workspace.socialAccounts}/{workspace.socialAccountLimit}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">social accounts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border/60 flex items-center gap-2 bg-secondary/20">
        {isActive ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="w-3.5 h-3.5 text-brand" />
            <span>Currently active</span>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7 border-border/60"
            onClick={onSwitch}
          >
            Switch
            <ArrowRight className="w-3 h-3" />
          </Button>
        )}
        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground"
            onClick={() => router.push('/workspace-settings')}
          >
            <Settings className="w-3.5 h-3.5" />
            Manage
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Create Workspace Card ──────────────────────────────────────────────────────

function CreateWorkspaceCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center justify-center gap-3 bg-card border-2 border-dashed border-border hover:border-brand/40 rounded-2xl p-8 transition-all duration-200 hover:bg-brand/5 cursor-pointer min-h-[220px]"
    >
      <div className="w-12 h-12 rounded-xl border-2 border-dashed border-border group-hover:border-brand/40 flex items-center justify-center transition-colors">
        <Plus className="w-5 h-5 text-muted-foreground group-hover:text-brand transition-colors" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors">
          New Workspace
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Separate space for a client or project
        </p>
      </div>
    </button>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function WorkspacesPage() {
  const { workspaces, activeWorkspace, switchWorkspace, createWorkspace, isLoading } = useWorkspace()
  const { user } = useAuth()
  const router = useRouter()

  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const handleSwitch = (workspaceId: string) => {
    switchWorkspace(workspaceId)
    router.push('/dashboard')
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      await createWorkspace(newName.trim())
      setNewName('')
      setCreateOpen(false)
      router.push('/dashboard')
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create workspace')
    } finally {
      setCreating(false)
    }
  }

  if (isLoading && workspaces.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    )
  }

  const ownedCount = workspaces.filter((w) => w.isOwner).length

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Your Workspaces</h1>
          <p className="text-muted-foreground mt-1">
            {workspaces.length === 1
              ? 'You belong to 1 workspace'
              : `You belong to ${workspaces.length} workspaces`}
            {ownedCount > 0 && (
              <span className="text-muted-foreground/70">
                {' '}· {ownedCount} owned by you
              </span>
            )}
          </p>
        </div>
        <Button
          className="gap-2 bg-brand hover:bg-brand/90 text-white shrink-0"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="w-4 h-4" />
          New Workspace
        </Button>
      </div>

      {/* Empty state */}
      {workspaces.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <Layers className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No workspaces yet</h3>
          <p className="text-muted-foreground mt-1 max-w-xs">
            Create your first workspace to start managing social media accounts and collaborating with your team.
          </p>
          <Button
            className="mt-6 gap-2 bg-brand hover:bg-brand/90 text-white"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Create Workspace
          </Button>
        </div>
      )}

      {/* Workspace grid */}
      {workspaces.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              isActive={activeWorkspace?.id === ws.id}
              currentUserId={user?.id ?? ''}
              onSwitch={() => handleSwitch(ws.id)}
            />
          ))}
          <CreateWorkspaceCard onClick={() => setCreateOpen(true)} />
        </div>
      )}

      {/* Plan info banner */}
      <div className="bg-gradient-to-r from-brand/8 to-brand/4 border border-brand/15 rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Need more workspaces?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Free plan: 1 workspace · Starter: 3 · Pro: 10 · Enterprise: unlimited
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0 border-brand/30 text-brand hover:bg-brand/10"
          onClick={() => router.push('/pricing')}
        >
          <Crown className="w-3.5 h-3.5" />
          View Plans
        </Button>
      </div>

      {/* Create Workspace Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setNewName(''); setCreateError('') } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Each workspace has its own team, social accounts, and posts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Live preview of the workspace avatar */}
            {newName.trim() && (
              <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl">
                <div className={cn(
                  'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-base',
                  GRADIENTS[newName.charCodeAt(0) % GRADIENTS.length],
                )}>
                  {newName[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{newName.trim()}</p>
                  <p className="text-xs text-muted-foreground">Free Plan · Owner</p>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Workspace Name
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Corp, Side Project…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !creating && handleCreate()}
                autoFocus
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {createError && (
                <div className="flex items-start gap-1.5 mt-2">
                  <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{createError}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-brand hover:bg-brand/90 text-white"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                Create Workspace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
