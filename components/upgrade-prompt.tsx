'use client'

import Link from 'next/link'
import { Sparkles, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Full-card upgrade prompt used as an empty-state when a page or section
 * is locked behind a paid plan. Pair with `useWorkspace().hasFeature(...)`.
 */
export function UpgradePrompt({
  title,
  description,
  className,
}: {
  title?: string
  description?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center gap-3 bg-card border border-border rounded-2xl px-6 py-10 shadow-sm',
        className,
      )}
    >
      <div className="w-12 h-12 rounded-full bg-brand-soft flex items-center justify-center">
        <Sparkles className="w-5 h-5 text-brand" />
      </div>
      <div className="space-y-1 max-w-md">
        <h3 className="text-base font-semibold text-foreground">
          {title ?? 'This is a Pro feature'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {description ??
            'AI tools — caption writer, hashtag suggestions, insights chat — are available on the Pro and Enterprise plans.'}
        </p>
      </div>
      <Button asChild size="sm" className="bg-brand hover:bg-brand/90 text-white gap-1.5 mt-1">
        <Link href="/pricing">
          See plans
          <Sparkles className="w-3.5 h-3.5" />
        </Link>
      </Button>
    </div>
  )
}

/**
 * Tiny inline pill used next to gated UI controls (e.g., an AI button on a
 * page that otherwise works on Free). Click-through to /pricing.
 */
export function ProLockBadge({ className }: { className?: string }) {
  return (
    <Link
      href="/pricing"
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded-full hover:bg-brand/15 transition-colors',
        className,
      )}
      title="Upgrade to Pro to unlock"
    >
      <Lock className="w-2.5 h-2.5" />
      Pro
    </Link>
  )
}
