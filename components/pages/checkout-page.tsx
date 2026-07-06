'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ShieldCheck, Lock, CreditCard, Loader2, AlertTriangle,
  CheckCircle2, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWorkspace } from '@/lib/workspace-context'
import { apiClient, ApiError } from '@/lib/api-client'

type Cycle = 'monthly' | 'yearly'

function formatPrice(value: number, currency: string): string {
  return `${value.toLocaleString('en-US')} ${currency}`
}

function isPaidPlan(p: string | null): p is 'pro' | 'enterprise' {
  return p === 'pro' || p === 'enterprise'
}

function isCycle(c: string | null): c is Cycle {
  return c === 'monthly' || c === 'yearly'
}

export function CheckoutPage() {
  const router = useRouter()
  const params = useSearchParams()
  const planParam = params.get('plan')
  const cycleParam = params.get('cycle')

  const { activeWorkspace, plans, currentUserRole } = useWorkspace()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plan = isPaidPlan(planParam) ? planParam : null
  const cycle: Cycle = isCycle(cycleParam) ? cycleParam : 'monthly'
  const planEntry = useMemo(
    () => plans.find((p) => p.plan === plan) ?? null,
    [plans, plan],
  )

  const price = planEntry
    ? cycle === 'yearly'
      ? planEntry.yearlyPrice
      : planEntry.monthlyPrice
    : 0
  const savings =
    planEntry && cycle === 'yearly' && planEntry.monthlyPrice > 0
      ? planEntry.monthlyPrice * 12 - planEntry.yearlyPrice
      : 0

  const canManageBilling = currentUserRole === 'owner' || currentUserRole === 'admin'
  const alreadyOnPlan = activeWorkspace?.plan === plan

  const blockingReason =
    !planEntry
      ? 'This plan is not recognized. Pick one from the pricing page.'
      : !activeWorkspace
      ? 'Pick a workspace before checking out.'
      : alreadyOnPlan
      ? `Your workspace is already on the ${planEntry.name} plan.`
      : !canManageBilling
      ? 'Only the workspace owner or an admin can manage billing.'
      : null

  const handlePay = async () => {
    if (!activeWorkspace || !planEntry || blockingReason) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await apiClient.post<{
        orderId: string
        paymentLink: string
        amount: number
        currency: 'TND'
      }>('/api/v1/billing/checkout', {
        workspaceId: activeWorkspace.id,
        plan: planEntry.plan,
        billingCycle: cycle,
      })
      // Hand off to Flouci's hosted page. The redirect-back URLs were set on
      // the server using FRONTEND_URL, so /billing/success?orderId=... will
      // run on our domain.
      window.location.href = result.paymentLink
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not start checkout. Please try again.'
      setError(msg)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Back link */}
        <button
          onClick={() => router.push('/pricing')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to plans
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left — order summary + checkout */}
          <div className="lg:col-span-3 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Checkout
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Review your order and complete payment securely with Flouci.
              </p>
            </div>

            {/* Order card */}
            <div className="border border-border rounded-2xl bg-card shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Order summary
                </p>
              </div>

              {planEntry ? (
                <>
                  <div className="px-6 py-5 flex items-start justify-between border-b border-border">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">
                          {planEntry.name} plan
                        </h3>
                        {planEntry.highlighted && (
                          <Badge className="bg-brand-soft text-brand border-0 text-[10px]">
                            Most popular
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {planEntry.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 capitalize">
                        Billing: {cycle}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-foreground tabular-nums">
                        {formatPrice(price, planEntry.currency)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {cycle === 'yearly' ? 'billed yearly' : 'billed monthly'}
                      </p>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="px-6 py-5 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      What's included
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                      {planEntry.features.map((f) => (
                        <div key={f} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                          <span className="text-sm text-foreground">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="px-6 py-5 space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-foreground tabular-nums">
                        {formatPrice(price, planEntry.currency)}
                      </span>
                    </div>
                    {savings > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-success">Yearly discount</span>
                        <span className="text-success tabular-nums">
                          −{formatPrice(savings, planEntry.currency)}
                        </span>
                      </div>
                    )}
                    <div className="h-px bg-border my-1" />
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                          Total due today
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          VAT included where applicable
                        </p>
                      </div>
                      <p className="text-3xl font-bold text-foreground tabular-nums">
                        {formatPrice(price, planEntry.currency)}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  Loading plan details…
                </div>
              )}
            </div>

            {/* Blocking reason (e.g. wrong role) */}
            {blockingReason && (
              <div className="border border-warning/30 bg-warning-soft text-warning rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Can't continue with this checkout</p>
                  <p className="text-xs mt-0.5 text-warning/90">{blockingReason}</p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="border border-destructive/30 bg-destructive/10 text-destructive rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Checkout failed</p>
                  <p className="text-xs mt-0.5 text-destructive/90">{error}</p>
                </div>
              </div>
            )}

            {/* Pay button */}
            <Button
              onClick={handlePay}
              disabled={submitting || !!blockingReason}
              className="w-full h-12 text-base font-semibold gap-2 bg-brand hover:bg-brand/90 text-white shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redirecting to Flouci…
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Pay {planEntry ? formatPrice(price, planEntry.currency) : '—'} securely
                </>
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center">
              You'll be redirected to Flouci's secure payment page. We never see or store
              your card details.
            </p>
          </div>

          {/* Right — trust panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="border border-border rounded-2xl bg-card shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-success" />
                <p className="text-sm font-semibold text-foreground">Secure checkout</p>
              </div>
              <ul className="space-y-3">
                <TrustRow
                  icon={<Lock className="w-3.5 h-3.5" />}
                  title="End-to-end encryption"
                  description="All payment data is encrypted in transit (TLS 1.3) between you and Flouci."
                />
                <TrustRow
                  icon={<CreditCard className="w-3.5 h-3.5" />}
                  title="PCI-DSS compliant processor"
                  description="Flouci is a licensed Tunisian payment institution. Card details never touch our servers."
                />
                <TrustRow
                  icon={<Sparkles className="w-3.5 h-3.5" />}
                  title="Cancel any time"
                  description="Downgrade back to the Free plan whenever you want. No long-term contracts."
                />
              </ul>
            </div>

            <div className="border border-border rounded-2xl bg-secondary/40 p-5 text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Need help?</p>
              <p>
                Email{' '}
                <span className="text-foreground">billing@postly.io</span> and we'll
                respond within 24h.
              </p>
              <p className="pt-2 border-t border-border">
                Workspace:{' '}
                <span className="text-foreground font-medium">
                  {activeWorkspace?.name ?? '—'}
                </span>
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground uppercase tracking-widest">
              <Link href="/pricing" className="hover:text-foreground transition-colors">
                Compare plans
              </Link>
              <span aria-hidden>·</span>
              <Link href="/billing" className="hover:text-foreground transition-colors">
                Billing history
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TrustRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <li className="flex gap-3">
      <div className="w-7 h-7 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0 text-muted-foreground mt-0.5">
        {icon}
      </div>
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </li>
  )
}
