import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * postly_session cookie (non-httpOnly, set by auth-context.tsx):
 *   undefined  → not authenticated
 *   "pending"  → authenticated, onboarding not completed
 *   "active"   → authenticated + onboarding completed
 *
 * The real security token is the httpOnly refreshToken cookie managed by
 * the Express backend. This cookie is ONLY used for routing decisions.
 */
const SESSION_COOKIE = 'postly_session'

// Routes authenticated users must be bounced away from
const GUEST_ONLY = new Set(['/', '/login', '/signup', '/forgot-password'])

// Dashboard route prefixes — require auth + completed onboarding
const DASHBOARD_PREFIXES = [
  '/dashboard', '/calendar', '/compose', '/insights',
  '/analytics', '/settings', '/billing', '/team',
  '/media-library', '/brand-voice', '/trends-lab',
  '/workspace-settings', '/pricing',
]

// Routes that must always pass through regardless of auth state
const PUBLIC_PREFIXES = ['/oauth-callback', '/invite']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get(SESSION_COOKIE)?.value

  const isAuth = !!session
  const isDone = session === 'active'

  // ── Always-public routes (OAuth callback landing, invite pages) ───────────
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // ── Guest-only (landing, login, signup, forgot-password) ──────────────────
  if (GUEST_ONLY.has(pathname)) {
    if (isAuth) {
      return NextResponse.redirect(
        new URL(isDone ? '/dashboard' : '/onboarding', request.url)
      )
    }
    return NextResponse.next()
  }

  // ── /onboarding ───────────────────────────────────────────────────────────
  if (pathname.startsWith('/onboarding')) {
    if (!isAuth) return NextResponse.redirect(new URL('/login', request.url))
    if (isDone) return NextResponse.redirect(new URL('/dashboard', request.url))
    return NextResponse.next()
  }

  // ── Dashboard routes ──────────────────────────────────────────────────────
  if (DASHBOARD_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!isAuth) return NextResponse.redirect(new URL('/login', request.url))
    if (!isDone) return NextResponse.redirect(new URL('/onboarding', request.url))
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
