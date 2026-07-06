"use client"

import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  Palette, Save, RotateCcw, Sparkles, Plus, Trash2, Eye, Loader2, CheckCircle, AlertCircle, Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/lib/workspace-context"
import { apiClient, ApiError } from "@/lib/api-client"

// ── Brand voice contract ─────────────────────────────────────────────────────
// Mirrors the IBrandVoice schema in Workspace.model.ts. Sliders are 0-100 with
// each end mapping to the labelled extreme.

export interface BrandVoice {
  sliders: {
    formality: number
    tone: number
    expertise: number
    energy: number
    conciseness: number
  }
  vocabulary: string[]
  phrasesToUse: string[]
  phrasesToAvoid: string[]
  values: string[]
  description: string
}

const SLIDER_DIMS = [
  { key: "formality", label: "Formality", min: "Casual", max: "Professional" },
  { key: "tone", label: "Tone", min: "Humorous", max: "Serious" },
  { key: "expertise", label: "Expertise", min: "Beginner", max: "Expert" },
  { key: "energy", label: "Energy", min: "Calm", max: "Energetic" },
  { key: "conciseness", label: "Conciseness", min: "Detailed", max: "Brief" },
] as const

type ListKey = "vocabulary" | "phrasesToUse" | "phrasesToAvoid" | "values"

const LIST_DIMS: { key: ListKey; label: string; placeholder: string }[] = [
  { key: "vocabulary", label: "Vocabulary", placeholder: "Modern, authentic, inclusive…" },
  { key: "phrasesToUse", label: "Phrases to Use", placeholder: "Let's, you deserve, together…" },
  { key: "phrasesToAvoid", label: "Phrases to Avoid", placeholder: "Corporate jargon, clickbait…" },
  { key: "values", label: "Core Values", placeholder: "Authenticity, sustainability…" },
]

const DEFAULT_BRAND_VOICE: BrandVoice = {
  sliders: { formality: 50, tone: 50, expertise: 50, energy: 50, conciseness: 50 },
  vocabulary: [],
  phrasesToUse: [],
  phrasesToAvoid: [],
  values: [],
  description: "",
}

/**
 * Render a BrandVoice into a paragraph the LLM can consume directly. Shared
 * with the compose page so the contract stays in one place.
 */
export function serializeBrandVoice(bv: BrandVoice | null | undefined): string | undefined {
  if (!bv) return undefined
  const sliderDescriptors = SLIDER_DIMS.map((d) => {
    const v = bv.sliders[d.key]
    const leaning = v < 35 ? d.min : v > 65 ? d.max : `balanced (${d.min}/${d.max})`
    return `- ${d.label}: ${leaning} (${v}/100)`
  }).join("\n")

  const listSection = (label: string, items: string[]) =>
    items.length > 0 ? `${label}: ${items.join(", ")}` : null

  const lists = [
    listSection("Vocabulary to favor", bv.vocabulary),
    listSection("Phrases to use", bv.phrasesToUse),
    listSection("Avoid", bv.phrasesToAvoid),
    listSection("Core values", bv.values),
  ].filter(Boolean) as string[]

  const desc = bv.description.trim() ? `Brand description: ${bv.description.trim()}` : null

  const blocks = [
    "Voice profile:",
    sliderDescriptors,
    ...lists,
    ...(desc ? [desc] : []),
  ].filter(Boolean)
  return blocks.join("\n")
}

