"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, ArrowLeft, Loader2, Sparkles, Send, CheckCircle2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email) { setError("Please enter your email address"); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Please enter a valid email address"); return }
    setIsLoading(true)
    try {
      // The endpoint always returns success (it never reveals whether an account
      // exists), so any resolved response means "we've done our part".
      await apiClient.post("/api/v1/auth/forgot-password", { email }, { noAuth: true })
      setSent(true)
    } catch {
      setError("Failed to send reset email. Please try again.")
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

        {!sent ? (
          <>
            {/* Card header */}
            <div className="px-8 pt-8 pb-6 border-b border-border">
              <div className="w-12 h-12 rounded-2xl bg-brand-soft border border-brand/20 flex items-center justify-center mb-5">
                <Mail className="w-5 h-5 text-brand" />
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Reset your password</h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Enter the email address linked to your account and we&apos;ll send you a reset link.
              </p>
            </div>

            {/* Form */}
            <div className="px-8 py-6 space-y-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full h-11 pl-10 pr-4 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-all disabled:opacity-50"
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                </div>

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
                    <><Loader2 className="w-4 h-4 animate-spin" />Sending link...</>
                  ) : (
                    <><Send className="w-4 h-4" />Send reset link</>
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
            <div className="px-8 pt-8 pb-6 border-b border-border ">
              <div className="w-12 h-12 rounded-2xl bg-success-soft border border-success/20 flex items-center justify-center mb-5">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Check your inbox</h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                We sent a reset link to{" "}
                <span className="font-semibold text-foreground">{email}</span>.
                It expires in 1 hour.
              </p>
            </div>

            <div className="px-8 py-6 space-y-4">
              <div className="bg-secondary border border-border rounded-xl p-4 space-y-2">
                <p className="text-xs font-medium text-foreground">Didn&apos;t receive it?</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Check your spam or junk folder</li>
                  <li>• Make sure you entered the correct email</li>
                  <li>• Allow a few minutes for delivery</li>
                </ul>
              </div>

              <button
                onClick={() => { setSent(false); setEmail("") }}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-sm font-medium text-foreground transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try a different email
              </button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
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
