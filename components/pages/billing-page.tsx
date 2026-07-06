'use client'

import Link from 'next/link'
import {
  CreditCard, Download, CheckCircle2, ChevronRight, AlertCircle, Users, Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWorkspace } from '@/lib/workspace-context'

function formatPrice(value: number, currency: string): string {
  return `${value.toLocaleString('en-US')} ${currency}`
}

export function BillingPage() {
  const { workspace, subscriptionInfo } = useWorkspace()

  if (!workspace || !subscriptionInfo) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          Select a workspace to see its billing details.
        </div>
      </div>
    )
  }

  const isFree = subscriptionInfo.plan === 'free'

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Billing & Plan</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription, view usage, and download invoices.
        </p>
      </div>

      {/* Current plan */}
      <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
        <div className="p-6 bg-brand-soft/30 border-b border-border">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-bold text-foreground capitalize">
                  {subscriptionInfo.plan} plan
                </h2>
                <Badge className="bg-brand text-white border-0 text-xs">Active</Badge>
              </div>
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {formatPrice(subscriptionInfo.monthlyPrice, subscriptionInfo.currency)}
                <span className="text-sm font-normal text-muted-foreground ml-1">/ month</span>
              </p>
              {!isFree && subscriptionInfo.yearlyPrice > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Or {formatPrice(subscriptionInfo.yearlyPrice, subscriptionInfo.currency)} billed yearly
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Workspace: <span className="font-medium text-foreground">{workspace.name}</span>
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/pricing">
                {isFree ? 'Upgrade' : 'Change plan'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="p-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Included in your plan
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
            {subscriptionInfo.features.map((feature) => (
              <div key={feature} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Usage snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UsageCard
          icon={<Users className="w-4 h-4 text-brand" />}
          label="Team members"
          used={workspace.members.length}
          limit={workspace.memberLimit}
        />
        <UsageCard
          icon={<Share2 className="w-4 h-4 text-brand" />}
          label="Social accounts"
          used={workspace.socialAccounts}
          limit={workspace.socialAccountLimit}
        />
      </div>

      {/* Payment method — empty state until checkout lands */}
      <div className="border border-border rounded-2xl bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Payment method</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CreditCard className="w-8 h-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            No payment method on file.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            You'll add one at checkout when you upgrade.
          </p>
        </div>
      </div>

      {/* Invoice history — empty state until checkout lands */}
      <div className="border border-border rounded-2xl bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Invoice history</h3>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your receipts will appear here after your first payment.
          </p>
        </div>
      </div>

      {/* Support */}
      <div className="border border-blue-500/20 bg-blue-500/5 rounded-xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">Need help with billing?</p>
          <p className="text-xs text-muted-foreground">
            Email <span className="text-foreground">billing@postly.io</span> and we'll get back within 24h.
          </p>
        </div>
      </div>
    </div>
  )
}

function UsageCard({
  icon,
  label,
  used,
  limit,
}: {
  icon: React.ReactNode
  label: string
  used: number
  limit: number
}) {
  const unlimited = limit === -1
  const percent = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))
  return (
    <div className="border border-border rounded-xl bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">
        {used}
        <span className="text-base font-normal text-muted-foreground">
          {' / '}
          {unlimited ? '∞' : limit}
        </span>
      </p>
      {!unlimited && (
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mt-3">
          <div
            className="h-full bg-brand rounded-full transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  )
}