export function BrandVoicePage() {
  const { activeWorkspace, can, currentUserRole } = useWorkspace()
  const workspaceId = activeWorkspace?.id ?? null
  const canEdit = can("workspace:update")

  const [bv, setBv] = useState<BrandVoice>(DEFAULT_BRAND_VOICE)
  const [initialBv, setInitialBv] = useState<BrandVoice>(DEFAULT_BRAND_VOICE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null)
  const [newItems, setNewItems] = useState<Record<ListKey, string>>({
    vocabulary: "", phrasesToUse: "", phrasesToAvoid: "", values: "",
  })

  const showToast = (message: string, kind: "success" | "error" = "success") => {
    setToast({ message, kind })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Load existing brand voice ──────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    apiClient.get<BrandVoice | null>(`/api/v1/workspaces/${workspaceId}/brand-voice`)
      .then((data) => {
        if (cancelled) return
        const merged = data ? { ...DEFAULT_BRAND_VOICE, ...data, sliders: { ...DEFAULT_BRAND_VOICE.sliders, ...data.sliders } } : DEFAULT_BRAND_VOICE
        setBv(merged)
        setInitialBv(merged)
      })
      .catch(() => {
        if (!cancelled) {
          setBv(DEFAULT_BRAND_VOICE)
          setInitialBv(DEFAULT_BRAND_VOICE)
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [workspaceId])

  const isDirty = JSON.stringify(bv) !== JSON.stringify(initialBv)
  // Used as a coarse "how trained is this brand voice" indicator. Each non-empty
  // dimension counts equally so the user gets a clear path to 100%.
  const trainingScore = (() => {
    const dimensions = [
      bv.vocabulary.length > 0,
      bv.phrasesToUse.length > 0,
      bv.phrasesToAvoid.length > 0,
      bv.values.length > 0,
      bv.description.trim().length >= 20,
    ]
    return Math.round((dimensions.filter(Boolean).length / dimensions.length) * 100)
  })()

  const handleSliderChange = (key: keyof BrandVoice["sliders"], value: number) => {
    setBv((prev) => ({ ...prev, sliders: { ...prev.sliders, [key]: value } }))
  }

  const handleAddItem = (list: ListKey) => {
    const v = newItems[list].trim()
    if (!v) return
    if (bv[list].includes(v)) {
      showToast(`"${v}" is already in the list`, "error")
      return
    }
    setBv((prev) => ({ ...prev, [list]: [...prev[list], v] }))
    setNewItems((prev) => ({ ...prev, [list]: "" }))
  }

  const handleRemoveItem = (list: ListKey, item: string) => {
    setBv((prev) => ({ ...prev, [list]: prev[list].filter((x) => x !== item) }))
  }

  const handleSave = useCallback(async () => {
    if (!workspaceId || !canEdit) return
    setSaving(true)
    try {
      const saved = await apiClient.put<BrandVoice>(`/api/v1/workspaces/${workspaceId}/brand-voice`, bv)
      const merged = { ...DEFAULT_BRAND_VOICE, ...saved, sliders: { ...DEFAULT_BRAND_VOICE.sliders, ...saved.sliders } }
      setBv(merged)
      setInitialBv(merged)
      showToast("Brand voice saved", "success")
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Failed to save", "error")
    } finally {
      setSaving(false)
    }
  }, [workspaceId, canEdit, bv])

  const handleReset = () => setBv(initialBv)

  if (!workspaceId) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Palette className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Pick a workspace to configure its brand voice.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl",
          toast.kind === "success" ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-destructive/10 border-destructive/30 text-destructive",
        )}>
          {toast.kind === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Palette className="w-6 h-6 text-brand" />
          Brand Voice
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          The AI uses this profile every time it writes a caption for this workspace.
        </p>
      </div>

      {!canEdit && (
        <div className="bg-warning-soft border border-warning/20 rounded-xl p-3 flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium text-foreground">Read-only</p>
            <p className="text-muted-foreground mt-0.5">
              Your role ({currentUserRole}) can view but not edit the brand voice. Ask an admin or owner to make changes.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-card border border-border rounded-xl p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: dimensions + lists */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sliders */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand" />
                Voice Profile
              </h2>
              <div className="space-y-6">
                {SLIDER_DIMS.map((dim) => (
                  <div key={dim.key}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-foreground">{dim.label}</label>
                      <span className="text-xs text-muted-foreground">{bv.sliders[dim.key]}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20 text-right">{dim.min}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={bv.sliders[dim.key]}
                        disabled={!canEdit}
                        onChange={(e) => handleSliderChange(dim.key, parseInt(e.target.value, 10))}
                        className="flex-1 h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-brand disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span className="text-xs text-muted-foreground w-20">{dim.max}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lists */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4">Writing Guidelines</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIST_DIMS.map((list) => (
                  <div key={list.key}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {list.label}
                    </p>
                    <div className="space-y-1.5 mb-2">
                      {bv[list.key].length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic">None yet</p>
                      ) : (
                        bv[list.key].map((item) => (
                          <div key={item} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 group">
                            <span className="text-xs text-foreground flex-1">{item}</span>
                            {canEdit && (
                              <button
                                onClick={() => handleRemoveItem(list.key, item)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={newItems[list.key]}
                          onChange={(e) => setNewItems((p) => ({ ...p, [list.key]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(list.key) } }}
                          placeholder={list.placeholder}
                          className="flex-1 px-2 py-1.5 bg-secondary border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-brand/40"
                        />
                        <button
                          onClick={() => handleAddItem(list.key)}
                          disabled={!newItems[list.key].trim()}
                          className="px-2 rounded-md bg-brand text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Brand Description</h2>
                <span className="text-[10px] text-muted-foreground">{bv.description.length}/1000</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Describe what your brand stands for, who you serve, and what makes your voice unique. The AI reads this verbatim.
              </p>
              <textarea
                value={bv.description}
                onChange={(e) => setBv((prev) => ({ ...prev, description: e.target.value.slice(0, 1000) }))}
                disabled={!canEdit}
                rows={4}
                placeholder="We're a small-batch coffee roaster in Montreal. Our voice is warm, lowercase, and casual — like texting a regular. We talk about sourcing, baristas, and neighbourhood moments."
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/40 resize-none disabled:opacity-60"
              />
            </div>
          </div>

          {/* Right: training + actions */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-brand" />
                Profile Strength
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1.5 flex-1 rounded-full transition-colors",
                          (i + 1) * 20 <= trainingScore ? "bg-brand" : "bg-secondary",
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-foreground mt-2 font-medium">{trainingScore}% complete</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {trainingScore < 60
                      ? "Add more vocabulary, phrases, and a brand description to get richer captions."
                      : "Looking good — the AI has plenty to work with."}
                  </p>
                </div>

                <div className="pt-3 border-t border-border space-y-2">
                  <Button
                    className="w-full gap-1.5 bg-brand hover:bg-brand/90 text-white text-xs h-8"
                    onClick={handleSave}
                    disabled={!canEdit || !isDirty || saving}
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {saving ? "Saving…" : isDirty ? "Save Changes" : "Saved"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-xs h-8"
                    onClick={handleReset}
                    disabled={!canEdit || !isDirty || saving}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-brand-soft border border-brand/30 rounded-xl p-4">
              <p className="text-xs font-semibold text-brand mb-2">How it's used</p>
              <p className="text-xs text-foreground/80 leading-relaxed">
                Every time you click Generate in the Compose page's AI Assist, this profile is sent to the model alongside the topic and your account's recent posts.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
