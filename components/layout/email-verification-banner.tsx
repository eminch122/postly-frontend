"use client"

import { useEffect, useRef, useState } from "react"
import { MailWarning, Loader2, X, CheckCircle2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { apiClient } from "@/lib/api-client"

// Re-check verification status periodically so the banner clears on its own once
// the user clicks the link in their inbox (the verify endpoint busts the cached
// /users/me, so the next poll reflects the new status).
const POLL_MS = 25000
const DISMISS_KEY = "postly_verify_banner_dismissed"

/**
 * Soft, dismissible "please verify your email" banner. Non-blocking: it only
 * nudges. Renders nothing when the user is verified, signed out, or has
 * dismissed it for the current session.
 */
export function EmailVerificationBanner() {
  const { user, refreshUser } = useAuth()
  const [dismissed, setDismissed] = useState(true) // assume dismissed until we read storage (avoids SSR flash)
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const polling = useRef(false)

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1")
  }, [])

  const needsVerification = Boolean(user && !user.isEmailVerified)
  const visible = needsVerification && !dismissed

  useEffect(() => {
    if (!visible) return
    const tick = async () => {
      if (polling.current) return
      polling.current = true
      try {
        await refreshUser()
      } finally {
        polling.current = false
      }
    }
    const id = setInterval(tick, POLL_MS)
    return () => clearInterval(id)
  }, [visible, refreshUser])

  if (!visible) return null

  const handleResend = async () => {
    setResendState("sending")
    try {
      await apiClient.post("/api/v1/auth/resend-verification")
      setResendState("sent")
    } catch {
      setResendState("error")
    }
  }

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1")
    setDismissed(true)
  }

  return (
    <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5 bg-warning-soft border-b border-warning/20 text-sm">
      <MailWarning className="w-4 h-4 text-warning shrink-0" />

      <p className="flex-1 min-w-0 text-foreground/90 truncate">
        {resendState === "sent" ? (
          <>A new verification link is on its way — check{" "}
            <span className="font-medium">{user?.email}</span>.</>
        ) : (
          <>Verify your email{user?.email ? <> (<span className="font-medium">{user.email}</span>)</> : null} to secure your account.</>
        )}
      </p>

      {resendState === "sent" ? (
        <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-success shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" /> Sent
        </span>
      ) : (
        <button
          onClick={handleResend}
          disabled={resendState === "sending"}
          className="shrink-0 inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-warning/15 hover:bg-warning/25 text-xs font-semibold text-foreground transition-colors disabled:opacity-50"
        >
          {resendState === "sending" ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
          ) : resendState === "error" ? (
            "Try again"
          ) : (
            "Resend link"
          )}
        </button>
      )}

      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
