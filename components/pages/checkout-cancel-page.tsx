'use client'

import Link from 'next/link'
import { XCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        <div className="bg-card border border-border rounded-2xl shadow-sm px-7 py-7 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-secondary border border-border flex items-center justify-center">
            <XCircle className="w-7 h-7 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground mt-5">
            Payment was cancelled
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            You weren't charged. You can try again whenever you're ready — your
            workspace is unchanged and still on its current plan.
          </p>

          <div className="mt-5 flex flex-col gap-2 w-full">
            <Button asChild className="w-full gap-2 bg-brand hover:bg-brand/90 text-white">
              <Link href="/pricing">
                Back to plans
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button variant="ghost" asChild className="w-full text-muted-foreground">
              <Link href="/billing">Go to billing</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
