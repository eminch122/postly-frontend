'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2, Loader2, AlertTriangle, ArrowRight, Sparkles, Receipt,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/lib/workspace-context'
import { apiClient, ApiError } from '@/lib/api-client'

interface VerifyResponse {
  status: 'completed' | 'pending' | 'failed'
  order: {
    id: string
    plan: 'pro' | 'enterprise'
    billingCycle: 'monthly' | 'yearly'
    amount: number
    currency: 'TND'
    status: string
    periodEnd: string | null
  }
}

type ScreenState =
  | { kind: 'verifying' }
  | { kind: 'success'; data: VerifyResponse }
  | { kind: 'failed'; reason: string }
  | { kind: 'missing' }

export function CheckoutSuccessPage() {
  const params = useSearchParams()
  const router = useRouter()
  const orderId = params.get('orderId')
  const { fetchWorkspaces } = useWorkspace()
  const [state, setState] = useState<ScreenState>(
    orderId ? { kind: 'verifying' } : { kind: 'missing' },
  )

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiClient.post<VerifyResponse>('/api/v1/billing/verify', {
          orderId,
        })
        if (cancelled) return
        if (res.status === 'completed') {
          // Refresh workspace so the new plan / limits propagate everywhere
          // before the user clicks through to anything plan-gated.
          await fetchWorkspaces()
          if (cancelled) return
          setState({ kind: 'success', data: res })
        } else {
          setState({
            kind: 'failed',
            reason:
              res.status === 'pending'
                ? "Flouci hasn't confirmed your payment yet. Try refreshing in a moment."
                : 'Flouci reported the payment as unsuccessful.',
          })
        }
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof ApiError ? err.message : 'Could not verify your payment.'
        setState({ kind: 'failed', reason: msg })
      }
    })()
    return () => {
      cancelled = true
    }
    // fetchWorkspaces is stable from useCallback in the context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        {state.kind === 'verifying' && (
          <Card>
            <div className="w-14 h-14 rounded-full bg-secondary border border-border flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-brand animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-foreground mt-5">Verifying your payment…</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Hang tight — we're confirming your transaction with Flouci. This usually
              takes just a few seconds.
            </p>
          </Card>
        )}

        {state.kind === 'success' && (
          <Card>
            <div className="w-14 h-14 rounded-full bg-success/15 border border-success/30 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-success" />
            </div>
            <div className="mt-5">
              <h1 className="text-xl font-bold text-foreground">Payment successful</h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Your workspace is now on the{' '}
                <span className="font-semibold text-foreground capitalize">
                  {state.data.order.plan}
                </span>{' '}
                plan. All AI features and your upgraded limits are unlocked.
              </p>
            </div>

            <div className="mt-5 w-full border border-border rounded-xl bg-secondary/40 px-4 py-3 space-y-1.5">
              <Row label="Plan" value={`${state.data.order.plan} (${state.data.order.billingCycle})`} capitalize />
              <Row
                label="Amount"
                value={`${state.data.order.amount.toLocaleString('en-US')} ${state.data.order.currency}`}
              />
              {state.data.order.periodEnd && (
                <Row
                  label="Valid until"
                  value={new Date(state.data.order.periodEnd).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                />
              )}
              <Row label="Order ID" value={state.data.order.id} mono />
            </div>

            <div className="mt-5 flex flex-col gap-2 w-full">
              <Button
                onClick={() => router.push('/compose')}
                className="w-full gap-2 bg-brand hover:bg-brand/90 text-white"
              >
                <Sparkles className="w-4 h-4" />
                Try the AI tools
              </Button>
              <Button variant="outline" asChild className="w-full gap-2">
                <Link href="/billing">
                  <Receipt className="w-4 h-4" />
                  View billing history
                </Link>
              </Button>
            </div>
          </Card>
        )}

        {state.kind === 'failed' && (
          <Card>
            <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground mt-5">We couldn't confirm your payment</h1>
            <p className="text-sm text-muted-foreground mt-1.5">{state.reason}</p>
            <div className="mt-5 flex flex-col gap-2 w-full">
              <Button asChild className="w-full gap-2 bg-brand hover:bg-brand/90 text-white">
                <Link href="/pricing">
                  Try again
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button variant="ghost" asChild className="w-full text-muted-foreground">
                <Link href="/billing">Back to billing</Link>
              </Button>
            </div>
          </Card>
        )}

        {state.kind === 'missing' && (
          <Card>
            <div className="w-14 h-14 rounded-full bg-secondary border border-border flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground mt-5">No order to verify</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              This page is reached after a successful Flouci payment. There's nothing
              to verify if you opened it directly.
            </p>
            <Button asChild className="mt-5 w-full gap-2">
              <Link href="/pricing">
                Go to plans
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </Card>
        )}
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm px-7 py-7 flex flex-col items-center text-center">
      {children}
    </div>
  )
}

function Row({
  label,
  value,
  capitalize,
  mono,
}: {
  label: string
  value: string
  capitalize?: boolean
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={[
          'text-foreground font-medium text-right',
          capitalize ? 'capitalize' : '',
          mono ? 'font-mono text-[11px]' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {value}
      </span>
    </div>
  )
}
