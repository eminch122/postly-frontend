"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"

/* ── Google Identity Services typings ────────────────────────────────────── */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (resp: { credential: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
            use_fedcm_for_prompt?: boolean
            context?: "signin" | "signup" | "use"
            ux_mode?: "popup" | "redirect"
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon"
              theme?: "outline" | "filled_blue" | "filled_black"
              size?: "large" | "medium" | "small"
              text?: "signin_with" | "signup_with" | "continue_with" | "signin"
              shape?: "rectangular" | "pill" | "circle" | "square"
              logo_alignment?: "left" | "center"
              width?: number | string
              locale?: string
            },
          ) => void
          prompt: (
            momentNotification?: (notification: {
              isNotDisplayed: () => boolean
              isSkippedMoment: () => boolean
              isDismissedMoment: () => boolean
              getNotDisplayedReason: () => string
            }) => void,
          ) => void
          cancel: () => void
          disableAutoSelect: () => void
        }
      }
    }
  }
}

interface Props {
  /** "signin_with" | "signup_with" — controls the label on the official button */
  text?: "signin_with" | "signup_with" | "continue_with"
  /** Called after a successful Google sign-in with our backend */
  onSuccess?: () => void
  /** Called on any failure (network, invalid credential, etc.) */
  onError?: (message: string) => void
}

/**
 * Renders the official Google Identity Services button and wires it up to
 * our `loginWithGoogle` flow. We use the official button (vs. a custom DOM
 * element triggering Google) because Google blocks programmatic clicks on
 * security grounds — only their own rendered button reliably opens the
 * account chooser in every browser.
 */
export function GoogleSignInButton({ text = "continue_with", onSuccess, onError }: Props) {
  const { loginWithGoogle } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const initializedRef = useRef(false)

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  const handleCredential = useCallback(
    async (resp: { credential: string }) => {
      if (!resp?.credential) {
        onError?.("No credential returned by Google")
        return
      }
      setIsLoading(true)
      try {
        await loginWithGoogle(resp.credential)
        onSuccess?.()
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to sign in with Google"
        onError?.(msg)
      } finally {
        setIsLoading(false)
      }
    },
    [loginWithGoogle, onError, onSuccess],
  )

  useEffect(() => {
    if (!clientId) {
      onError?.(
        "Google Sign-In is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID.",
      )
      return
    }

    let cancelled = false
    // The GIS script is added in app/layout.tsx but is loaded async — poll
    // briefly until window.google.accounts is available.
    const waitForGis = () =>
      new Promise<void>((resolve, reject) => {
        const started = Date.now()
        const tick = () => {
          if (cancelled) return
          if (window.google?.accounts?.id) return resolve()
          if (Date.now() - started > 8000) return reject(new Error("Google library failed to load"))
          setTimeout(tick, 100)
        }
        tick()
      })

    waitForGis()
      .then(() => {
        if (cancelled || initializedRef.current) return
        window.google!.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
          context: text === "signup_with" ? "signup" : "signin",
        })
        initializedRef.current = true
        if (containerRef.current) {
          containerRef.current.innerHTML = ""
          window.google!.accounts.id.renderButton(containerRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            shape: "pill",
            text,
            logo_alignment: "left",
            width: containerRef.current.offsetWidth || 360,
          })
        }
        setReady(true)
      })
      .catch((err: Error) => onError?.(err.message))

    return () => {
      cancelled = true
    }
  }, [clientId, handleCredential, onError, text])

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        className="w-full flex justify-center [&>div]:w-full [&_iframe]:!w-full"
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-card text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading Google Sign-In…
        </div>
      )}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-background/80 backdrop-blur-sm text-sm text-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Signing you in…
        </div>
      )}
    </div>
  )
}
