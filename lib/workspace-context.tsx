'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { apiClient } from './api-client'
import { useAuth } from './auth-context'
import { roleHas, Capability } from './permissions'

// ── Types ──────────────────────────────────────────────────────────────────────

export type PlanType = 'free' | 'pro' | 'enterprise'
export type UserRole = 'owner' | 'admin' | 'editor' | 'reviewer'

/** Capability flags gated by plan. Mirror of backend PlanFeatureFlag. */
export type PlanFeatureFlag = 'ai:tools'

export interface WorkspaceMember {
  id: string
  name: string
  email: string
  role: UserRole
  joinedAt: string
  avatar?: string | null
}

export interface PendingInvite {
  id: string
  email: string
  role: UserRole
  sentAt: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  plan: PlanType
  members: WorkspaceMember[]
  memberLimit: number
  socialAccounts: number
  socialAccountLimit: number
  createdAt: string
  pendingInvites: PendingInvite[]
  isOwner: boolean
}

export interface PlanCatalogEntry {
  plan: PlanType
  name: string
  description: string
  currency: 'TND'
  monthlyPrice: number
  yearlyPrice: number
  // -1 means unlimited
  workspaceLimit: number
  socialAccountLimit: number
  memberLimit: number
  features: string[]
  featureFlags: PlanFeatureFlag[]
  highlighted: boolean
}

export interface SubscriptionInfo {
  plan: PlanType
  monthlyPrice: number
  yearlyPrice: number
  currency: 'TND'
  memberLimit: number
  accountLimit: number
  features: string[]
}

interface WorkspaceContextType {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  switchWorkspace: (workspaceId: string) => void
  createWorkspace: (name: string) => Promise<Workspace>
  fetchWorkspaces: () => Promise<void>
  // Legacy aliases
  workspace: Workspace | null
  fetchWorkspace: () => Promise<void>
  // Meta
  plans: PlanCatalogEntry[]
  subscriptionInfo: SubscriptionInfo | null
  isLoading: boolean
  setWorkspace: (workspace: Workspace) => void
  currentUserRole: UserRole | null
  can: (capability: Capability) => boolean
  // Member actions
  inviteMember: (email: string, role?: UserRole) => Promise<void>
  revokeInvite: (inviteId: string) => Promise<void>
  removeMember: (userId: string) => Promise<void>
  // Workspace lifecycle
  updateWorkspaceName: (name: string) => Promise<void>
  deleteWorkspace: (workspaceId: string) => Promise<void>
  leaveWorkspace: (workspaceId: string) => Promise<void>
  // Plan-based feature gating. Returns true if the active workspace's plan
  // includes the given capability flag. Falls back to false when there is no
  // active workspace (denied by default).
  hasFeature: (feature: PlanFeatureFlag) => boolean
}

// ── Fallback plan catalog ──────────────────────────────────────────────────────
// Used when the /api/v1/plans request hasn't completed yet (or fails). Numbers
// must stay in sync with the backend's workspace-plan.helper.ts, which is the
// real source of truth — this is just a "render-while-loading" stub.

const FALLBACK_PLANS: PlanCatalogEntry[] = [
  {
    plan: 'free',
    name: 'Free',
    description: 'Perfect for getting started.',
    currency: 'TND',
    monthlyPrice: 0,
    yearlyPrice: 0,
    workspaceLimit: 1,
    socialAccountLimit: 1,
    memberLimit: 1,
    features: ['1 workspace', '1 social account', '1 team member'],
    featureFlags: [],
    highlighted: false,
  },
  {
    plan: 'pro',
    name: 'Pro',
    description: 'For growing teams that publish daily.',
    currency: 'TND',
    monthlyPrice: 89,
    yearlyPrice: 890,
    workspaceLimit: 3,
    socialAccountLimit: 5,
    memberLimit: 5,
    features: ['3 workspaces', '5 social accounts', 'Team of 5'],
    featureFlags: ['ai:tools'],
    highlighted: true,
  },
  {
    plan: 'enterprise',
    name: 'Enterprise',
    description: 'For agencies and large-scale operations.',
    currency: 'TND',
    monthlyPrice: 299,
    yearlyPrice: 2990,
    workspaceLimit: -1,
    socialAccountLimit: 50,
    memberLimit: 50,
    features: ['Unlimited workspaces', '50 social accounts', 'Team of 50'],
    featureFlags: ['ai:tools'],
    highlighted: false,
  },
]

// ── Context ────────────────────────────────────────────────────────────────────

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

const ACTIVE_WORKSPACE_KEY = 'postly_active_workspace'

// ── API response shape ────────────────────────────────────────────────────────

interface ApiWorkspace {
  id: string
  name: string
  slug: string
  plan: PlanType
  socialAccountLimit: number
  memberLimit?: number
  socialAccounts?: number
  createdAt: string
  members: WorkspaceMember[]
  pendingInvites: PendingInvite[]
  isOwner: boolean
}

