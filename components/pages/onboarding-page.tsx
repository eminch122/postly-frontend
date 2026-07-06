"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowRight, ArrowLeft, CheckCircle2, Building2, Target, Zap,
  Sparkles, Loader2, Twitter, Instagram, Linkedin, Facebook,
  Users, BarChart3, Calendar, XCircle, Save, RotateCcw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"

const STEPS = [
  { id: "workspace", label: "Workspace", icon: Building2,
    title: "Create your workspace",
    description: "This is where your team will manage all social accounts and content." },
  { id: "usecase",   label: "Use case", icon: Target,
    title: "What's your main use case?",
    description: "We'll personalise Postly based on how you plan to use it." },
  { id: "connect",   label: "Connect", icon: Users,
    title: "Connect your social accounts",
    description: "Link at least one account to start scheduling. You can add more later." },
  { id: "success",   label: "Ready", icon: CheckCircle2,
    title: "You're all set!",
    description: "Your workspace is ready. Here's a summary of what we've configured." },
]

const USE_CASES = [
  { id: "business", icon: Building2, label: "Business", description: "Manage brand presence and marketing campaigns" },
  { id: "personal", icon: Zap, label: "Personal Brand", description: "Grow your audience as a creator or influencer" },
  { id: "agency",   icon: Target, label: "Agency", description: "Handle social media for multiple clients" },
]

const PLATFORMS = [
  { id: "INSTAGRAM_STANDALONE", label: "Instagram", icon: Instagram, color: "text-pink-500", bg: "bg-pink-500/10", description: "Photos, Reels & Stories" },
  { id: "TWITTER",   label: "X / Twitter", icon: Twitter, color: "text-sky-500", bg: "bg-sky-500/10", description: "Posts & Threads" },
  { id: "LINKEDIN",  label: "LinkedIn", icon: Linkedin, color: "text-blue-500", bg: "bg-blue-500/10", description: "Articles & Updates" },
  { id: "FACEBOOK",  label: "Facebook", icon: Facebook, color: "text-indigo-500", bg: "bg-indigo-500/10", description: "Posts, Pages & Groups" },
  { id: "TIKTOK",    label: "TikTok", icon: Sparkles, color: "text-rose-500", bg: "bg-rose-500/10", description: "Short-form videos" },
]

const STORAGE_KEY = "postly_onboarding_v2"

interface OnboardingDraft {
  /** Highest step the user has reached, used to restore position on return */
  currentStep: number
  workspaceName: string
  useCase: string
  connectedPlatforms: string[]
  /** ms-since-epoch; used to expire stale drafts after 7 days */
  savedAt: number
}

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function saveDraft(draft: Omit<OnboardingDraft, "savedAt">) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...draft, savedAt: Date.now() } satisfies OnboardingDraft),
    )
  } catch {
    // localStorage quota / disabled storage — silent best-effort
  }
}

function loadDraft(): OnboardingDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OnboardingDraft
    if (!parsed.savedAt || Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function clearDraft() {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY)
}

