'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWorkspace, PlanCatalogEntry } from '@/lib/workspace-context'
import { cn } from '@/lib/utils'

type BillingCycle = 'monthly' | 'yearly'

function formatPrice(value: number, currency: string): string {
  // Tunisian convention: whole dinars for plan prices, no decimals.
  return `${value.toLocaleString('en-US')} ${currency}`
}

function effectiveMonthly(plan: PlanCatalogEntry, cycle: BillingCycle): number {
  if (cycle === 'monthly') return plan.monthlyPrice
  return Math.round(plan.yearlyPrice / 12)
}

function yearlySavingsPercent(plan: PlanCatalogEntry): number {
  if (!plan.monthlyPrice) return 0
  const monthlyOverYear = plan.monthlyPrice * 12
  if (!monthlyOverYear) return 0
  const saved = monthlyOverYear - plan.yearlyPrice
  return Math.round((saved / monthlyOverYear) * 100)
}

export function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const { workspace, plans } = useWorkspace()
  const router = useRouter()

  const proSavings = yearlySavingsPercent(
    plans.find((p) => p.plan === 'pro') ?? plans[0],
  )

  const handleChoosePlan = (planId: PlanCatalogEntry['plan']) => {
    if (planId === 'free') return
    router.push(`/billing/checkout?plan=${planId}&cycle=${billingCycle}`)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
          Simple, transparent pricing
        </h1>
        <p className="text-base text-muted-foreground max-w-2xl mx-auto">
          Choose the plan that fits your team. Upgrade or downgrade anytime — no contracts, no surprises.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-1 p-1 bg-secondary border border-border rounded-full">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'px-5 py-1.5 rounded-full text-sm font-medium transition-all',
              billingCycle === 'monthly'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            className={cn(
              'px-5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2',
              billingCycle === 'yearly'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Yearly
            {proSavings > 0 && (
              <Badge className="bg-success-soft text-success border-0 text-[10px] font-semibold">
                Save {proSavings}%
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const isCurrent = workspace?.plan === plan.plan
          const monthly = effectiveMonthly(plan, billingCycle)
          return (
            <div
              key={plan.plan}
              className={cn(
                'relative border rounded-2xl p-6 flex flex-col transition-all bg-card',
                plan.highlighted
                  ? 'border-brand shadow-lg shadow-brand/10 md:scale-[1.02]'
                  : 'border-border hover:border-border/80',
              )}
            >
              {plan.highlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white border-0 text-[11px] font-semibold px-3 py-1 shadow-sm">
                  Most popular
                </Badge>
              )}

              {/* Header */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  {isCurrent && (
                    <Badge className="bg-secondary text-muted-foreground border-0 text-[10px]">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="py-6">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold text-foreground tabular-nums">
                    {monthly.toLocaleString('en-US')}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    {plan.currency} / month
                  </span>
                </div>
                {billingCycle === 'yearly' && plan.yearlyPrice > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Billed {formatPrice(plan.yearlyPrice, plan.currency)} annually
                  </p>
                )}
                {plan.monthlyPrice === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Free forever</p>
                )}
              </div>

              {/* Features */}
              <div className="space-y-2.5 flex-1 border-t border-border pt-5">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Button
                className={cn(
                  'w-full h-10 gap-2 mt-6',
                  plan.highlighted
                    ? 'bg-brand hover:bg-brand/90 text-white'
                    : 'bg-secondary hover:bg-secondary/80 text-foreground border border-border',
                )}
                disabled={isCurrent || plan.plan === 'free'}
                onClick={() => handleChoosePlan(plan.plan)}
                title={
                  isCurrent
                    ? 'You are on this plan'
                    : plan.plan === 'free'
                    ? 'Free is the default — no checkout needed'
                    : undefined
                }
              >
                {isCurrent ? (
                  'Your current plan'
                ) : plan.plan === 'free' ? (
                  'Free forever'
                ) : (
                  <>
                    Choose {plan.name}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          )
        })}
      </div>

      {/* Trust strip */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="w-3.5 h-3.5 text-brand" />
        <span>All prices in Tunisian Dinar (TND). VAT included where applicable.</span>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto space-y-4">
        <h3 className="text-lg font-bold text-foreground">Frequently asked questions</h3>
        <div className="space-y-3">
          {[
            {
              q: 'Can I change plans anytime?',
              a: 'Yes — upgrades take effect immediately. Downgrades apply at the end of the current billing cycle.',
            },
            {
              q: 'How does annual billing work?',
              a: 'Annual plans are billed once per year and cost the equivalent of 10 months — so you get 2 months free.',
            },
            {
              q: 'Which payment methods do you accept?',
              a: 'Local Tunisian cards via Flouci. Credit and debit cards from major issuers are supported.',
            },
            {
              q: 'Do you offer refunds?',
              a: 'We offer a 14-day money-back guarantee on first-time paid subscriptions. Contact billing@postly.io.',
            },
          ].map((faq, i) => (
            <div key={i} className="border border-border rounded-xl p-4 bg-card">
              <p className="font-medium text-foreground mb-1">{faq.q}</p>
              <p className="text-sm text-muted-foreground">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
