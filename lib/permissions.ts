// Mirror of social-media-backend/.../permissions.helper.ts.
// Keep in sync when capabilities change.

import { UserRole } from './workspace-context'

export type Capability =
  | 'workspace:delete'
  | 'workspace:update'
  | 'workspace:manage_billing'
  | 'members:invite'
  | 'members:remove'
  | 'members:change_role'
  | 'accounts:connect'
  | 'accounts:disconnect'
  | 'posts:create'
  | 'posts:edit_any'
  | 'posts:edit_own'
  | 'posts:delete_any'
  | 'posts:delete_own'
  | 'posts:submit_for_review'
  | 'posts:approve'
  | 'posts:publish'
  | 'posts:schedule'
  | 'analytics:view'
  | 'analytics:export'

export const ROLE_LEVEL: Record<UserRole, number> = {
  reviewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
}

const ROLE_CAPABILITIES: Record<UserRole, ReadonlySet<Capability>> = {
  owner: new Set<Capability>([
    'workspace:delete', 'workspace:update', 'workspace:manage_billing',
    'members:invite', 'members:remove', 'members:change_role',
    'accounts:connect', 'accounts:disconnect',
    'posts:create', 'posts:edit_any', 'posts:edit_own',
    'posts:delete_any', 'posts:delete_own',
    'posts:submit_for_review', 'posts:approve',
    'posts:publish', 'posts:schedule',
    'analytics:view', 'analytics:export',
  ]),
  admin: new Set<Capability>([
    'workspace:update',
    'members:invite', 'members:remove', 'members:change_role',
    'accounts:connect', 'accounts:disconnect',
    'posts:create', 'posts:edit_any', 'posts:edit_own',
    'posts:delete_any', 'posts:delete_own',
    'posts:submit_for_review', 'posts:approve',
    'posts:publish', 'posts:schedule',
    'analytics:view', 'analytics:export',
  ]),
  editor: new Set<Capability>([
    'posts:create', 'posts:edit_own', 'posts:delete_own',
    'posts:submit_for_review',
    'analytics:view',
  ]),
  reviewer: new Set<Capability>([
    'posts:approve',
    'analytics:view',
  ]),
}

export function roleHas(role: UserRole | null | undefined, capability: Capability): boolean {
  if (!role) return false
  return ROLE_CAPABILITIES[role]?.has(capability) ?? false
}

/**
 * The set of roles a user can assign during invitation or role change.
 * Mirrors backend rule: strictly lower level only, owner never assignable.
 */
export function assignableRoles(inviterRole: UserRole | null | undefined): UserRole[] {
  if (!inviterRole) return []
  const inviterLevel = ROLE_LEVEL[inviterRole]
  return (Object.keys(ROLE_LEVEL) as UserRole[])
    .filter((r) => r !== 'owner' && ROLE_LEVEL[r] < inviterLevel)
    .sort((a, b) => ROLE_LEVEL[b] - ROLE_LEVEL[a])
}

/**
 * Human-readable, role-by-role permission matrix used by the Team page.
 * Derived from the same capability map so it never drifts from enforcement.
 */
export const PERMISSION_MATRIX: { label: string; capability: Capability }[] = [
  { label: 'Create & edit own posts', capability: 'posts:create' },
  { label: 'Edit any post', capability: 'posts:edit_any' },
  { label: 'Submit posts for review', capability: 'posts:submit_for_review' },
  { label: 'Approve / reject posts', capability: 'posts:approve' },
  { label: 'Schedule posts', capability: 'posts:schedule' },
  { label: 'Publish posts', capability: 'posts:publish' },
  { label: 'View analytics', capability: 'analytics:view' },
  { label: 'Export analytics', capability: 'analytics:export' },
  { label: 'Connect / disconnect accounts', capability: 'accounts:connect' },
  { label: 'Manage team (invite / remove)', capability: 'members:invite' },
  { label: 'Rename workspace', capability: 'workspace:update' },
  { label: 'Manage billing', capability: 'workspace:manage_billing' },
  { label: 'Delete workspace', capability: 'workspace:delete' },
]