export function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { updateProfile, refreshUser, isLoading: authLoading, user } = useAuth()

  const [currentStep, setCurrentStep] = useState(0)
  const [workspaceName, setWorkspaceName] = useState("")
  const [useCase, setUseCase] = useState("")
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([])
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [connectError, setConnectError] = useState("")
  const [hasDraft, setHasDraft] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle")

  // Avoid persisting the very first render (before the draft has been restored)
  const hydrated = useRef(false)

  /* ── Restore draft from localStorage on mount ───────────────────────── */
  useEffect(() => {
    const draft = loadDraft()
    if (draft) {
      setWorkspaceName(draft.workspaceName || "")
      setUseCase(draft.useCase || "")
      setConnectedPlatforms(draft.connectedPlatforms || [])
      // Don't resume past a gate the user hasn't satisfied — otherwise a stale
      // draft could land them on the final step with empty workspace/useCase.
      const safeStep =
        draft.currentStep === 3 && !(draft.workspaceName && draft.useCase && draft.connectedPlatforms?.length)
          ? Math.max(0, [draft.workspaceName, draft.useCase, (draft.connectedPlatforms?.length ?? 0) > 0].findIndex((v) => !v))
          : Math.min(draft.currentStep ?? 0, STEPS.length - 1)
      setCurrentStep(safeStep)
      setHasDraft(true)
    }
    // Defer marking hydrated until React has committed the restore-induced
    // re-render. Otherwise the auto-save effect fires synchronously with the
    // initial (empty) closure values and overwrites the freshly restored draft.
    queueMicrotask(() => { hydrated.current = true })
  }, [])

  /* ── Persist every meaningful state change ─────────────────────────── */
  useEffect(() => {
    if (!hydrated.current) return
    setAutoSaveStatus("saving")
    saveDraft({ currentStep, workspaceName, useCase, connectedPlatforms })
    const t = setTimeout(() => setAutoSaveStatus("saved"), 300)
    return () => clearTimeout(t)
  }, [currentStep, workspaceName, useCase, connectedPlatforms])

  /* ── Handle OAuth callback redirect back to onboarding ─────────────── */
  useEffect(() => {
    const success = searchParams.get("success")
    const platform = searchParams.get("platform")
    if (success === "true" && platform) {
      setConnectedPlatforms((prev) => {
        const upper = platform.toUpperCase()
        return prev.includes(upper) ? prev : [...prev, upper]
      })
      setCurrentStep(2)
      window.history.replaceState({}, "", "/onboarding")
    }
    if (success === "false") {
      setConnectError("Failed to connect account. Please try again.")
      setCurrentStep(2)
      window.history.replaceState({}, "", "/onboarding")
    }
  }, [searchParams])

  const canContinue = [
    workspaceName.trim().length > 0,
    useCase !== "",
    connectedPlatforms.length > 0,
    true,
  ][currentStep]

  const handleConnectPlatform = useCallback(async (platformId: string) => {
    setConnectError("")
    setConnectingPlatform(platformId)
    try {
      // Draft is already persisted by the auto-save effect, but write once more
      // synchronously to guarantee the redirect doesn't lose anything.
      saveDraft({ currentStep: 2, workspaceName, useCase, connectedPlatforms })
      const data = await apiClient.get<{ authUrl: string }>(
        `/api/v1/accounts/connect/${platformId}?redirectTo=onboarding`,
      )
      window.location.href = data.authUrl
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to start OAuth flow"
      setConnectError(msg)
      setConnectingPlatform(null)
    }
  }, [workspaceName, useCase, connectedPlatforms])

  const handleNext = async () => {
    setError("")
    if (currentStep === STEPS.length - 1) {
      // Guard: if the user reached the success step but workspaceName/useCase
      // are somehow empty (stale draft, lost localStorage, etc.), bounce them
      // back instead of sending a request the backend will only reject.
      const trimmedName = workspaceName.trim()
      if (!trimmedName) {
        setError("Please give your workspace a name before continuing.")
        setCurrentStep(0)
        return
      }
      if (!useCase) {
        setError("Please choose how you'll use Postly before continuing.")
        setCurrentStep(1)
        return
      }

      setIsLoading(true)
      try {
        await updateProfile({ workspaceName: trimmedName, mainUseCase: useCase })
        clearDraft()
        await refreshUser()
        router.push("/dashboard")
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to save profile. Please try again.")
      } finally {
        setIsLoading(false)
      }
      return
    }
    setCurrentStep((s) => s + 1)
  }

  const handleBack = () => setCurrentStep((s) => Math.max(0, s - 1))
  const goToStep = (idx: number) => {
    // Only let the user jump back to completed steps, never forward past
    // a gate they haven't satisfied.
    if (idx < currentStep) setCurrentStep(idx)
  }

  const handleResetDraft = () => {
    if (!confirm("Discard your saved progress and start over?")) return
    clearDraft()
    setWorkspaceName("")
    setUseCase("")
    setConnectedPlatforms([])
    setCurrentStep(0)
    setHasDraft(false)
  }

  const inputCls =
    "w-full h-12 px-4 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-all"

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand to-brand/60 flex items-center justify-center shadow-sm shadow-brand/20">
              <Sparkles className="w-4 h-4 text-background" />
            </div>
            <span className="font-bold text-foreground">Postly</span>
          </Link>

          <div className="hidden sm:flex items-center gap-1.5 min-w-0">
            {STEPS.map((s, i) => {
              const completed = i < currentStep
              const active = i === currentStep
              const Icon = s.icon
              return (
                <div key={s.id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => goToStep(i)}
                    disabled={i >= currentStep}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full transition-all",
                      completed && "bg-success-soft text-success hover:bg-success/15 cursor-pointer",
                      active && "bg-brand-soft text-brand ring-1 ring-brand/30",
                      !completed && !active && "bg-secondary text-muted-foreground cursor-not-allowed",
                    )}
                    aria-label={`Go to ${s.label} step`}
                  >
                    {completed ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                    <span>{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={cn("w-4 h-px", completed ? "bg-success/40" : "bg-border")} />
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {autoSaveStatus === "saving"
                ? <><Loader2 className="w-3 h-3 animate-spin" />Saving…</>
                : autoSaveStatus === "saved"
                ? <><Save className="w-3 h-3" />Saved</>
                : null}
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip setup
            </button>
          </div>
        </div>

        <div className="h-0.5 bg-border">
          <div
            className="h-full bg-brand transition-all duration-500"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 flex items-start justify-center px-6 py-12 sm:py-16">
        <div className="w-full max-w-xl space-y-6">

          {/* Restored-draft banner — shown only on the first render after restore */}
          {hasDraft && currentStep > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-soft/50 border border-brand/20 text-xs">
              <RotateCcw className="w-3.5 h-3.5 text-brand shrink-0" />
              <span className="flex-1 text-foreground">
                We restored your saved progress. <span className="text-muted-foreground">You can resume right where you left off.</span>
              </span>
              <button
                onClick={handleResetDraft}
                className="text-brand hover:text-brand/80 font-medium transition-colors shrink-0"
              >
                Start over
              </button>
            </div>
          )}

          {/* Greeting on the first step */}
          {currentStep === 0 && user?.firstName && (
            <p className="text-sm text-muted-foreground">
              Welcome, <span className="font-medium text-foreground">{user.firstName}</span>. Let's get you set up in less than a minute.
            </p>
          )}

          {/* Step header (icon + title + description) */}
          <div>
            <div className="w-12 h-12 rounded-2xl bg-brand-soft border border-brand/20 flex items-center justify-center mb-5">
              {(() => {
                const Icon = STEPS[currentStep].icon
                return <Icon className="w-5 h-5 text-brand" />
              })()}
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{STEPS[currentStep].title}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">{STEPS[currentStep].description}</p>
          </div>

          {/* ── Step 0: Workspace ── */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Workspace name</label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && canContinue) handleNext() }}
                    placeholder="e.g. Acme Marketing Team"
                    className={inputCls}
                    autoFocus
                    maxLength={100}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">This will be visible to all team members.</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">{workspaceName.length}/100</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["My Brand", "Marketing Team", "Agency Hub"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setWorkspaceName(s)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-border bg-secondary hover:border-brand/40 hover:text-brand transition-colors text-muted-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleNext}
                disabled={!canContinue}
                className="w-full h-11 bg-brand hover:bg-brand/90 text-background font-semibold rounded-xl gap-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* ── Step 1: Use case ── */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-3">
                {USE_CASES.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setUseCase(option.id)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 border-2 rounded-2xl text-left transition-all",
                      useCase === option.id
                        ? "border-brand bg-brand-soft shadow-sm shadow-brand/10"
                        : "border-border bg-card hover:border-brand/40 hover:bg-secondary/30",
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all",
                      useCase === option.id ? "bg-brand text-background" : "bg-secondary text-muted-foreground"
                    )}>
                      <option.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className={cn("text-sm font-semibold", useCase === option.id ? "text-brand" : "text-foreground")}>
                        {option.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                    </div>
                    {useCase === option.id && <CheckCircle2 className="w-5 h-5 text-brand shrink-0" />}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <Button onClick={handleBack} variant="outline" className="h-11 px-5 rounded-xl border-border hover:bg-secondary">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!canContinue}
                  className="flex-1 h-11 bg-brand hover:bg-brand/90 text-background font-semibold rounded-xl gap-2"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: Connect accounts ── */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {connectError && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {connectError}
                </div>
              )}

              <div className="space-y-3">
                {PLATFORMS.map((p) => {
                  const connected = connectedPlatforms.includes(p.id)
                  const isConnecting = connectingPlatform === p.id
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 border-2 rounded-2xl transition-all",
                        connected
                          ? "border-success/40 bg-success-soft/40"
                          : "border-border bg-card hover:border-brand/30",
                      )}
                    >
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", p.bg)}>
                        <p.icon className={cn("w-4 h-4", p.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{p.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>
                      </div>
                      {connected ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-success shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                          Connected
                        </div>
                      ) : (
                        <button
                          onClick={() => handleConnectPlatform(p.id)}
                          disabled={isConnecting || authLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand text-background hover:bg-brand/90 disabled:opacity-50 transition-colors shrink-0"
                        >
                          {isConnecting ? (
                            <><Loader2 className="w-3 h-3 animate-spin" />Connecting…</>
                          ) : (
                            <>Connect</>
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {connectedPlatforms.length > 0 && (
                <p className="text-xs text-brand font-medium text-center">
                  {connectedPlatforms.length} account{connectedPlatforms.length > 1 ? "s" : ""} connected
                </p>
              )}

              <div className="flex gap-3">
                <Button onClick={handleBack} variant="outline" className="h-11 px-5 rounded-xl border-border hover:bg-secondary">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!canContinue}
                  className="flex-1 h-11 bg-brand hover:bg-brand/90 text-background font-semibold rounded-xl gap-2"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Success ── */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border bg-secondary">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Setup summary</p>
                </div>
                <div className="divide-y divide-border">
                  <SummaryRow Icon={Building2} label="Workspace" value={workspaceName} />
                  <SummaryRow
                    Icon={Target}
                    label="Use case"
                    value={USE_CASES.find((u) => u.id === useCase)?.label ?? useCase}
                  />
                  <SummaryRow
                    Icon={Users}
                    label="Connected accounts"
                    value={
                      connectedPlatforms.length > 0
                        ? connectedPlatforms
                            .map((id) => PLATFORMS.find((p) => p.id === id)?.label ?? id)
                            .join(", ")
                        : "None yet — you can connect later"
                    }
                  />
                </div>
              </div>

              <div className="bg-secondary border border-border rounded-2xl p-5 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">What's next</p>
                <div className="space-y-3">
                  {[
                    { icon: Calendar, text: "Schedule your first post from the dashboard" },
                    { icon: BarChart3, text: "Explore your analytics overview" },
                    { icon: Sparkles, text: "Try the AI Copilot to draft content" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
                        <item.icon className="w-3.5 h-3.5 text-brand" />
                      </div>
                      <p className="text-sm text-muted-foreground">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="h-12 px-5 rounded-xl border-border hover:bg-secondary"
                  disabled={isLoading}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={isLoading}
                  className="flex-1 h-12 bg-brand hover:bg-brand/90 text-background font-semibold rounded-xl gap-2 text-base"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Saving your workspace…</>
                  ) : (
                    <>Go to dashboard <ArrowRight className="w-4 h-4" /></>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

/* ── Small inline component to keep the success grid readable ─────────── */
function SummaryRow({
  Icon, label, value,
}: { Icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="w-8 h-8 rounded-lg bg-brand-soft border border-brand/20 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-brand" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate capitalize">{value}</p>
      </div>
      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
    </div>
  )
}
