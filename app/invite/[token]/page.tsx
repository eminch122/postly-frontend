'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import { useWorkspace } from '@/lib/workspace-context'
import { CheckCircle, XCircle, Loader2, Users, Mail, Crown, ArrowRight, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface InvitePreview {
  invitationId: string
  email: string
  role: string
  workspace: { id: string; name: string; slug: string }
  inviterName: string
  expiresAt: string
}

type PageState =
  | { status: 'loading' }
  | { status: 'preview'; data: InvitePreview }
  | { status: 'accepting' }
  | { status: 'accepted'; workspaceName: string }
  | { status: 'error'; message: string; gone?: boolean }

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AcceptInvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params?.token as string
  const { isAuthenticated, user, isLoading: authLoading, refreshUser } = useAuth()
  const { fetchWorkspace } = useWorkspace()

  const [state, setState] = useState<PageState>({ status: 'loading' })

  // Validate the token first
  useEffect(() => {
    if (!token) return
    apiClient
      .get<InvitePreview>(`/api/v1/workspaces/invite/${token}`)
      .then((data) => setState({ status: 'preview', data }))
      .catch((err: ApiError) => {
        const gone = err.status === 410
        setState({
          status: 'error',
          message: gone
            ? 'This invitation has expired or was already used.'
            : err.status === 404
            ? 'Invitation not found.'
            : 'Something went wrong. Please try again.',
          gone,
        })
      })
  }, [token])

  const handleAccept = async () => {
    if (!isAuthenticated) {
      router.push(`/signup?invite=${token}`)
      return
    }

    setState((s) => ({ ...s, status: 'accepting' }))
    try {
      await apiClient.post(`/api/v1/workspaces/invite/${token}/accept`)
      const preview = state.status === 'preview' ? state.data.workspace.name : 'your new workspace'
      // refreshUser re-fetches /api/v1/users/me which now has onboardingCompleted:true
      // — this flips the postly_session cookie to 'active' so the middleware
      // won't bounce to /onboarding on the dashboard redirect.
      await refreshUser()
      await fetchWorkspace()
      setState({ status: 'accepted', workspaceName: preview })
    } catch (err: unknown) {
      const apiErr = err as ApiError
      setState({
        status: 'error',
        message: apiErr?.message ?? 'Failed to accept invitation. Please try again.',
      })
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (authLoading || state.status === 'loading') {
    return <LoadingState />
  }

  if (state.status === 'error') {
    return <ErrorState message={state.message} gone={state.gone} />
  }

  if (state.status === 'accepted') {
    return <SuccessState workspaceName={state.workspaceName} />
  }

  const preview = state.status === 'preview' || state.status === 'accepting' ? (state as { status: 'preview' | 'accepting'; data: InvitePreview }).data : null
  const isAccepting = state.status === 'accepting'

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
          {/* Header gradient */}
          <div className="bg-gradient-to-r from-brand/20 via-brand/10 to-transparent border-b border-border px-8 py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand/20 border border-brand/30 mb-4">
              <Users className="w-8 h-8 text-brand" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">You're invited!</h1>
            <p className="text-muted-foreground text-sm mt-1">Join a workspace on Postly</p>
          </div>

          {/* Body */}
          <div className="px-8 py-6 space-y-5">
            {/* Workspace info */}
            <div className="bg-secondary/50 border border-border/60 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-brand/60 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {preview?.workspace.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-lg">{preview?.workspace.name}</p>
                  <p className="text-xs text-muted-foreground">postly.app/{preview?.workspace.slug}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Invited by</p>
                    <p className="text-xs font-medium text-foreground">{preview?.inviterName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Crown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Your role</p>
                    <p className="text-xs font-medium text-foreground capitalize">{preview?.role}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Email mismatch warning */}
            {isAuthenticated && user && preview && user.email.toLowerCase() !== preview.email.toLowerCase() && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-600">
                ⚠️ This invite was sent to <strong>{preview.email}</strong>, but you're logged in as <strong>{user.email}</strong>. Please log in with the correct account.
              </div>
            )}

            {/* CTA */}
            {isAuthenticated ? (
              <Button
                className="w-full bg-brand hover:bg-brand/90 text-white gap-2 h-11"
                onClick={handleAccept}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Accept & Join Workspace</>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <Button
                  className="w-full bg-brand hover:bg-brand/90 text-white gap-2 h-11"
                  onClick={() => router.push(`/signup?invite=${token}`)}
                >
                  <ArrowRight className="w-4 h-4" /> Create Account & Join
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 h-11"
                  onClick={() => router.push(`/login?invite=${token}`)}
                >
                  <LogIn className="w-4 h-4" /> Sign In & Join
                </Button>
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Invite expires: {preview?.expiresAt ? new Date(preview.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Postly · Social Media Management
        </p>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 text-brand animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Loading invitation…</p>
      </div>
    </div>
  )
}

function ErrorState({ message, gone }: { message: string; gone?: boolean }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 text-center space-y-4 shadow-2xl">
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <XCircle className="w-7 h-7 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {gone ? 'Invitation Unavailable' : 'Something Went Wrong'}
        </h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Link href="/dashboard">
          <Button variant="outline" className="w-full">Go to Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}

function SuccessState({ workspaceName }: { workspaceName: string }) {
  const router = useRouter()
  useEffect(() => {
    // Use replace so the invite page is removed from history
    const t = setTimeout(() => router.replace('/dashboard'), 2500)
    return () => clearTimeout(t)
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 text-center space-y-4 shadow-2xl">
        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
          <CheckCircle className="w-7 h-7 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground">You're in! 🎉</h2>
        <p className="text-sm text-muted-foreground">
          You've successfully joined <strong className="text-foreground">{workspaceName}</strong>.
          Redirecting to your dashboard…
        </p>
        <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-brand animate-[grow_3s_linear_forwards]" style={{ width: '0%', animation: 'width 3s linear forwards' }} />
        </div>
      </div>
    </div>
  )
}
