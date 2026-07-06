'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronsUpDown, Check, Plus, Layers, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWorkspace } from '@/lib/workspace-context'
import { ApiError } from '@/lib/api-client'
import { cn } from '@/lib/utils'

const GRADIENTS = [
  'from-violet-500 to-blue-500',
  'from-rose-500 to-orange-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-yellow-500',
  'from-sky-500 to-cyan-500',
  'from-fuchsia-500 to-pink-500',
]

export function workspaceGradient(name: string) {
  return GRADIENTS[name.charCodeAt(0) % GRADIENTS.length]
}

const PLAN_LABELS: Record<string, string> = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' }

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const router = useRouter()
  const { workspaces, activeWorkspace, switchWorkspace, createWorkspace } = useWorkspace()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

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

  if (!activeWorkspace) return null

  const gradient = workspaceGradient(activeWorkspace.name)

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-2 w-full rounded-md hover:bg-sidebar-accent transition-colors text-left',
              collapsed ? 'justify-center p-1.5' : 'px-2 py-1.5',
            )}
            title={collapsed ? activeWorkspace.name : undefined}
          >
            <div
              className={cn(
                'rounded-md bg-gradient-to-br shrink-0 flex items-center justify-center text-white font-bold',
                gradient,
                collapsed ? 'w-7 h-7 text-sm' : 'w-6 h-6 text-xs',
              )}
            >
              {activeWorkspace.name[0].toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">
                    {activeWorkspace.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {PLAN_LABELS[activeWorkspace.plan] ?? 'Free'} Plan
                  </p>
                </div>
                <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          side={collapsed ? 'right' : 'bottom'}
          sideOffset={collapsed ? 8 : 4}
          className="w-58 p-1"
        >
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Workspaces
          </p>

          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onSelect={() => {
                switchWorkspace(ws.id)
                setDropdownOpen(false)
              }}
              className="flex items-center gap-2 cursor-pointer rounded-md"
            >
              <div
                className={cn(
                  'w-5 h-5 rounded bg-gradient-to-br shrink-0 flex items-center justify-center text-white text-[11px] font-bold',
                  workspaceGradient(ws.name),
                )}
              >
                {ws.name[0].toUpperCase()}
              </div>
              <span className="flex-1 truncate text-sm">{ws.name}</span>
              {ws.plan !== 'free' && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 capitalize">
                  {PLAN_LABELS[ws.plan]}
                </Badge>
              )}
              {activeWorkspace.id === ws.id && (
                <Check className="w-3.5 h-3.5 text-brand shrink-0" />
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={() => {
              setCreateOpen(true)
              setDropdownOpen(false)
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">New Workspace</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => {
              router.push('/workspaces')
              setDropdownOpen(false)
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">Manage Workspaces</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Workspace Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Workspace</DialogTitle>
            <DialogDescription>
              Create a separate space for a client, project, or brand.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
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
                <p className="text-xs text-destructive mt-1.5">{createError}</p>
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
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
