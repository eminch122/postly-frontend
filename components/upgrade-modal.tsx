'use client'

import { useState } from 'react'
import { X, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWorkspace } from '@/lib/workspace-context'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  feature: string
  currentPlan?: string
  requiredPlan: 'pro' | 'enterprise'
}

export function UpgradeModal({
  isOpen,
  onClose,
  feature,
  currentPlan = 'free',
  requiredPlan = 'pro',
}: UpgradeModalProps) {
  const { subscriptionInfo } = useWorkspace()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')

  if (!isOpen) return null

  const featureNames: Record<string, string> = {
    'insights': 'Insights',
    'content-repurposing': 'Content Repurposing',
    'predictive-analytics': 'Predictive Analytics',
    'competitor-tracking': 'Competitor Tracking',
    'team-collaboration': 'Team Collaboration',
  }

  const proPrice = subscriptionInfo?.monthlyPrice ?? 49
  const yearlyProPrice = subscriptionInfo?.yearlyPrice ?? 490
  const savings = Math.round((proPrice * 12 - yearlyProPrice) / (proPrice * 12) * 100)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-6 flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-brand" />
              <h2 className="text-lg font-bold text-foreground">Unlock {featureNames[feature]}</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Upgrade to {requiredPlan === 'pro' ? 'Pro' : 'Enterprise'} to access this feature
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Feature highlight */}
          <div className="bg-brand/5 border border-brand/20 rounded-lg p-4">
            <p className="text-sm text-foreground">
              You&apos;re currently on a <strong>Free</strong> plan. Upgrade to unlock premium features.
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`flex-1 px-3 py-2 rounded font-medium text-sm transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`flex-1 px-3 py-2 rounded font-medium text-sm transition-all relative ${
                billingCycle === 'yearly'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Yearly
              {savings > 0 && (
                <Badge className="absolute -top-2 -right-2 text-[10px] bg-success text-white border-0">
                  Save {savings}%
                </Badge>
              )}
            </button>
          </div>

          {/* Plan comparison */}
          <div className="space-y-3">
            {subscriptionInfo && (
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <p className="font-semibold text-foreground">
                    {requiredPlan === 'pro' ? 'Pro Plan' : 'Enterprise Plan'}
                  </p>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">
                      ${billingCycle === 'monthly' ? subscriptionInfo.monthlyPrice : Math.round(subscriptionInfo.yearlyPrice / 12)}/mo
                    </p>
                    {billingCycle === 'yearly' && (
                      <p className="text-xs text-muted-foreground">
                        ${subscriptionInfo.yearlyPrice}/year
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  {subscriptionInfo.features.slice(0, 4).map((feature, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CTA */}
          <Button
            className="w-full gap-2 bg-brand hover:bg-brand/90 text-white h-11 rounded-lg"
            onClick={onClose}
          >
            Upgrade Now
            <ArrowRight className="w-4 h-4" />
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Cancel anytime. No credit card required for 14-day free trial.
          </p>
        </div>
      </div>
    </div>
  )
}
