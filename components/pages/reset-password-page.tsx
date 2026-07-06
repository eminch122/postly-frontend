"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Lock, ArrowLeft, ArrowRight, Loader2, Sparkles, CheckCircle2, Eye, EyeOff, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"

export function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password.length < 8) { setError("Password must be at least 8 characters"); return }
    if (password !== confirm) { setError("Passwords do not match"); return }
    setIsLoading(true)
    try {
      await apiClient.post("/api/v1/auth/reset-password", { token, password }, { noAuth: true })
      setDone(true)
    } catch (err) {
      // Surface the server's message (weak password rules, expired token, …)
      setError(err instanceof Error ? err.message : "Failed to reset password. The link may have expired.")
    } finally {
      setIsLoading(false)
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

        {!token ? (
          /* Missing token — link is malformed or was opened without one */
          <div className="px-8 pt-8 pb-8">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-5">
              <ShieldAlert className="w-5 h-5 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Invalid reset link</h1>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              This password reset link is missing or malformed. Please request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 flex items-center justify-center gap-2 h-11 rounded-xl bg-brand hover:bg-brand/90 text-background text-sm font-semibold transition-colors"
            >
              Request a new link
            </Link>
          </div>
        ) : !done ? (
          <>
            {/* Card header */}
            <div className="px-8 pt-8 pb-6 border-b border-border">
              <div className="w-12 h-12 rounded-2xl bg-brand-soft border border-brand/20 flex items-center justify-center mb-5">
                <Lock className="w-5 h-5 text-brand" />
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Choose a new password</h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Pick a strong password you don&apos;t use anywhere else.
              </p>
            </div>

            {/* Form */}
            <div className="px-8 py-6 space-y-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 pl-10 pr-10 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-all disabled:opacity-50"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 pl-10 pr-4 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-all disabled:opacity-50"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Use at least 8 characters with an uppercase letter, a number, and a special character.
                </p>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                    <span className="shrink-0">⚠</span>
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-brand hover:bg-brand/90 text-background font-semibold rounded-xl gap-2 transition-all"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Resetting...</>
                  ) : (
                    <>Reset password<ArrowRight className="w-4 h-4" /></>
                  )}
                </Button>
              </form>

              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            {/* Success state */}
            <div className="px-8 pt-8 pb-6 border-b border-border">
              <div className="w-12 h-12 rounded-2xl bg-success-soft border border-success/20 flex items-center justify-center mb-5">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Password updated</h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Your password has been reset. You can now sign in with your new password.
              </p>
            </div>

            <div className="px-8 py-6">
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 h-11 rounded-xl bg-brand hover:bg-brand/90 text-background text-sm font-semibold transition-colors"
              >
                Continue to sign in
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </>
        )}
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
