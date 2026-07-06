"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Mail, Lock, Loader2, ArrowRight, Eye, EyeOff,
  Sparkles, BarChart3, Calendar, Users, CheckCircle2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"

const highlights = [
  { icon: BarChart3, text: "Real-time analytics across all platforms" },
  { icon: Calendar, text: "AI-powered smart scheduling" },
  { icon: Users, text: "Team collaboration & approval workflows" },
  { icon: Sparkles, text: "AI Copilot for captions & content" },
]

export function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const { login, isLoading } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")

  // After Google sign-in we need the up-to-date `onboardingComplete` flag to
  // route correctly. The auth-context updates `user` synchronously inside the
  // login call, so we read it from a fresh snapshot via the router push below.
  const navigateAfterAuth = (onboardingCompleted: boolean) => {
    if (inviteToken) router.push(`/invite/${inviteToken}`)
    else router.push(onboardingCompleted ? "/dashboard" : "/onboarding")
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email || !password) { setError("Please fill in all fields"); return }
    try {
      await login(email, password)
      // Re-read from localStorage-backed context state for the freshest flag
      const completed = typeof window !== "undefined"
        && document.cookie.includes("postly_session=active")
      navigateAfterAuth(!!completed)
    } catch {
      setError("Invalid email or password")
    }
  }

  const handleGoogleSuccess = () => {
    // postly_session cookie is set inside loginWithGoogle — read it for routing
    const completed =
      typeof window !== "undefined"
      && document.cookie.includes("postly_session=active")
    navigateAfterAuth(!!completed)
  }

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 bg-card border-r border-border p-10 relative overflow-hidden">
        {/* Glow orb */}
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-brand/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-60 h-60 bg-brand/5 rounded-full blur-[60px] pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-brand/60 flex items-center justify-center shadow-md shadow-brand/20">
            <Sparkles className="w-4 h-4 text-background" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">Postly</span>
        </div>

        {/* Mid content */}
        <div className="relative space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground leading-tight mb-3">
              Manage social media{" "}
              <span className="bg-gradient-to-r from-brand to-brand/50 bg-clip-text text-transparent">
                at scale.
              </span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Join 50,000+ teams who use Postly to schedule, publish, and analyze their content — all in one place.
            </p>
          </div>

          <div className="space-y-4">
            {highlights.map((h) => (
              <div key={h.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-soft border border-brand/20 flex items-center justify-center shrink-0">
                  <h.icon className="w-3.5 h-3.5 text-brand" />
                </div>
                <span className="text-sm text-muted-foreground">{h.text}</span>
              </div>
            ))}
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { num: "50K+", label: "Active teams" },
              { num: "4.9★", label: "G2 rating" },
              { num: "2.5B", label: "Posts published" },
              { num: "98%", label: "Satisfaction" },
            ].map((s) => (
              <div key={s.label} className="bg-secondary rounded-xl p-3 border border-border">
                <p className="text-lg font-bold text-brand">{s.num}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative bg-secondary border border-border rounded-2xl p-4">
          <div className="flex gap-1 mb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} className="w-3 h-3 fill-brand text-brand" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <p className="text-xs text-foreground italic leading-relaxed mb-3">
            "Postly tripled our LinkedIn reach in 6 weeks. The AI suggestions are eerily good."
          </p>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-brand-soft border border-brand/20 flex items-center justify-center text-xs font-bold text-brand">
              S
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Sofia M.</p>
              <p className="text-[10px] text-muted-foreground">Head of Growth, Nexara</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] space-y-6">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 justify-center mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-brand/60 flex items-center justify-center shadow-md shadow-brand/20">
              <Sparkles className="w-4 h-4 text-background" />
            </div>
            <span className="text-lg font-bold text-foreground">Postly</span>
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account to continue</p>
          </div>

          {/* Google */}
          <GoogleSignInButton
            text="signin_with"
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(msg)}
          />

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or continue with email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
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

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-brand hover:text-brand/80 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-11 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-all disabled:opacity-50"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                <span className="shrink-0">⚠</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-brand hover:bg-brand/90 text-background font-semibold rounded-xl gap-2 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* Trust */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            {["SOC 2", "GDPR", "SSL"].map((t) => (
              <span key={t} className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-brand" />
                {t}
              </span>
            ))}
          </div>

          {/* Sign up link */}
          <p className="text-sm text-muted-foreground text-center">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-brand font-semibold hover:text-brand/80 transition-colors">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
