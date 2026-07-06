'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

/**
 * OAuth callback landing page.
 *
 * The backend redirects here after a social platform completes the OAuth flow:
 *   GET /oauth-callback?success=true&platform=FACEBOOK&redirectTo=onboarding
 *
 * This page is NOT guarded by the middleware so it always renders regardless
 * of auth-cookie state. It then reads the params, refreshes the auth session
 * (which re-hydrates the postly_session cookie), and navigates client-side.
 *
 * This avoids the race condition where the middleware intercepts the backend
 * redirect before the session cookie is available (causing a redirect to /login).
 * It also strips Facebook's legacy #_=_ hash fragment transparently.
 */
export default function OAuthCallbackPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { refreshUser } = useAuth()

  useEffect(() => {
    // Strip Facebook's legacy #_=_ fragment — it's a no-op hash but it's ugly
    if (window.location.hash === '#_=_') {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      )
    }

    const success = searchParams.get('success')
    const platform = searchParams.get('platform')
    const redirectTo = searchParams.get('redirectTo') ?? 'onboarding'

    async function finish() {
      // Re-hydrate auth session so middleware cookie is up-to-date
      await refreshUser()

      if (success === 'true' && platform) {
        // Navigate back to the original destination with the result params
        router.replace(`/${redirectTo}?success=true&platform=${platform}`)
      } else {
        router.replace(`/${redirectTo}?success=false`)
      }
    }

    finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 text-brand animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Completing connection…</p>
      </div>
    </div>
  )
}
