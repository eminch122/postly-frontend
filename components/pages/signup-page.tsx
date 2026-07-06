"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Mail, Lock, User, Loader2, ArrowRight,
  Eye, EyeOff, Sparkles, CheckCircle2,
  BarChart3, Calendar, Users, TrendingUp
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "Uppercase", ok: /[A-Z]/.test(password) },
    { label: "Number", ok: /\d/.test(password) },
    { label: "Special char", ok: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter((c) => c.ok).length
  const colors = ["bg-destructive", "bg-warning", "bg-warning", "bg-success", "bg-success"]
  const labels = ["", "Weak", "Fair", "Good", "Strong"]

  if (!password) return null

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-300",
              i < score ? colors[score] : "bg-border"
            )}
          />
        ))}
        <span className={cn(
          "text-[10px] font-medium ml-1 self-end",
          score <= 1 ? "text-destructive" : score <= 2 ? "text-warning" : "text-success"
        )}>
          {labels[score]}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map((c) => (
          <span key={c.label} className={cn("flex items-center gap-1 text-[10px]", c.ok ? "text-success" : "text-muted-foreground")}>
            <CheckCircle2 className="w-2.5 h-2.5" />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

const perks = [
  { icon: BarChart3, text: "Advanced analytics & reporting" },
  { icon: Calendar, text: "AI-powered smart scheduling" },
  { icon: Users, text: "Team collaboration tools" },
  { icon: TrendingUp, text: "Trend intelligence & insights" },
]

export function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const { signup, isLoading } = useAuth()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState("")

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!firstName || !lastName || !email || !password || !confirmPassword) { setError("Please fill in all fields"); return }
    if (password !== confirmPassword) { setError("Passwords do not match"); return }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return }
    try {
      await signup(email, password, firstName, lastName)
      // If the user arrived via an invitation link, send them back to accept it.
      // Email verification is handled softly via an in-app banner, so new users
      // go straight into onboarding.
      if (inviteToken) {
        router.push(`/invite/${inviteToken}`)
      } else {
        router.push("/onboarding")
      }
    } catch {
      setError("Failed to create account")
    }
  }

  const handleGoogleSuccess = () => {
    // Newly Google-authenticated users always need to complete onboarding.
    // The auth-context already set the postly_session cookie; just route.
    if (inviteToken) router.push(`/invite/${inviteToken}`)
    else if (typeof document !== "undefined" && document.cookie.includes("postly_session=active")) {
      router.push("/dashboard")
    } else {
      router.push("/onboarding")
    }
  }

  const inputCls = "w-full h-11 pl-10 pr-4 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-all disabled:opacity-50"

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-card border-r border-border p-10 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-brand/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-52 h-52 bg-brand/5 rounded-full blur-[60px] pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-brand/60 flex items-center justify-center shadow-md shadow-brand/20">
            <Sparkles className="w-4 h-4 text-background" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">Postly</span>
        </div>

        {/* Mid */}
        <div className="relative space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground leading-tight mb-3">
              Start growing{" "}
              <span className="bg-gradient-to-r from-brand to-brand/50 bg-clip-text text-transparent">
                smarter today.
              </span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Everything you need to manage, schedule, and analyze your social media — all in one place.
            </p>
          </div>

          <div className="space-y-4">
            {perks.map((p) => (
              <div key={p.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-soft border border-brand/20 flex items-center justify-center shrink-0">
                  <p.icon className="w-3.5 h-3.5 text-brand" />
                </div>
                <span className="text-sm text-muted-foreground">{p.text}</span>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="bg-secondary border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {["A", "R", "I", "M"].map((l, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full bg-brand-soft border-2 border-card flex items-center justify-center text-[10px] font-bold text-brand"
                  >
                    {l}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">50,000+</span> teams already onboard
              </p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className="w-3 h-3 fill-brand text-brand" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-[11px] text-muted-foreground ml-1">4.9/5 on G2</span>
            </div>
          </div>
        </div>

        {/* Free trial callout */}
        <div className="relative flex items-center gap-3 bg-brand-soft border border-brand/20 rounded-2xl p-4">
          <CheckCircle2 className="w-5 h-5 text-brand shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">14-day free trial</p>
            <p className="text-xs text-muted-foreground">No credit card required</p>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 overflow-y-auto">
        <div className="w-full max-w-[400px] space-y-5">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 justify-center">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-brand/60 flex items-center justify-center shadow-md shadow-brand/20">
              <Sparkles className="w-4 h-4 text-background" />
            </div>
            <span className="text-lg font-bold text-foreground">Postly</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Create your account</h1>
            <p className="text-sm text-muted-foreground mt-1">Join thousands of teams growing smarter on social</p>
          </div>

          {/* Google */}
          <GoogleSignInButton
            text="signup_with"
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(msg)}
          />

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or sign up with email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">First name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className={inputCls}
                  disabled={isLoading}
                  autoComplete="name"
                />
              </div>
            </div>


            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Last name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className={inputCls}
                  disabled={isLoading}
                  autoComplete="name"
                />
              </div>
            </div>



            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Work email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={inputCls}
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(inputCls, "pr-11")}
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
              <PasswordStrength password={password} />
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(
                    inputCls,
                    "pr-11",
                    confirmPassword && password !== confirmPassword && "border-destructive/50 focus:ring-destructive/30"
                  )}
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-[11px] text-destructive">Passwords don&apos;t match</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                <span className="shrink-0">⚠</span>
                {error}
              </div>
            )}

            {/* Terms */}
            <p className="text-xs text-muted-foreground text-center">
              By signing up, you agree to our{" "}
              <Link href="#" className="text-brand hover:text-brand/80 transition-colors">Terms</Link>
              {" "}and{" "}
              <Link href="#" className="text-brand hover:text-brand/80 transition-colors">Privacy Policy</Link>
            </p>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-brand hover:bg-brand/90 text-background font-semibold rounded-xl gap-2 transition-all"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Creating account...</>
              ) : (
                <>Create account<ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-brand font-semibold hover:text-brand/80 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
