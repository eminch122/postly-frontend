"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { MailCheck, Loader2, Sparkles, CheckCircle2, ShieldAlert, ArrowRight, RefreshCw } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

type Status = "verifying" | "success" | "error" | "no-token"

export function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const { isAuthenticated, onboardingComplete, refreshUser } = useAuth()

  const [status, setStatus] = useState<Status>(token ? "verifying" : "no-token")
  const [errorMsg, setErrorMsg] = useState("")
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle")
  // Guards against React StrictMode double-invoking the effect in dev, which
  // would consume the single-use token twice (the second call always 400s).
  const ran = useRef(false)

  useEffect(() => {
    if (!token || ran.current) return
    ran.current = true
    apiClient
      .post("/api/v1/auth/verify-email", { token }, { noAuth: true })
      .then(() => {
        setStatus("success")
        // If this is the signup tab, refresh the cached user so the in-app
        // verification banner clears once they head back into the app.
        if (isAuthenticated) refreshUser().catch(() => {})
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "This verification link is invalid or has expired.")
        setStatus("error")
      })
  }, [token, isAuthenticated, refreshUser])

  // Where "continue" goes after a successful verification.
  const successHref = isAuthenticated ? (onboardingComplete ? "/dashboard" : "/onboarding") : "/login"
  const successLabel = isAuthenticated ? "Continue" : "Continue to sign in"

  const handleResend = async () => {
    setResendState("sending")
    try {
      // Authenticated endpoint — works when the user is signed in (e.g. straight
      // after registering). apiClient attaches the stored access token.
      await apiClient.post("/api/v1/auth/resend-verification")
      setResendState("sent")
    } catch {
      setResendState("error")
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-brand/60 flex items-center justify-center shadow-md shadow-brand/20">
          <Sparkles className="w-4 h-4 text-background" />
        </div>
        <span className="text-lg font-bold text-foreground tracking-tight">Postly</span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-[400px] bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
        <div className="px-8 pt-8 pb-8">

          {status === "verifying" && (
            <>
              <div className="w-12 h-12 rounded-2xl bg-brand-soft border border-brand/20 flex items-center justify-center mb-5">
                <Loader2 className="w-5 h-5 text-brand animate-spin" />
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Verifying your email…</h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Hang tight while we confirm your email address.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-12 h-12 rounded-2xl bg-success-soft border border-success/20 flex items-center justify-center mb-5">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Email verified</h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Your email address is confirmed. Your account is all set.
              </p>
              {/* Same browser the user signed up in → continue into the app;
                  otherwise point them to sign in. */}
              <Link
                href={successHref}
                className="mt-6 flex items-center justify-center gap-2 h-11 rounded-xl bg-brand hover:bg-brand/90 text-background text-sm font-semibold transition-colors"
              >
                {successLabel}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          )}

          {(status === "error" || status === "no-token") && (
            <>
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-5">
                {status === "no-token" ? (
                  <ShieldAlert className="w-5 h-5 text-destructive" />
                ) : (
                  <MailCheck className="w-5 h-5 text-destructive" />
                )}
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                {status === "no-token" ? "Invalid verification link" : "Verification failed"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {status === "no-token"
                  ? "This link is missing its verification token. Try the link from your email again."
                  : errorMsg}
              </p>

              {resendState === "sent" ? (
                <div className="mt-6 flex items-center gap-2 p-3 bg-success-soft border border-success/20 rounded-xl text-xs text-success">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  A new verification link is on its way. Check your inbox.
                </div>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resendState === "sending"}
                  className="mt-6 w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-sm font-medium text-foreground transition-colors disabled:opacity-50"
                >
                  {resendState === "sending" ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
                  ) : (
                    <><RefreshCw className="w-4 h-4" />Resend verification email</>
                  )}
                </button>
              )}

              {resendState === "error" && (
                <p className="mt-3 text-xs text-muted-foreground text-center">
                  Couldn&apos;t resend automatically. Please{" "}
                  <Link href="/login" className="text-brand hover:text-brand/80">sign in</Link>{" "}
                  and request a new link from your account.
                </p>
              )}

              <Link
                href="/login"
                className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </Link>
            </>
          )}

        </div>
      </div>

      <p className="mt-8 text-xs text-muted-foreground text-center">
        Need help?{" "}
        <a href="mailto:support@postly.app" className="text-brand hover:text-brand/80 transition-colors">
          Contact support
        </a>
      </p>
    </div>
  )
}
