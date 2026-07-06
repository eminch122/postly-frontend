"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Instagram, Facebook,
  ImageIcon, Video, Smile, Hash,
  Sparkles, Calendar, Clock,
  X, Plus, Bold, Italic, Link2,
  Send, Save, MoreHorizontal, AlertTriangle,
  CheckCircle, AlertCircle, Loader2,
  SlidersHorizontal, Eye, RefreshCw, Zap, Lock, FileCheck,
  Film, Layers, LayoutGrid, ChevronDown, Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useWorkspace } from "@/lib/workspace-context"
import { useAuth } from "@/lib/auth-context"
import { apiClient, getAccessToken, ApiError } from "@/lib/api-client"
import { type BrandVoice, serializeBrandVoice } from "@/components/pages/brand-voice-page"
import { ProLockBadge } from "@/components/upgrade-prompt"

// ── TikTok icon (not in lucide) ───────────────────────────────────────────────

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.73a8.21 8.21 0 004.79 1.52V6.79a4.85 4.85 0 01-1.02-.1z" />
    </svg>
  )
}

// ── Platform config ───────────────────────────────────────────────────────────

type PlatformKey = "FACEBOOK" | "INSTAGRAM" | "INSTAGRAM_STANDALONE" | "TIKTOK"

const PLATFORM_CONFIG: Record<PlatformKey, {
  label: string
  shortLabel: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
  activeBg: string
  ringColor: string
  maxChars: number
}> = {
  FACEBOOK: {
    label: "Facebook", shortLabel: "FB",
    icon: Facebook,
    color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30",
    activeBg: "bg-blue-500", ringColor: "ring-blue-500/30", maxChars: 63206,
  },
  INSTAGRAM: {
    label: "Instagram", shortLabel: "IG",
    icon: Instagram,
    color: "text-pink-500", bg: "bg-pink-500/10", border: "border-pink-500/30",
    activeBg: "bg-pink-500", ringColor: "ring-pink-500/30", maxChars: 2200,
  },
  INSTAGRAM_STANDALONE: {
    label: "Instagram", shortLabel: "IG",
    icon: Instagram,
    color: "text-pink-500", bg: "bg-pink-500/10", border: "border-pink-500/30",
    activeBg: "bg-pink-500", ringColor: "ring-pink-500/30", maxChars: 2200,
  },
  TIKTOK: {
    label: "TikTok", shortLabel: "TT",
    icon: TikTokIcon,
    color: "text-foreground", bg: "bg-secondary", border: "border-border",
    activeBg: "bg-foreground", ringColor: "ring-foreground/20", maxChars: 2200,
  },
}

const SUPPORTED_PLATFORMS: PlatformKey[] = ["FACEBOOK", "INSTAGRAM", "INSTAGRAM_STANDALONE", "TIKTOK"]

// Per-platform media constraints used for inline compatibility hints.
// These mirror what the backend will enforce — keeping them client-side lets us
// fail fast without round-tripping to the API.
const PLATFORM_MEDIA_RULES: Record<PlatformKey, {
  reelVideoMimeTypes: string[]
  reelMaxBytes: number
  reelMaxDurationSec?: number
  feedVideoMimeTypes: string[]
  imageMimeTypes: string[]
  imageMaxBytes: number
}> = {
  INSTAGRAM: {
    reelVideoMimeTypes: ["video/mp4", "video/quicktime"],
    reelMaxBytes: 100 * 1024 * 1024,
    reelMaxDurationSec: 60,
    feedVideoMimeTypes: ["video/mp4", "video/quicktime"],
    imageMimeTypes: ["image/jpeg"],
    imageMaxBytes: 8 * 1024 * 1024,
  },
  INSTAGRAM_STANDALONE: {
    reelVideoMimeTypes: ["video/mp4", "video/quicktime"],
    reelMaxBytes: 100 * 1024 * 1024,
    reelMaxDurationSec: 60,
    feedVideoMimeTypes: ["video/mp4", "video/quicktime"],
    imageMimeTypes: ["image/jpeg"],
    imageMaxBytes: 8 * 1024 * 1024,
  },
  FACEBOOK: {
    reelVideoMimeTypes: ["video/mp4", "video/quicktime"],
    reelMaxBytes: 1024 * 1024 * 1024,
    feedVideoMimeTypes: ["video/mp4", "video/quicktime", "video/x-msvideo"],
    imageMimeTypes: ["image/jpeg", "image/png", "image/gif"],
    imageMaxBytes: 10 * 1024 * 1024,
  },
  TIKTOK: {
    reelVideoMimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
    reelMaxBytes: 500 * 1024 * 1024,
    reelMaxDurationSec: 600,
    feedVideoMimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
    imageMimeTypes: ["image/jpeg", "image/png"],
    imageMaxBytes: 20 * 1024 * 1024,
  },
}

// Unified post type. Applied to every platform that supports it. Per-platform
// overrides (e.g., TikTok always feed) are handled when serializing to the API.
type PostType = "FEED" | "REEL" | "STORY"
const POST_TYPE_META: Record<PostType, { label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
  FEED: { label: "Feed", icon: LayoutGrid, description: "Standard post in your feed" },
  REEL: { label: "Reel", icon: Film, description: "Vertical video, shared cross-platform" },
  STORY: { label: "Story", icon: Layers, description: "24-hour ephemeral content" },
}