function mapWorkspace(raw: ApiWorkspace, plans: PlanCatalogEntry[]): Workspace {
  const planEntry = plans.find((p) => p.plan === raw.plan) ?? plans[0]
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    plan: raw.plan,
    members: raw.members,
    memberLimit: raw.memberLimit ?? planEntry?.memberLimit ?? 1,
    socialAccounts: raw.socialAccounts ?? 0,
    socialAccountLimit: raw.socialAccountLimit,
    createdAt: raw.createdAt,
    pendingInvites: raw.pendingInvites ?? [],
    isOwner: raw.isOwner,
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, onboardingComplete, user } = useAuth()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [plans, setPlans] = useState<PlanCatalogEntry[]>(FALLBACK_PLANS)

  useEffect(() => {
    const stored = localStorage.getItem(ACTIVE_WORKSPACE_KEY)
    if (stored) setActiveWorkspaceId(stored)
  }, [])

  // Plans are public — no auth required. Fetch once on mount.
  useEffect(() => {
    apiClient
      .get<PlanCatalogEntry[]>('/api/v1/plans')
      .then((data) => {
        if (Array.isArray(data) && data.length) setPlans(data)
      })
      .catch(() => {
        // Keep fallback. Plans are render-while-loading data, not load-bearing.
      })
  }, [])

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true)
    try {
      const raw = await apiClient.get<ApiWorkspace[]>('/api/v1/workspaces')
      const mapped = raw.map((r) => mapWorkspace(r, plans))
      setWorkspaces(mapped)

      setActiveWorkspaceId((prev) => {
        const stored = localStorage.getItem(ACTIVE_WORKSPACE_KEY)
        if (prev && mapped.find((w) => w.id === prev)) return prev
        if (stored && mapped.find((w) => w.id === stored)) return stored
        return mapped[0]?.id ?? null
      })
    } catch {
      setWorkspaces([])
    } finally {
      setIsLoading(false)
    }
  }, [plans])

  useEffect(() => {
    if (isAuthenticated && onboardingComplete) {
      fetchWorkspaces()
    }
  }, [isAuthenticated, onboardingComplete, fetchWorkspaces])

  const switchWorkspace = useCallback((workspaceId: string) => {
    setActiveWorkspaceId(workspaceId)
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId)
  }, [])

  const createWorkspace = async (name: string): Promise<Workspace> => {
    const raw = await apiClient.post<ApiWorkspace>('/api/v1/workspaces', { name })
    const mapped = mapWorkspace(raw, plans)
    setWorkspaces((prev) => [...prev, mapped])
    switchWorkspace(mapped.id)
    return mapped
  }

  const setWorkspace = (ws: Workspace) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? ws : w)))
    setActiveWorkspaceId(ws.id)
  }

  // ── Workspace actions ──────────────────────────────────────────────────────

  const inviteMember = async (email: string, role: UserRole = 'editor') => {
    if (!activeWorkspace) return
    await apiClient.post('/api/v1/workspaces/invite', {
      email,
      role,
      workspaceId: activeWorkspace.id,
    })
    await fetchWorkspaces()
  }

  const revokeInvite = async (inviteId: string) => {
    await apiClient.delete(`/api/v1/workspaces/invite/${inviteId}`)
    await fetchWorkspaces()
  }

  const removeMember = async (userId: string) => {
    if (!activeWorkspace) return
    await apiClient.delete(`/api/v1/workspaces/${activeWorkspace.id}/members/${userId}`)
    await fetchWorkspaces()
  }

  const updateWorkspaceName = async (name: string) => {
    if (!activeWorkspace) return
    await apiClient.put(`/api/v1/workspaces/${activeWorkspace.id}`, { name })
    await fetchWorkspaces()
  }

  const deleteWorkspace = async (workspaceId: string) => {
    await apiClient.delete(`/api/v1/workspaces/${workspaceId}`)
    setWorkspaces((prev) => {
      const next = prev.filter((w) => w.id !== workspaceId)
      if (activeWorkspaceId === workspaceId) {
        const fallback = next[0]?.id ?? null
        setActiveWorkspaceId(fallback)
        if (fallback) localStorage.setItem(ACTIVE_WORKSPACE_KEY, fallback)
        else localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
      }
      return next
    })
  }

  const leaveWorkspace = async (workspaceId: string) => {
    await apiClient.post(`/api/v1/workspaces/${workspaceId}/leave`)
    setWorkspaces((prev) => {
      const next = prev.filter((w) => w.id !== workspaceId)
      if (activeWorkspaceId === workspaceId) {
        const fallback = next[0]?.id ?? null
        setActiveWorkspaceId(fallback)
        if (fallback) localStorage.setItem(ACTIVE_WORKSPACE_KEY, fallback)
        else localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
      }
      return next
    })
  }

  const activePlanEntry = activeWorkspace
    ? plans.find((p) => p.plan === activeWorkspace.plan)
    : null

  // ── Feature gating ──────────────────────────────────────────────────────────

  const hasFeature = useCallback(
    (feature: PlanFeatureFlag): boolean => {
      if (!activePlanEntry) return false
      return activePlanEntry.featureFlags.includes(feature)
    },
    [activePlanEntry],
  )

  const subscriptionInfo: SubscriptionInfo | null = activePlanEntry
    ? {
        plan: activePlanEntry.plan,
        monthlyPrice: activePlanEntry.monthlyPrice,
        yearlyPrice: activePlanEntry.yearlyPrice,
        currency: activePlanEntry.currency,
        memberLimit: activePlanEntry.memberLimit,
        accountLimit: activePlanEntry.socialAccountLimit,
        features: activePlanEntry.features,
      }
    : null

  const currentUserRole: UserRole | null =
    activeWorkspace && user?.id
      ? activeWorkspace.members.find((m) => m.id === user.id)?.role ?? null
      : null

  const can = useCallback(
    (capability: Capability) => roleHas(currentUserRole, capability),
    [currentUserRole],
  )

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        switchWorkspace,
        createWorkspace,
        fetchWorkspaces,
        workspace: activeWorkspace,
        fetchWorkspace: fetchWorkspaces,
        plans,
        subscriptionInfo,
        isLoading,
        setWorkspace,
        currentUserRole,
        can,
        inviteMember,
        revokeInvite,
        removeMember,
        updateWorkspaceName,
        deleteWorkspace,
        leaveWorkspace,
        hasFeature,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}