function platformSupportsPostType(p: PlatformKey, t: PostType): boolean {
  if (p === "TIKTOK") return t !== "STORY"
  return true
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SocialAccountItem {
  _id: string
  platform: PlatformKey
  accountName: string
  accountUsername: string
  profilePictureUrl?: string | null
  followerCount?: number
  isActive: boolean
}

interface MediaItem {
  url: string
  mimeType: string
  sizeBytes: number
  type: "IMAGE" | "VIDEO"
  preview?: string
  name: string
}

interface SharedReelOptions {
  shareToFeed: boolean
  videoTitle: string
}

interface TikTokOptions {
  privacyLevel: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY"
  disableDuet: boolean
  disableComment: boolean
  disableStitch: boolean
}

interface MediaCompatibilityIssue {
  platform: PlatformKey
  severity: "error" | "warning"
  message: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMinScheduledAt(): string {
  const d = new Date(Date.now() + 6 * 60 * 1000)
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

// Starter hashtag chips shown before the user asks AI to generate from the draft.
// Once they hit "Suggest from draft" these get replaced with model output.
const defaultHashtagChips = [
  "#SocialMedia", "#Marketing", "#Content", "#DigitalMarketing",
  "#BrandAwareness", "#Growth", "#Startup", "#Entrepreneur",
  "#Innovation", "#Tech", "#Design", "#Creative",
]

const tones = ["Professional", "Casual", "Energetic", "Thoughtful", "Humorous"]
const ctaOptions = ["Shop Now", "Learn More", "Join Us", "Get Started", "Discover More"]

// Frontend tone label → ai-service Tone enum. Two of our labels don't have an
// exact backend equivalent; map them to the closest semantic match.
const TONE_MAP: Record<string, "PROFESSIONAL" | "CASUAL" | "HUMOROUS" | "INSPIRING" | "EDUCATIONAL"> = {
  Professional: "PROFESSIONAL",
  Casual: "CASUAL",
  Humorous: "HUMOROUS",
  Energetic: "INSPIRING",
  Thoughtful: "EDUCATIONAL",
}

// ai-service Platform enum only knows the three platforms we support today.
// INSTAGRAM_STANDALONE (Instagram Login flow) shares Instagram's content rules,
// so we collapse it onto INSTAGRAM when calling the AI.
function aiPlatformOf(p: PlatformKey | undefined): "INSTAGRAM" | "FACEBOOK" | "TIKTOK" {
  if (p === "FACEBOOK") return "FACEBOOK"
  if (p === "TIKTOK") return "TIKTOK"
  return "INSTAGRAM"
}

// Map upstream AI failures to an actionable message. The gateway already
// classifies 503 (service down) / 504 (timeout) / 429 (rate limit); this
// translates them into copy that tells the user what to do next.
function aiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 503) return "AI service is offline. Ask an admin to bring it back up."
    if (err.status === 504) return "Generation timed out — the local model is busy. Try again in a moment."
    if (err.status === 429) return "You've hit the AI rate limit (20/hour). Try again later."
    if (err.status === 401) return "Your session expired. Sign in again to keep generating."
    return err.message || fallback
  }
  return fallback
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ComposePage() {
  const { workspace, activeWorkspace, can, currentUserRole, hasFeature } = useWorkspace()
  const aiUnlocked = hasFeature('ai:tools')
  const { user } = useAuth()
  const router = useRouter()
  const workspaceId = activeWorkspace?.id ?? workspace?.id ?? null

  // Capability gates for the action bar. Editors can author + submit; only
  // Admins/Owners can directly publish or schedule.
  const canCreate = can("posts:create")
  const canPublish = can("posts:publish")
  const canSchedule = can("posts:schedule")
  const canSubmitForReview = can("posts:submit_for_review")
  // Direct publish path is for Admin/Owner. Editors go through review.
  const directPublishAllowed = canPublish && canSchedule

  // Data
  const [accounts, setAccounts] = useState<SocialAccountItem[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)

  // Composer state
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [postText, setPostText] = useState("")
  const [hashtags, setHashtags] = useState<string[]>([])
  const [media, setMedia] = useState<MediaItem[]>(() => {
    // Hydrate from the Media Library deep-link if present. Keyed on sessionStorage
    // so the URL stays clean; the page that wrote the seed (media-library-page.tsx)
    // sets it just before navigating here.
    if (typeof window === "undefined") return []
    try {
      const raw = sessionStorage.getItem("postly_compose_seed_media")
      if (!raw) return []
      sessionStorage.removeItem("postly_compose_seed_media")
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (m: unknown): m is MediaItem =>
          !!m &&
          typeof m === "object" &&
          typeof (m as MediaItem).url === "string" &&
          ((m as MediaItem).type === "IMAGE" || (m as MediaItem).type === "VIDEO"),
      )
    } catch {
      return []
    }
  })
  const [uploading, setUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // Scheduling
  const [scheduleMode, setScheduleMode] = useState<"now" | "schedule">("now")
  const [scheduledAt, setScheduledAt] = useState(getMinScheduledAt)

  // Unified post type — applied to every selected platform that supports it.
  // Per-platform overrides live below for genuinely unique fields only.
  const [postType, setPostType] = useState<PostType>("FEED")
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [reelShared, setReelShared] = useState<SharedReelOptions>({ shareToFeed: true, videoTitle: "" })
  const [ttOptions, setTtOptions] = useState<TikTokOptions>({ privacyLevel: "PUBLIC_TO_EVERYONE", disableDuet: false, disableComment: false, disableStitch: false })

  // AI assist
  const [showAI, setShowAI] = useState(false)
  const [selectedTone, setSelectedTone] = useState("Casual")
  const [selectedCta, setSelectedCta] = useState("Shop Now")
  const [aiTopic, setAiTopic] = useState("")
  const [aiCaptions, setAiCaptions] = useState<string[]>([])
  const [generatingCaption, setGeneratingCaption] = useState<"generate" | "rephrase" | null>(null)
  const [aiHashtagChips, setAiHashtagChips] = useState<string[]>(defaultHashtagChips)
  const [hashtagSource, setHashtagSource] = useState<"default" | "ai">("default")
  const [loadingHashtags, setLoadingHashtags] = useState(false)
  // Voice samples — last few published captions from the account currently
  // driving the AI panel. Lets the LLM match real voice instead of guessing.
  const [voiceSamples, setVoiceSamples] = useState<string[]>([])
  // Workspace-level brand voice (Brand Voice page). Loaded once per workspace
  // and serialized into the brand_voice field on every AI request.
  const [brandVoice, setBrandVoice] = useState<BrandVoice | null>(null)

  // Preview
  const [activePreview, setActivePreview] = useState<string>("")

  // Submission
  const [submitting, setSubmitting] = useState<"draft" | "now" | "schedule" | "review" | null>(null)
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" | "info" } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch accounts ──────────────────────────────────────────────────────────

  const fetchAccounts = useCallback(async () => {
    if (!workspaceId) {
      setAccounts([])
      setLoadingAccounts(false)
      return
    }
    setLoadingAccounts(true)
    try {
      const raw = await apiClient.get<SocialAccountItem[]>(`/api/v1/accounts?workspaceId=${workspaceId}`)
      const supported = raw.filter((a) => SUPPORTED_PLATFORMS.includes(a.platform as PlatformKey) && a.isActive)
      setAccounts(supported)
    } catch {
      setAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }, [workspaceId])

  // Refetch and reset selection when workspace changes. AI panel state also
  // resets — captions/hashtags from one workspace's voice would be confusing
  // suggestions in another.
  useEffect(() => {
    setSelectedAccountIds([])
    setActivePreview("")
    setAiCaptions([])
    setAiTopic("")
    setAiHashtagChips(defaultHashtagChips)
    setHashtagSource("default")
    fetchAccounts()
  }, [fetchAccounts])

  // ── Brand voice ─────────────────────────────────────────────────────────────
  // Pulled once per workspace. Endpoint returns null when none is configured;
  // that's fine — the AI just gets one fewer signal.
  useEffect(() => {
    if (!workspaceId) {
      setBrandVoice(null)
      return
    }
    let cancelled = false
    apiClient.get<BrandVoice | null>(`/api/v1/workspaces/${workspaceId}/brand-voice`)
      .then((data) => { if (!cancelled) setBrandVoice(data ?? null) })
      .catch(() => { if (!cancelled) setBrandVoice(null) })
    return () => { cancelled = true }
  }, [workspaceId])

  // ── Voice samples: last few published captions for the selected account ─────
  // The LLM uses these as few-shot examples so it matches the account's actual
  // tone, vocabulary, and emoji style instead of writing generic copy. Fetched
  // when the user selects their first account (or changes which one drives the
  // preview). Silently degrades to an empty list — generation still works, the
  // model just doesn't get voice anchoring.
  useEffect(() => {
    const driver = accounts.find((a) => selectedAccountIds.includes(a._id)) ?? accounts[0]
    if (!workspaceId || !driver) {
      setVoiceSamples([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const result = await apiClient.get<{
          posts: Array<{ content?: { text?: string } }>
        }>(`/api/v1/posts?workspaceId=${workspaceId}&status=PUBLISHED&limit=5`)
        if (cancelled) return
        const texts = (result.posts ?? [])
          .map((p) => p.content?.text?.trim())
          .filter((t): t is string => !!t && t.length > 20)
          .slice(0, 3)
        setVoiceSamples(texts)
      } catch {
        if (!cancelled) setVoiceSamples([])
      }
    })()
    return () => { cancelled = true }
  }, [workspaceId, selectedAccountIds, accounts])

  // ── Derived values ──────────────────────────────────────────────────────────

  const selectedAccounts = accounts.filter((a) => selectedAccountIds.includes(a._id))
  const selectedPlatforms = [...new Set(selectedAccounts.map((a) => a.platform))] as PlatformKey[]
  const hasInstagram = selectedPlatforms.some((p) => p === "INSTAGRAM" || p === "INSTAGRAM_STANDALONE")
  const hasFacebook = selectedPlatforms.includes("FACEBOOK")
  const hasTikTok = selectedPlatforms.includes("TIKTOK")

  // Group accounts by platform for the cleaner selector — keeps stable order.
  const accountsByPlatform = SUPPORTED_PLATFORMS
    .map((p) => ({ platform: p, accounts: accounts.filter((a) => a.platform === p) }))
    .filter((g) => g.accounts.length > 0)

  // Which post-types are actually selectable given the current platform mix.
  // Story disappears entirely once TikTok is the only selection.
  const availablePostTypes: PostType[] = (["FEED", "REEL", "STORY"] as PostType[])
    .filter((t) => selectedPlatforms.length === 0 || selectedPlatforms.some((p) => platformSupportsPostType(p, t)))

  const platformsApplyingType = selectedPlatforms.filter((p) => platformSupportsPostType(p, postType))
  const platformsDroppingType = selectedPlatforms.filter((p) => !platformSupportsPostType(p, postType))
  const hasMediaVideo = media.some((m) => m.type === "VIDEO" || m.mimeType.startsWith("video/"))

  const effectiveMaxChars = selectedPlatforms.length > 0
    ? Math.min(...selectedPlatforms.map((p) => PLATFORM_CONFIG[p].maxChars))
    : 2200

  const fullText = [postText.trim(), hashtags.length > 0 ? hashtags.join(" ") : ""].filter(Boolean).join("\n\n")
  const charCount = fullText.length

  // ── Cross-platform media compatibility ──────────────────────────────────────
  // Run on every render — cheap, and surfacing problems instantly is the whole
  // point. Returned issues feed both inline chips and the pre-submit summary.
  const compatibilityIssues: MediaCompatibilityIssue[] = (() => {
    const issues: MediaCompatibilityIssue[] = []
    if (media.length === 0) return issues
    const firstVideo = media.find((m) => m.mimeType.startsWith("video/"))
    const firstImage = media.find((m) => m.mimeType.startsWith("image/"))

    for (const platform of selectedPlatforms) {
      const rules = PLATFORM_MEDIA_RULES[platform]
      const appliesType = platformSupportsPostType(platform, postType) ? postType : "FEED"

      if (appliesType === "REEL") {
        if (!firstVideo) {
          issues.push({ platform, severity: "error", message: "Reel needs a video — add one or switch to Feed." })
          continue
        }
        if (!rules.reelVideoMimeTypes.includes(firstVideo.mimeType)) {
          issues.push({
            platform,
            severity: "error",
            message: `${PLATFORM_CONFIG[platform].label} Reels don't accept ${firstVideo.mimeType || "this format"}.`,
          })
        }
        if (firstVideo.sizeBytes > rules.reelMaxBytes) {
          issues.push({
            platform,
            severity: "error",
            message: `Video is ${formatBytes(firstVideo.sizeBytes)}, ${PLATFORM_CONFIG[platform].label} Reel limit is ${formatBytes(rules.reelMaxBytes)}.`,
          })
        }
      } else if (appliesType === "STORY") {
        const asset = firstVideo ?? firstImage
        if (!asset) {
          issues.push({ platform, severity: "error", message: "Story needs an image or video." })
        }
      } else {
        // Feed: validate whichever asset will actually be sent.
        if (firstImage && !rules.imageMimeTypes.includes(firstImage.mimeType)) {
          issues.push({
            platform,
            severity: "warning",
            message: `${PLATFORM_CONFIG[platform].label} prefers ${rules.imageMimeTypes.join(", ")} (got ${firstImage.mimeType}).`,
          })
        }
        if (firstImage && firstImage.sizeBytes > rules.imageMaxBytes) {
          issues.push({
            platform,
            severity: "error",
            message: `Image is ${formatBytes(firstImage.sizeBytes)}, ${PLATFORM_CONFIG[platform].label} limit is ${formatBytes(rules.imageMaxBytes)}.`,
          })
        }
      }
    }
    return issues
  })()
  const hasBlockingIssue = compatibilityIssues.some((i) => i.severity === "error")

  // ── Toast helper ────────────────────────────────────────────────────────────

  const showToast = (message: string, kind: "success" | "error" | "info" = "success") => {
    setToast({ message, kind })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Account toggling ────────────────────────────────────────────────────────

  const toggleAccount = (accountId: string, platform: PlatformKey) => {
    setSelectedAccountIds((prev) => {
      const next = prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
      if (next.length > 0 && !activePreview) setActivePreview(platform)
      return next
    })
  }

  // ── Media upload ────────────────────────────────────────────────────────────

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const newFiles = Array.from(files)

    if (media.length + newFiles.length > 10) {
      showToast("Maximum 10 files per post", "error")
      return
    }

    setUploading(true)
    for (const file of newFiles) {
      try {
        const formData = new FormData()
        formData.append("media", file)

        const token = getAccessToken()
        const res = await fetch(`${BASE_URL}/api/v1/upload`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        })
        if (!res.ok) throw new Error("Upload failed")
        const result: { url: string; mimeType: string; size: number } = await res.json()

        const isImage = file.type.startsWith("image/")
        setMedia((prev) => [
          ...prev,
          {
            url: result.url,
            mimeType: result.mimeType || file.type,
            sizeBytes: result.size || file.size,
            type: isImage ? "IMAGE" : "VIDEO",
            preview: isImage ? URL.createObjectURL(file) : undefined,
            name: file.name,
          },
        ])
      } catch {
        showToast(`Failed to upload ${file.name}`, "error")
      }
    }
    setUploading(false)
  }

  const removeMedia = (index: number) => {
    setMedia((prev) => {
      const removed = prev[index]
      if (removed.preview) URL.revokeObjectURL(removed.preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  // ── AI generation ───────────────────────────────────────────────────────────
  // The ai-service runs Ollama locally and is slow on CPU (15-30s for a long
  // caption). We surface a loading state on the button instead of disabling the
  // whole panel — the user can still tweak tone/CTA mid-flight.

  const generateCaptions = useCallback(async (mode: "generate" | "rephrase") => {
    if (!workspaceId) {
      showToast("Pick a workspace first", "error")
      return
    }
    // For Generate we need *some* signal — either a topic or any uploaded
    // asset (image or video). The backend router picks the right model:
    // 1 image → Groq llama-4-scout, 2+ images / any video → Gemini 2.5 Flash.
    const firstImage = media.find((m) => m.type === "IMAGE")
    const hasAnyMedia = media.length > 0
    if (mode === "generate" && !aiTopic.trim() && !hasAnyMedia) {
      showToast("Tell us what the post is about or upload media first", "info")
      return
    }
    if (mode === "rephrase" && !postText.trim()) {
      showToast("Write something first — Rephrase needs an existing caption", "info")
      return
    }
    setGeneratingCaption(mode)
    try {
      // First selected account drives the account context; if none selected,
      // fall back to the first connected account so generation still works.
      const driverAccount = selectedAccounts[0] ?? accounts[0]
      const platform = aiPlatformOf(driverAccount?.platform ?? selectedPlatforms[0])
      const handle = driverAccount?.accountUsername
        ? `@${driverAccount.accountUsername}`
        : driverAccount?.accountName
        ? driverAccount.accountName
        : undefined

      const body = {
        workspaceId,
        platform,
        tone: TONE_MAP[selectedTone] ?? "CASUAL",
        length: "MEDIUM" as const,
        include_cta: mode === "generate",
        hashtag_count: 5,
        account_handle: handle,
        voice_samples: voiceSamples.length > 0 ? voiceSamples : undefined,
        brand_voice: serializeBrandVoice(brandVoice),
        // Full asset list — the backend media router picks the right model:
        // 1 image → Groq llama-4-scout, 2+ images / any video → Gemini 2.5 Flash.
        // size_bytes lets the Gemini path pre-filter assets that wouldn't fit
        // the 18MB inline budget. image_url is kept for back-compat with any
        // older deployment that hasn't picked up the media[] field yet.
        media: media.length > 0
          ? media.map((m) => ({
              url: m.url,
              mime_type: m.mimeType,
              type: m.type,
              size_bytes: m.sizeBytes,
            }))
          : undefined,
        image_url: firstImage?.url,
        // For Generate: the topic IS the image_description — it's literally
        // what the post is about. For Rephrase: stash the existing caption
        // here so the model still has the same anchor.
        image_description:
          mode === "rephrase" ? postText.trim().slice(0, 500) : aiTopic.trim(),
        additional_context:
          mode === "rephrase"
            ? `Rephrase the post text above while keeping its meaning, length, and intent. Produce two genuinely different angles in the variations.`
            : `Suggested CTA: ${selectedCta}. Avoid generic phrases like "exciting news" — write something specific to the topic.`,
      }
      const result = await apiClient.post<{
        caption: string
        hashtags: string[]
        variations?: string[]
      }>(`/api/v1/ai/generate/caption`, body)

      // Defense-in-depth: even with the backend unwrap, occasionally a malformed
      // model response slips through. Anything that *contains* the JSON key
      // markers anywhere (model wrote prose around the JSON, model emitted
      // invalid JSON with trailing commas, model truncated mid-structure) gets
      // dropped — we'd rather show nothing than raw structure.
      const looksLikeRawJson = (s: string) => {
        const t = s.trim()
        if (!t) return true
        const hasJsonMarker = /["']caption["']\s*:/.test(t)
          || /["']hashtags["']\s*:/.test(t)
          || /["']variations["']\s*:/.test(t)
        const hasBraces = t.includes("{") && t.includes("}")
        return hasJsonMarker && hasBraces
      }
      const candidates = [result.caption, ...(result.variations ?? [])]
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim())
      const all = candidates.filter((s) => !looksLikeRawJson(s))
      if (all.length === 0 && candidates.length > 0) {
        // Every suggestion looked like structure — the model returned garbage
        // we couldn't peel. Tell the user instead of leaving an empty list.
        showToast("AI returned malformed output. Try again — Llama 3 occasionally lapses on JSON.", "error")
      }
      setAiCaptions(all)
      if (result.hashtags?.length) {
        setAiHashtagChips(result.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)))
        setHashtagSource("ai")
      }
    } catch (err) {
      showToast(aiErrorMessage(err, "AI generation failed"), "error")
    } finally {
      setGeneratingCaption(null)
    }
    // selectedAccounts is derived from selectedAccountIds + accounts, so the
    // two source arrays cover that dependency.
  }, [workspaceId, selectedAccountIds, accounts, selectedPlatforms, selectedTone, selectedCta, postText, aiTopic, voiceSamples, brandVoice, media])

  const suggestHashtagsFromDraft = useCallback(async () => {
    if (!workspaceId) {
      showToast("Pick a workspace first", "error")
      return
    }
    const content = postText.trim() || aiCaptions[0] || aiTopic.trim() || ""
    if (!content) {
      showToast("Write or generate a caption first — hashtags need context", "info")
      return
    }
    setLoadingHashtags(true)
    try {
      const driverAccount = selectedAccounts[0] ?? accounts[0]
      const platform = aiPlatformOf(driverAccount?.platform ?? selectedPlatforms[0])
      const handle = driverAccount?.accountUsername
        ? `@${driverAccount.accountUsername}`
        : driverAccount?.accountName
        ? driverAccount.accountName
        : undefined
      // Pull a rough "niche" hint from brand voice values; falls back to
      // "general" when nothing is configured. The model still uses the full
      // brand voice block — niche is just a one-word steering hint.
      const niche = brandVoice?.values?.[0]?.toLowerCase().trim() || "general"

      const result = await apiClient.post<{ hashtags: string[] }>(`/api/v1/ai/generate/hashtags`, {
        workspaceId,
        platform,
        content,
        niche,
        count: 10,
        account_handle: handle,
        voice_samples: voiceSamples.length > 0 ? voiceSamples : undefined,
        brand_voice: serializeBrandVoice(brandVoice),
      })
      if (result.hashtags?.length) {
        setAiHashtagChips(result.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)))
        setHashtagSource("ai")
      } else {
        showToast("AI didn't return any hashtags — try again", "info")
      }
    } catch (err) {
      showToast(aiErrorMessage(err, "Hashtag generation failed"), "error")
    } finally {
      setLoadingHashtags(false)
    }
  }, [workspaceId, postText, aiCaptions, aiTopic, selectedAccountIds, accounts, selectedPlatforms, voiceSamples, brandVoice])

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (mode: "draft" | "now" | "schedule" | "review") => {
    if (!workspaceId) {
      showToast("No workspace selected", "error")
      return
    }
    if (selectedAccountIds.length === 0) {
      showToast("Select at least one account to post to", "error")
      return
    }
    if (!postText.trim() && media.length === 0) {
      showToast("Add some content or media", "error")
      return
    }
    if (mode === "schedule" && !scheduledAt) {
      showToast("Pick a date and time to schedule", "error")
      return
    }
    if (mode === "schedule" && new Date(scheduledAt) <= new Date()) {
      showToast("Scheduled time must be in the future", "error")
      return
    }

    if (hasBlockingIssue) {
      showToast("Resolve media compatibility issues before publishing", "error")
      return
    }

    setSubmitting(mode)
    try {
      // Map the unified post type to per-platform option blocks. TikTok always
      // posts to its main feed (no Reel/Story toggle on TikTok), so it only
      // picks up its dedicated options block.
      const igIsReel = hasInstagram && postType === "REEL"
      const igIsStory = hasInstagram && postType === "STORY"
      const fbIsReel = hasFacebook && postType === "REEL"
      const fbIsStory = hasFacebook && postType === "STORY"

      const postBody: Record<string, unknown> = {
        platforms: selectedPlatforms,
        accountIds: selectedAccountIds,
        content: { text: fullText },
        // Drafts get a scheduledAt of "now" so they immediately surface in
        // today's cell on the calendar. The real schedule is set later via
        // the schedule endpoint when the user (or a reviewer) commits to a time.
        ...(mode === "draft" ? { scheduledAt: new Date().toISOString() } : {}),
        ...(media.length > 0 ? {
          media: media.map((m) => ({ type: m.type, url: m.url, mimeType: m.mimeType, sizeBytes: m.sizeBytes })),
        } : {}),
        ...(hasInstagram ? {
          instagramOptions: {
            isReel: igIsReel,
            isStory: igIsStory,
            shareToFeed: igIsReel || igIsStory ? reelShared.shareToFeed : true,
          },
        } : {}),
        ...(hasFacebook ? {
          facebookOptions: {
            isReel: fbIsReel,
            isStory: fbIsStory,
            shareToFeed: fbIsReel ? reelShared.shareToFeed : false,
            videoTitle: reelShared.videoTitle || undefined,
          },
        } : {}),
        ...(hasTikTok ? { tiktokOptions: ttOptions } : {}),
      }

      const post = await apiClient.post<{ _id: string }>(`/api/v1/posts?workspaceId=${workspaceId}`, postBody)

      if (mode === "draft") {
        showToast("Draft saved!", "success")
      } else if (mode === "review") {
        await apiClient.post(`/api/v1/posts/${post._id}/submit-for-review`, {})
        showToast("Submitted for review. An admin or reviewer will approve.", "success")
      } else if (mode === "now") {
        await apiClient.post(`/api/v1/posts/${post._id}/publish`, {})
        showToast("Post queued for publishing!", "success")
      } else {
        await apiClient.post(`/api/v1/posts/${post._id}/schedule`, {
          scheduledAt: new Date(scheduledAt).toISOString(),
        })
        showToast("Post scheduled successfully!", "success")
      }

      // Reset
      setPostText("")
      setMedia([])
      setHashtags([])
      setSelectedAccountIds([])
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Something went wrong", "error")
    } finally {
      setSubmitting(null)
    }
  }

  // ── Derived preview account ─────────────────────────────────────────────────

  const previewAccount = selectedAccounts.find((a) => a.platform === activePreview) ?? selectedAccounts[0]
  const previewPlatforms = selectedPlatforms.length > 0 ? selectedPlatforms : (accounts.length > 0 ? [accounts[0].platform] : [] as PlatformKey[])

  // ── Render ──────────────────────────────────────────────────────────────────

  // Reviewers (and any future role without posts:create) shouldn't be authoring.
  // Show a friendly stop sign instead of a half-broken composer.
  if (!canCreate) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-secondary flex items-center justify-center mb-3">
            <Lock className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Composing isn't available for your role</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Your current role is <span className="capitalize font-medium">{currentUserRole ?? "unknown"}</span>. Reviewers can approve posts from the <button className="underline hover:text-foreground" onClick={() => router.push("/team")}>Team</button> page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl animate-in slide-in-from-bottom-2 max-w-sm",
          toast.kind === "success" ? "bg-green-500/10 border-green-500/30 text-green-400"
            : toast.kind === "error" ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "bg-brand/10 border-brand/30 text-brand",
        )}>
          {toast.kind === "success" ? <CheckCircle className="w-4 h-4 shrink-0" />
            : toast.kind === "error" ? <AlertCircle className="w-4 h-4 shrink-0" />
              : <Zap className="w-4 h-4 shrink-0" />}
          {toast.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Left: Composer ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Account selector — grouped by platform with per-platform "select all" */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Post to</p>
                {selectedAccountIds.length > 0 && (
                  <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                    {selectedAccountIds.length} selected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!loadingAccounts && accounts.length > 1 && (
                  <button
                    onClick={() =>
                      setSelectedAccountIds((prev) =>
                        prev.length === accounts.length ? [] : accounts.map((a) => a._id),
                      )
                    }
                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-1.5 py-1 rounded-md hover:bg-secondary transition-colors"
                  >
                    {selectedAccountIds.length === accounts.length ? "Clear" : "Select all"}
                  </button>
                )}
                {!loadingAccounts && accounts.length > 0 && (
                  <button onClick={fetchAccounts} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {loadingAccounts ? (
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 w-36 bg-secondary rounded-lg animate-pulse" />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center mb-2">
                  <Plus className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No connected accounts</p>
                <p className="text-xs text-muted-foreground mt-0.5">Connect a social account to start posting</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 gap-1.5 text-xs"
                  onClick={() => router.push("/settings")}
                >
                  <Plus className="w-3 h-3" />
                  Connect Account
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {accountsByPlatform.map(({ platform, accounts: groupAccounts }) => {
                  const cfg = PLATFORM_CONFIG[platform]
                  const Icon = cfg.icon
                  const groupIds = groupAccounts.map((a) => a._id)
                  const allSelected = groupIds.every((id) => selectedAccountIds.includes(id))
                  const someSelected = groupIds.some((id) => selectedAccountIds.includes(id))
                  return (
                    <div key={platform}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className={cn("flex items-center gap-1.5 text-[11px] font-semibold", cfg.color)}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                          <span className="text-muted-foreground font-normal">· {groupAccounts.length}</span>
                        </div>
                        {groupAccounts.length > 1 && (
                          <button
                            onClick={() =>
                              setSelectedAccountIds((prev) =>
                                allSelected
                                  ? prev.filter((id) => !groupIds.includes(id))
                                  : [...new Set([...prev, ...groupIds])],
                              )
                            }
                            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {allSelected ? "Clear" : "Select all"}
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {groupAccounts.map((account) => {
                          const selected = selectedAccountIds.includes(account._id)
                          return (
                            <button
                              key={account._id}
                              onClick={() => toggleAccount(account._id, account.platform)}
                              className={cn(
                                "flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                                selected
                                  ? `${cfg.bg} ${cfg.border} ${cfg.color} ring-1 ${cfg.ringColor}`
                                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary",
                              )}
                            >
                              {account.profilePictureUrl ? (
                                <img
                                  src={account.profilePictureUrl}
                                  alt={account.accountName}
                                  className="w-6 h-6 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold", selected ? cfg.activeBg : "bg-muted-foreground/30")}>
                                  {account.accountName[0]?.toUpperCase()}
                                </div>
                              )}
                              <div className="text-left leading-tight min-w-0">
                                <span className="truncate max-w-[140px] block">{account.accountName}</span>
                                {account.accountUsername && (
                                  <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">@{account.accountUsername}</p>
                                )}
                              </div>
                              {selected && <Check className="w-3 h-3 shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                      {/* Subtle indeterminate hint — only when partial selection within a group of >1 */}
                      {someSelected && !allSelected && groupAccounts.length > 1 && (
                        <p className="text-[9px] text-muted-foreground mt-1">
                          {groupIds.filter((id) => selectedAccountIds.includes(id)).length} of {groupAccounts.length} selected
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Content editor */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border">
              {[Bold, Italic, Link2].map((Icon, i) => (
                <button key={i} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
              <div className="w-px h-4 bg-border mx-1" />
              <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <Smile className="w-3.5 h-3.5" />
              </button>
              <button
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                onClick={() => setPostText((t) => t + (t ? " " : "") + aiHashtagChips[0])}
                title="Insert hashtag"
              >
                <Hash className="w-3.5 h-3.5" />
              </button>
              <div className="ml-auto">
                <button
                  onClick={() => setShowAI(!showAI)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                    showAI ? "bg-brand text-white" : "bg-brand/10 text-brand hover:bg-brand/20",
                  )}
                >
                  <Sparkles className="w-3 h-3" />
                  AI Assist
                </button>
              </div>
            </div>

            {/* Textarea */}
            <div className="relative">
              <textarea
                className="w-full px-4 py-3 text-sm text-foreground bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground leading-relaxed"
                rows={6}
                placeholder="Write your post here… or use AI Assist to generate captions"
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
              />
              <div className="absolute bottom-2 right-3 flex items-center gap-1 text-xs text-muted-foreground">
                <span className={cn(
                  charCount > effectiveMaxChars * 0.9 && "text-amber-500",
                  charCount > effectiveMaxChars && "text-destructive font-medium",
                )}>
                  {charCount}
                </span>
                <span>/{effectiveMaxChars.toLocaleString()}</span>
              </div>
            </div>

            {/* AI panel */}
            {showAI && (
              <div className="border-t border-border p-4 bg-brand/5 space-y-4">
                {/* Topic input — the single highest-leverage thing the user can
                    give the model. Without this, Generate is just rolling dice. */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-brand">What's this post about?</span>
                    <span className="text-[10px] text-muted-foreground">{aiTopic.length}/200</span>
                  </div>
                  <textarea
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value.slice(0, 200))}
                    rows={2}
                    placeholder="e.g., new spring drink launch at our cafe, behind-the-scenes of our photoshoot, weekly Q&A with followers…"
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/40 resize-none"
                  />
                  <div className="mt-1.5 space-y-0.5">
                    {voiceSamples.length > 0 && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5 text-brand" />
                        Voice matched from {voiceSamples.length} recent {voiceSamples.length === 1 ? "post" : "posts"} on this account
                      </p>
                    )}
                    {brandVoice && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5 text-brand" />
                        Brand voice profile applied
                      </p>
                    )}
                    {media.some((m) => m.type === "IMAGE") && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5 text-brand" />
                        Image will be analyzed for caption context
                      </p>
                    )}
                    {voiceSamples.length === 0 && !brandVoice && accounts.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        No voice signals yet — add a <button onClick={() => router.push("/brand-voice")} className="text-brand underline hover:no-underline">brand voice</button> or publish a few posts to anchor captions.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-brand" />
                    <span className="text-xs font-semibold text-brand">Writing Tone</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tones.map((tone) => (
                      <button
                        key={tone}
                        onClick={() => setSelectedTone(tone)}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full border transition-all",
                          selectedTone === tone ? "bg-brand text-white border-brand" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary",
                        )}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-brand block mb-2">Call-to-Action</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ctaOptions.map((cta) => (
                      <button
                        key={cta}
                        onClick={() => setSelectedCta(cta)}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full border transition-all",
                          selectedCta === cta ? "bg-brand text-white border-brand" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary",
                        )}
                      >
                        {cta}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-brand flex items-center gap-1.5">
                      Caption Suggestions
                      {!aiUnlocked && <ProLockBadge />}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {postText.trim() && (
                        <button
                          onClick={() => generateCaptions("rephrase")}
                          disabled={!aiUnlocked || !!generatingCaption}
                          title={!aiUnlocked ? "Upgrade to Pro to unlock AI" : undefined}
                          className="flex items-center gap-1 text-[10px] font-medium text-brand hover:text-brand/80 disabled:opacity-50 disabled:cursor-not-allowed px-1.5 py-1 rounded-md hover:bg-brand/10 transition-colors"
                        >
                          {generatingCaption === "rephrase"
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <RefreshCw className="w-3 h-3" />}
                          Rephrase
                        </button>
                      )}
                      <button
                        onClick={() => generateCaptions("generate")}
                        disabled={!aiUnlocked || !!generatingCaption || (!aiTopic.trim() && media.length === 0)}
                        title={
                          !aiUnlocked
                            ? "Upgrade to Pro to unlock AI"
                            : !aiTopic.trim() && media.length === 0
                            ? "Add a topic or upload media first"
                            : undefined
                        }
                        className="flex items-center gap-1 text-[10px] font-semibold text-white bg-brand hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 rounded-md transition-colors"
                      >
                        {generatingCaption === "generate"
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Sparkles className="w-3 h-3" />}
                        Generate
                      </button>
                    </div>
                  </div>
                  {generatingCaption ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-14 bg-card border border-border rounded-lg animate-pulse" />
                      ))}
                      <p className="text-[10px] text-muted-foreground text-center">
                        {media.some((m) => m.type === "IMAGE") && generatingCaption === "generate"
                          ? "Analyzing your image with Llava, then writing with Llama 3 — this can take 60-90s on CPU."
                          : "Crafting with local Llama 3 — this can take 15-30s on CPU."}
                      </p>
                    </div>
                  ) : aiCaptions.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground bg-card border border-dashed border-border rounded-lg p-3 text-center">
                      {aiTopic.trim() ? (
                        <>
                          Ready to draft <span className="font-medium text-foreground">{selectedTone.toLowerCase()}</span> captions about{" "}
                          <span className="font-medium text-foreground">&ldquo;{aiTopic.trim().slice(0, 60)}{aiTopic.trim().length > 60 ? "…" : ""}&rdquo;</span>{" "}
                          for <span className="font-medium text-foreground">
                            {selectedPlatforms.length > 0 ? PLATFORM_CONFIG[selectedPlatforms[0]].label : "Instagram"}
                          </span>.
                        </>
                      ) : (
                        <>
                          Tell us what the post is about above, then click <span className="font-medium text-foreground">Generate</span>.
                        </>
                      )}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {aiCaptions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => { setPostText(s); setShowAI(false) }}
                          className="w-full text-left text-xs text-foreground/80 bg-card hover:bg-secondary border border-border rounded-lg p-3 transition-colors leading-relaxed hover:border-brand/40"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Media area — full container is a drop target so users can drag in
                additional files even after the first upload */}
            <div
              className="border-t border-border p-3 space-y-3"
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFiles(e.dataTransfer.files) }}
            >
              {/* Existing media */}
              {media.length > 0 && (
                <div className={cn(
                  "grid grid-cols-4 gap-2 rounded-lg transition-colors",
                  isDragOver && "ring-2 ring-brand/50 ring-offset-2 ring-offset-card",
                )}>
                  {media.map((item, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden bg-secondary border border-border">
                      {item.type === "IMAGE" && item.preview ? (
                        <img src={item.preview} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                          <Video className="w-5 h-5 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{item.name}</span>
                          <span className="text-[9px] text-muted-foreground">{formatBytes(item.sizeBytes)}</span>
                        </div>
                      )}
                      <button
                        onClick={() => removeMedia(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {media.length < 10 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-brand/40 hover:bg-brand/5 flex items-center justify-center transition-colors"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Plus className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  )}
                </div>
              )}

              {/* Drop zone (when no media) */}
              {media.length === 0 && (
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer group",
                    isDragOver
                      ? "border-brand bg-brand/10"
                      : "border-border hover:border-brand/40 hover:bg-brand/5",
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-brand" />
                      <p className="text-xs text-muted-foreground">Uploading…</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-lg bg-secondary group-hover:bg-brand/10 flex items-center justify-center transition-colors">
                          <ImageIcon className="w-4 h-4 text-muted-foreground group-hover:text-brand" />
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-secondary group-hover:bg-brand/10 flex items-center justify-center transition-colors">
                          <Video className="w-4 h-4 text-muted-foreground group-hover:text-brand" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Drag & drop or <span className="text-brand font-medium">browse files</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">PNG, JPG, MP4 · up to 50 MB · max 10 files</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Smart Reel suggestion — single video + multi-platform + still on Feed */}
              {hasMediaVideo && media.length === 1 && selectedPlatforms.length >= 1 && postType === "FEED" && (hasInstagram || hasFacebook) && (
                <button
                  onClick={() => setPostType("REEL")}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-brand/30 bg-brand/5 hover:bg-brand/10 transition-colors text-left"
                >
                  <Film className="w-3.5 h-3.5 text-brand shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">Publish as a Reel?</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      A single vertical video gets way more reach as a Reel on {[hasInstagram && "Instagram", hasFacebook && "Facebook"].filter(Boolean).join(" + ")}.
                    </p>
                  </div>
                  <span className="text-[10px] text-brand font-medium shrink-0">Switch</span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          </div>

          {/* Hashtags */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs font-semibold text-foreground">Hashtag Suggestions</p>
                {hashtagSource === "ai" && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-brand bg-brand/10 px-1.5 py-0.5 rounded-full">
                    <Sparkles className="w-2.5 h-2.5" />
                    AI
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {!aiUnlocked && <ProLockBadge />}
                <button
                  onClick={suggestHashtagsFromDraft}
                  disabled={!aiUnlocked || loadingHashtags}
                  className="flex items-center gap-1 text-[10px] font-medium text-brand hover:text-brand/80 disabled:opacity-50 disabled:cursor-not-allowed px-1.5 py-1 rounded-md hover:bg-brand/10 transition-colors"
                  title={!aiUnlocked ? "Upgrade to Pro to unlock AI" : "Generate hashtags from the current draft"}
                >
                  {loadingHashtags ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {hashtagSource === "ai" ? "Refresh" : "Suggest from draft"}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {aiHashtagChips.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setHashtags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-all",
                    hashtags.includes(tag) ? "bg-brand/10 text-brand border-brand/30 font-medium" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Scheduling — only shown to roles allowed to schedule/publish */}
          {directPublishAllowed && (
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
              <div className="flex gap-2">
                {(["now", "schedule"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setScheduleMode(mode)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium border transition-all",
                      scheduleMode === mode ? "bg-brand text-white border-transparent shadow-sm" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary",
                    )}
                  >
                    {mode === "now" ? "Publish Now" : "Schedule"}
                  </button>
                ))}
              </div>

              {scheduleMode === "schedule" && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-medium block">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />
                    Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    min={getMinScheduledAt()}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-brand/5 border border-brand/15">
                    <Clock className="w-3.5 h-3.5 text-brand shrink-0" />
                    <p className="text-xs text-brand/80">Best time to post: <strong className="text-brand">Tue & Thu, 9–11 AM</strong> for your audience</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Approval-workflow notice for Editors */}
          {!directPublishAllowed && canSubmitForReview && (
            <div className="bg-warning-soft border border-warning/20 rounded-xl p-3 flex items-start gap-2.5">
              <FileCheck className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-foreground">This workspace requires approval</p>
                <p className="text-muted-foreground mt-0.5">
                  Drafts you submit for review go to admins, owners, and reviewers. Once approved, they can schedule or publish.
                </p>
              </div>
            </div>
          )}

          {/* Pre-submit summary — confirms exactly what's about to happen */}
          {selectedAccountIds.length > 0 && (
            <div className="bg-secondary/40 border border-border rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Ready to publish</p>
              <p className="text-xs text-foreground leading-relaxed">
                {selectedAccounts.length === 1 ? "1 post" : `${selectedAccounts.length} posts`}
                {" · "}
                <span className="font-medium">
                  {platformsApplyingType.length > 0
                    ? POST_TYPE_META[postType].label
                    : POST_TYPE_META.FEED.label}
                </span>
                {" to "}
                {selectedAccounts.map((a, i) => {
                  const cfg = PLATFORM_CONFIG[a.platform]
                  return (
                    <span key={a._id} className={cn("inline-flex items-center gap-0.5", cfg.color)}>
                      {i > 0 && <span className="text-muted-foreground mx-0.5">·</span>}
                      <cfg.icon className="w-2.5 h-2.5" />
                      <span className="text-foreground">@{a.accountUsername || a.accountName}</span>
                    </span>
                  )
                })}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => handleSubmit("draft")}
              disabled={!!submitting}
            >
              {submitting === "draft" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Draft
            </Button>

            {directPublishAllowed ? (
              <Button
                className="flex-1 gap-1.5 bg-brand hover:bg-brand/90 text-white shadow-sm"
                onClick={() => handleSubmit(scheduleMode === "schedule" ? "schedule" : "now")}
                disabled={!!submitting || selectedAccountIds.length === 0 || hasBlockingIssue}
                title={hasBlockingIssue ? "Resolve the compatibility issues above first" : undefined}
              >
                {submitting === "now" || submitting === "schedule"
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Send className="w-3.5 h-3.5" />}
                {scheduleMode === "schedule" ? "Schedule Post" : "Publish Now"}
              </Button>
            ) : (
              <Button
                className="flex-1 gap-1.5 bg-brand hover:bg-brand/90 text-white shadow-sm"
                onClick={() => handleSubmit("review")}
                disabled={!!submitting || !canSubmitForReview || selectedAccountIds.length === 0 || hasBlockingIssue}
                title={hasBlockingIssue ? "Resolve the compatibility issues above first" : undefined}
              >
                {submitting === "review"
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <FileCheck className="w-3.5 h-3.5" />}
                Submit for Review
              </Button>
            )}
          </div>
        </div>

        {/* ── Right: Preview + Options ───────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Preview card */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            {/* Platform tabs */}
            <div className="flex border-b border-border overflow-x-auto">
              {previewPlatforms.map((p) => {
                const cfg = PLATFORM_CONFIG[p]
                const Icon = cfg.icon
                const account = selectedAccounts.find((a) => a.platform === p)
                return (
                  <button
                    key={p}
                    onClick={() => setActivePreview(p)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors",
                      activePreview === p ? `border-current ${cfg.color}` : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {account?.accountUsername ? `@${account.accountUsername}` : cfg.label}
                  </button>
                )
              })}
              {previewPlatforms.length === 0 && (
                <div className="flex items-center gap-1.5 px-3 py-2.5 text-xs text-muted-foreground">
                  <Eye className="w-3 h-3" />
                  Preview
                </div>
              )}
            </div>

            {/* Mock preview */}
            <div className="p-4">
              <div className="bg-secondary rounded-2xl overflow-hidden border border-border">
                <div className="p-3 space-y-3">
                  {/* User row */}
                  <div className="flex items-center gap-2">
                    {previewAccount?.profilePictureUrl ? (
                      <img src={previewAccount.profilePictureUrl} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-foreground leading-tight">
                        {previewAccount?.accountName ?? workspace?.name ?? "Your Account"}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        {previewAccount?.accountUsername ? `@${previewAccount.accountUsername}` : "Just now"}
                      </p>
                    </div>
                    <MoreHorizontal className="w-4 h-4 text-muted-foreground ml-auto" />
                  </div>

                  {/* Content */}
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {postText || <span className="text-muted-foreground italic">Your post will appear here…</span>}
                  </p>

                  {/* Hashtags */}
                  {hashtags.length > 0 && (
                    <p className="text-xs text-brand">{hashtags.join(" ")}</p>
                  )}

                  {/* Media preview */}
                  {media.length > 0 && media[0].type === "IMAGE" && media[0].preview ? (
                    <div className="w-full aspect-square rounded-xl overflow-hidden">
                      <img src={media[0].preview} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : media.length > 0 ? (
                    <div className="w-full h-28 rounded-xl bg-border/50 flex items-center justify-center gap-2">
                      <Video className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{media[0].name}</span>
                    </div>
                  ) : (
                    <div className="w-full h-28 rounded-xl bg-border/30 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                    </div>
                  )}

                  {/* Platform engagement mock */}
                  {(activePreview === "INSTAGRAM" || activePreview === "INSTAGRAM_STANDALONE") && (
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </div>
                  )}
                  {activePreview === "FACEBOOK" && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>👍 Like</span><span>💬 Comment</span><span>↗ Share</span>
                    </div>
                  )}
                  {activePreview === "TIKTOK" && (
                    <div className="flex flex-col items-end gap-3 absolute right-4 bottom-4 text-muted-foreground">
                      <TikTokIcon className="w-5 h-5" />
                    </div>
                  )}
                </div>
              </div>

              {/* Char counter for preview platform */}
              {activePreview && PLATFORM_CONFIG[activePreview as PlatformKey] && (
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const cfg = PLATFORM_CONFIG[activePreview as PlatformKey]
                      const Icon = cfg.icon
                      return <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                    })()}
                    <span className="text-xs text-muted-foreground">{PLATFORM_CONFIG[activePreview as PlatformKey].label} preview</span>
                  </div>
                  <span className={cn(
                    "text-xs",
                    charCount > PLATFORM_CONFIG[activePreview as PlatformKey].maxChars ? "text-destructive font-medium" : "text-muted-foreground",
                  )}>
                    {charCount}/{PLATFORM_CONFIG[activePreview as PlatformKey].maxChars.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Unified Post Options — one Feed/Reel/Story picker for the whole cross-post */}
          {selectedPlatforms.length > 0 && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Post Options</span>
              </div>

              <div className="p-4 space-y-4">
                {/* Unified post-type picker */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Post type</p>
                  <div className="flex gap-1.5">
                    {availablePostTypes.map((t) => {
                      const meta = POST_TYPE_META[t]
                      const TIcon = meta.icon
                      const active = postType === t
                      return (
                        <button
                          key={t}
                          onClick={() => setPostType(t)}
                          className={cn(
                            "flex-1 flex flex-col items-center gap-1 py-2 px-2 rounded-lg border transition-all",
                            active
                              ? "bg-brand/10 border-brand/40 text-brand ring-1 ring-brand/30"
                              : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
                          )}
                        >
                          <TIcon className="w-4 h-4" />
                          <span className="text-xs font-medium">{meta.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                    {POST_TYPE_META[postType].description}
                    {platformsApplyingType.length > 0 && (
                      <>
                        {" · Applied to "}
                        <span className="text-foreground font-medium">
                          {platformsApplyingType.map((p) => PLATFORM_CONFIG[p].label).join(", ")}
                        </span>
                      </>
                    )}
                  </p>
                  {platformsDroppingType.length > 0 && (
                    <p className="text-[10px] text-amber-500 mt-1">
                      {platformsDroppingType.map((p) => PLATFORM_CONFIG[p].label).join(", ")} doesn't support {POST_TYPE_META[postType].label} — will publish as Feed.
                    </p>
                  )}
                </div>

                {/* Reel/Story shared toggles — only when relevant */}
                {(postType === "REEL" || postType === "STORY") && (hasInstagram || hasFacebook) && (
                  <div className="border-t border-border pt-4 space-y-2">
                    <label className="flex items-center justify-between gap-2 cursor-pointer">
                      <span className="text-xs text-foreground">Also share to feed</span>
                      <div
                        onClick={() => setReelShared((prev) => ({ ...prev, shareToFeed: !prev.shareToFeed }))}
                        className={cn("w-8 h-4.5 rounded-full relative transition-colors cursor-pointer", reelShared.shareToFeed ? "bg-brand" : "bg-secondary border border-border")}
                      >
                        <div className={cn("absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all", reelShared.shareToFeed ? "left-[14px]" : "left-0.5")} />
                      </div>
                    </label>
                    {postType === "REEL" && hasFacebook && (
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Reel title (Facebook only, optional)</label>
                        <input
                          type="text"
                          placeholder="A short title…"
                          value={reelShared.videoTitle}
                          onChange={(e) => setReelShared((prev) => ({ ...prev, videoTitle: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Advanced — collapsible, only shown when there's something inside */}
                {hasTikTok && (
                  <div className="border-t border-border pt-3">
                    <button
                      onClick={() => setShowAdvancedOptions((v) => !v)}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown className={cn("w-3 h-3 transition-transform", showAdvancedOptions && "rotate-180")} />
                      Platform-specific settings
                    </button>
                    {showAdvancedOptions && (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center gap-1.5">
                          <TikTokIcon className="w-3.5 h-3.5 text-foreground" />
                          <span className="text-xs font-semibold text-foreground">TikTok</span>
                        </div>
                        <div className="space-y-3 pl-5">
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1.5">Visibility</label>
                            <div className="flex flex-col gap-1">
                              {(["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"] as const).map((level) => (
                                <label key={level} className="flex items-center gap-2 cursor-pointer">
                                  <div
                                    onClick={() => setTtOptions((prev) => ({ ...prev, privacyLevel: level }))}
                                    className={cn(
                                      "w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors",
                                      ttOptions.privacyLevel === level ? "border-foreground bg-foreground" : "border-border",
                                    )}
                                  >
                                    {ttOptions.privacyLevel === level && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {level === "PUBLIC_TO_EVERYONE" ? "Public" : level === "MUTUAL_FOLLOW_FRIENDS" ? "Friends" : "Only me"}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            {([
                              ["disableDuet", "Disable Duet"],
                              ["disableComment", "Disable Comments"],
                              ["disableStitch", "Disable Stitch"],
                            ] as const).map(([key, label]) => (
                              <label key={key} className="flex items-center justify-between gap-2 cursor-pointer">
                                <span className="text-xs text-muted-foreground">{label}</span>
                                <div
                                  onClick={() => setTtOptions((prev) => ({ ...prev, [key]: !prev[key] }))}
                                  className={cn("w-8 h-4.5 rounded-full relative transition-colors cursor-pointer", ttOptions[key] ? "bg-foreground" : "bg-secondary border border-border")}
                                >
                                  <div className={cn("absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all", ttOptions[key] ? "left-[14px]" : "left-0.5")} />
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cross-platform media compatibility — surface issues inline */}
          {compatibilityIssues.length > 0 && (
            <div className={cn(
              "rounded-xl border p-3 space-y-1.5",
              hasBlockingIssue ? "bg-destructive/5 border-destructive/20" : "bg-amber-500/5 border-amber-500/20",
            )}>
              <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
                <AlertTriangle className={cn("w-3.5 h-3.5", hasBlockingIssue ? "text-destructive" : "text-amber-500")} />
                <span className={hasBlockingIssue ? "text-destructive" : "text-amber-500"}>
                  {hasBlockingIssue ? "Fix before publishing" : "Compatibility heads-up"}
                </span>
              </div>
              {compatibilityIssues.map((issue, i) => {
                const cfg = PLATFORM_CONFIG[issue.platform]
                const PIcon = cfg.icon
                return (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <PIcon className={cn("w-3 h-3 shrink-0 mt-0.5", cfg.color)} />
                    <span className="text-foreground/80">{issue.message}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Validation warnings */}
          {charCount > effectiveMaxChars && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-destructive">Character limit exceeded</p>
                <p className="text-destructive/80 mt-0.5">
                  {charCount - effectiveMaxChars} characters over the {effectiveMaxChars.toLocaleString()} limit.
                </p>
              </div>
            </div>
          )}

          {/* Pro tip */}
          <div className="bg-brand/5 border border-brand/15 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              <span className="text-xs font-semibold text-brand">Pro Tip</span>
            </div>
            <p className="text-xs text-foreground/70 leading-relaxed">
              Posts with images get <strong className="text-foreground">2.3× more engagement</strong>. Add a high-quality visual to maximize reach on Instagram and Facebook.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
