"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { apiClient, ApiError } from "@/lib/api-client"
import {
  Instagram, Twitter, Linkedin, Facebook,
  Plus, Trash2, CreditCard, CheckCircle2,
  Bell, Shield, Key, Zap, ChevronRight,
  ToggleLeft, ToggleRight,
  Eye, EyeOff, Copy, RefreshCw, ArrowRight,
  AlertTriangle, Loader2,
  User as UserIcon, Camera, Mail, Save, XCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useWorkspace } from "@/lib/workspace-context"
import { useAuth } from "@/lib/auth-context"

const settingsSections = [
  { key: "profile", label: "Update Profile" },
  { key: "accounts", label: "Connected Accounts" },
  { key: "billing", label: "Billing & Plan" },
  { key: "notifications", label: "Notifications" },
  { key: "security", label: "Security" },
  { key: "api", label: "API & Integrations" },
]

const SUPPORTED_PLATFORMS = [
  { id: "INSTAGRAM", label: "Instagram (via Facebook)", icon: Instagram, color: "text-pink-500", bg: "bg-pink-500/10" },
  { id: "INSTAGRAM_STANDALONE", label: "Instagram Business", icon: Instagram, color: "text-pink-500", bg: "bg-pink-500/10" },
  { id: "TWITTER", label: "Twitter/X", icon: Twitter, color: "text-sky-500", bg: "bg-sky-500/10" },
  { id: "LINKEDIN", label: "LinkedIn", icon: Linkedin, color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "FACEBOOK", label: "Facebook", icon: Facebook, color: "text-indigo-500", bg: "bg-indigo-500/10" },
  { id: "TIKTOK", label: "TikTok", icon: ({ className }: { className?: string }) => <span className={cn("text-xs font-bold", className)}>TK</span>, color: "text-foreground", bg: "bg-secondary" },
]

const getPlatformConfig = (platform: string) => {
  return SUPPORTED_PLATFORMS.find(p => p.id === platform) || SUPPORTED_PLATFORMS[0]
}

const DAY_MS = 24 * 60 * 60 * 1000

type TokenState = "none" | "valid" | "expiring" | "expired"

/** Derive a human-friendly access-token status from an account's expiry date. */
const getTokenStatus = (tokenExpiresAt?: string): { state: TokenState; label: string } => {
  if (!tokenExpiresAt) return { state: "none", label: "" }
  const ms = new Date(tokenExpiresAt).getTime() - Date.now()
  if (Number.isNaN(ms)) return { state: "none", label: "" }
  const days = Math.ceil(ms / DAY_MS)
  if (ms <= 0) return { state: "expired", label: "Access token expired" }
  if (ms <= 7 * DAY_MS) return { state: "expiring", label: `Access expires in ${days} day${days === 1 ? "" : "s"}` }
  return { state: "valid", label: `Access valid · expires in ${days} days` }
}

const notificationSettings = [
  { label: "Post published successfully", description: "When a scheduled post goes live", enabled: true },
  { label: "Post failed to publish", description: "When publishing encounters an error", enabled: true },
  { label: "New post awaiting approval", description: "When a team member submits for review", enabled: true },
  { label: "Post approved/rejected", description: "When a reviewer takes action on your post", enabled: false },
  { label: "Weekly performance digest", description: "Summary of your top content every Monday", enabled: true },
  { label: "New follower milestone", description: "When you hit a follower round number", enabled: false },
  { label: "Engagement spike alert", description: "When a post gets unusually high engagement", enabled: true },
]

const planFeatures = [
  "5 social media accounts",
  "Unlimited scheduled posts",
  "Advanced analytics & reports",
  "Team collaboration (5 seats)",
  "AI caption assistant",
  "Priority support",
]

export function SettingsPage() {
  const { activeWorkspace, subscriptionInfo } = useWorkspace()
  const { user, updateProfile, refreshUser } = useAuth()
  const workspaceId = activeWorkspace?.id ?? null

  const searchParams = useSearchParams()
  const [activeSection, setActiveSection] = useState("profile")

  // After an OAuth redirect from the Settings page, the URL will contain
  // ?success=true&platform=... — auto-switch to the "accounts" section so
  // the user sees their newly connected account.
  useEffect(() => {
    if (searchParams.get("success") || searchParams.get("platform")) {
      setActiveSection("accounts")
    }
  }, [searchParams])

  /* ── Update Profile state ─────────────────────────────────────────── */
  const [profileFirstName, setProfileFirstName] = useState("")
  const [profileLastName, setProfileLastName] = useState("")
  const [profileAvatar, setProfileAvatar] = useState<string>("")
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const [avatarUploadError, setAvatarUploadError] = useState<string>("")
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Sync local edit state from auth context whenever the user changes
  useEffect(() => {
    if (!user) return
    setProfileFirstName(user.firstName ?? "")
    setProfileLastName(user.lastName ?? "")
    setProfileAvatar(user.avatar ?? "")
  }, [user])

  const profileDirty =
    !!user && (
      profileFirstName !== (user.firstName ?? "") ||
      profileLastName !== (user.lastName ?? "") ||
      profileAvatar !== (user.avatar ?? "")
    )

  const handleAvatarFile = (file: File | undefined) => {
    setAvatarUploadError("")
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setAvatarUploadError("Please choose an image file")
      return
    }
    // Limit raw input to ~1.4 MB; base64 inflation pushes the JSON body to ~1.9 MB,
    // which keeps us under the express.json 10mb cap and the avatar validator's 2MB.
    if (file.size > 1_400_000) {
      setAvatarUploadError("Image is too large — please choose a file under 1.4 MB")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      if (result) setProfileAvatar(result)
    }
    reader.onerror = () => setAvatarUploadError("Could not read this file")
    reader.readAsDataURL(file)
  }

  const handleProfileSave = async () => {
    if (!profileDirty) return
    setProfileSaving(true)
    setProfileMessage(null)
    try {
      const payload: { firstName?: string; lastName?: string; avatar?: string } = {}
      if (profileFirstName.trim() && profileFirstName !== user?.firstName)
        payload.firstName = profileFirstName.trim()
      if (profileLastName.trim() && profileLastName !== user?.lastName)
        payload.lastName = profileLastName.trim()
      if (profileAvatar !== (user?.avatar ?? "")) payload.avatar = profileAvatar
      await updateProfile(payload)
      await refreshUser()
      setProfileMessage({ kind: "ok", text: "Profile updated successfully" })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to update profile"
      setProfileMessage({ kind: "err", text: msg })
    } finally {
      setProfileSaving(false)
    }
  }

  const handleProfileReset = () => {
    if (!user) return
    setProfileFirstName(user.firstName ?? "")
    setProfileLastName(user.lastName ?? "")
    setProfileAvatar(user.avatar ?? "")
    setProfileMessage(null)
    setAvatarUploadError("")
  }

  const initials = (
    (profileFirstName?.[0] ?? user?.firstName?.[0] ?? "") +
    (profileLastName?.[0] ?? user?.lastName?.[0] ?? "")
  ).toUpperCase() || "U"
  const [notifications, setNotifications] = useState(
    Object.fromEntries(notificationSettings.map((n, i) => [i, n.enabled]))
  )
  const [showApiKey, setShowApiKey] = useState(false)
  const apiKey = "pk_live_Gk4x9mNq3rT8vZ2p7wY1cX5bL6fH0dJ"

  const [accounts, setAccounts] = useState<any[]>([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)

  const fetchAccounts = async () => {
    if (!workspaceId) {
      setAccounts([])
      setIsLoadingAccounts(false)
      return
    }
    try {
      setIsLoadingAccounts(true)
      const data = await apiClient.get<any[]>(`/api/v1/accounts?workspaceId=${workspaceId}`)
      setAccounts(data || [])
    } catch (error) {
      console.error("Failed to fetch accounts:", error)
      setAccounts([])
    } finally {
      setIsLoadingAccounts(false)
    }
  }

  useEffect(() => {
    if (activeSection === "accounts") {
      fetchAccounts()
    }
  }, [activeSection, workspaceId])

  const handleConnect = async (platformId: string) => {
    if (!workspaceId) {
      console.error("No active workspace — cannot connect a social account")
      return
    }
    try {
      const data = await apiClient.get<{authUrl: string}>(
        `/api/v1/accounts/connect/${platformId.toLowerCase()}?workspaceId=${workspaceId}&redirectTo=settings`,
      )
      if (data?.authUrl) {
        window.location.href = data.authUrl
      }
    } catch (error) {
      console.error(`Failed to connect ${platformId}:`, error)
    }
  }

  const handleDisconnect = async (accountId: string) => {
    try {
      await apiClient.delete(`/api/v1/accounts/${accountId}`)
      setAccounts(accounts.filter(a => a._id !== accountId))
    } catch (error) {
      console.error("Failed to disconnect account:", error)
    }
  }

  const formatFollowers = (count: number) => {
    if (!count) return "0"
    if (count >= 1000000) return (count / 1000000).toFixed(1) + "M"
    if (count >= 1000) return (count / 1000).toFixed(1) + "K"
    return count.toString()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-48 shrink-0 space-y-0.5">
          {settingsSections.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all",
                activeSection === s.key
                  ? "bg-brand-soft text-brand"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Update Profile */}
          {activeSection === "profile" && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground">Update Profile</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Update your profile picture and personal details. These will appear across the workspace.
                </p>
              </div>

              {profileMessage && (
                <div
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-xl text-xs border",
                    profileMessage.kind === "ok"
                      ? "bg-success-soft text-success border-success/20"
                      : "bg-destructive/10 text-destructive border-destructive/20",
                  )}
                >
                  {profileMessage.kind === "ok"
                    ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                    : <XCircle className="w-4 h-4 shrink-0" />}
                  <span className="flex-1">{profileMessage.text}</span>
                </div>
              )}

              <div className="bg-card border border-border rounded-xl shadow-sm p-5 space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-5">
                  <div className="relative shrink-0">
                    {profileAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profileAvatar}
                        alt="Profile preview"
                        className="w-20 h-20 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-brand-soft border border-brand/20 flex items-center justify-center text-xl font-bold text-brand">
                        {initials}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand text-background flex items-center justify-center shadow-md hover:bg-brand/90 transition-colors"
                      aria-label="Change profile picture"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => handleAvatarFile(e.target.files?.[0])}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Profile picture</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      PNG, JPG, or WEBP up to 1.4 MB.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Upload new
                      </Button>
                      {profileAvatar && (
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => setProfileAvatar("")}
                          className="text-destructive hover:text-destructive"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    {avatarUploadError && (
                      <p className="text-[11px] text-destructive mt-1.5">{avatarUploadError}</p>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Personal details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">First name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        value={profileFirstName}
                        onChange={(e) => setProfileFirstName(e.target.value)}
                        placeholder="John"
                        maxLength={50}
                        className="w-full h-11 pl-10 pr-4 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Last name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        value={profileLastName}
                        onChange={(e) => setProfileLastName(e.target.value)}
                        placeholder="Doe"
                        maxLength={50}
                        className="w-full h-11 pl-10 pr-4 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-foreground">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <input
                        type="email"
                        value={user?.email ?? ""}
                        disabled
                        className="w-full h-11 pl-10 pr-4 bg-secondary/50 border border-border rounded-xl text-sm text-muted-foreground cursor-not-allowed"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Email changes are managed through Security → Change Email (coming soon).
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleProfileReset}
                    disabled={!profileDirty || profileSaving}
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleProfileSave}
                    disabled={!profileDirty || profileSaving}
                    className="gap-1.5 bg-brand hover:bg-brand/90 text-background"
                  >
                    {profileSaving ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
                    ) : (
                      <><Save className="w-3.5 h-3.5" />Save changes</>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Connected Accounts */}
          {activeSection === "accounts" && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground">Connected Accounts</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Manage the social accounts you publish to.</p>
              </div>
              <div className="bg-card border border-border rounded-xl shadow-sm divide-y divide-border overflow-hidden min-h-[100px]">
                {isLoadingAccounts ? (
                  <div className="flex items-center justify-center p-8 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Loading accounts...
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
                    No accounts connected yet.
                  </div>
                ) : (
                  accounts.map(acct => {
                    const config = getPlatformConfig(acct.platform)
                    const Icon = config.icon
                    const token = getTokenStatus(acct.tokenExpiresAt)
                    const needsReconnect = token.state === "expired" || token.state === "expiring"
                    return (
                      <div key={acct._id} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/20 transition-colors">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", config.bg)}>
                          <Icon className={cn("w-5 h-5", config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{acct.accountName || config.label}</p>
                          <p className="text-xs text-muted-foreground">@{acct.accountUsername || acct.platformAccountId} · {formatFollowers(acct.followerCount)} followers</p>
                          {token.state !== "none" && (
                            <p className={cn(
                              "text-[11px] mt-1 flex items-center gap-1",
                              token.state === "expired" ? "text-destructive"
                                : token.state === "expiring" ? "text-warning"
                                : "text-muted-foreground",
                            )}>
                              {needsReconnect && <AlertTriangle className="w-3 h-3 shrink-0" />}
                              {token.label}
                            </p>
                          )}
                        </div>
                        {needsReconnect && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-xs"
                            onClick={() => handleConnect(acct.platform)}
                          >
                            <RefreshCw className="w-3 h-3" />
                            Reconnect
                          </Button>
                        )}
                        {!acct.isActive ? (
                          <Badge className="bg-warning-soft text-warning border-0 text-xs">Disconnected</Badge>
                        ) : token.state === "expired" ? (
                          <Badge className="bg-destructive/10 text-destructive border-0 text-xs">Reconnect needed</Badge>
                        ) : (
                          <Badge className="bg-success-soft text-success border-0 text-xs">Connected</Badge>
                        )}
                        <button onClick={() => handleDisconnect(acct._id)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="bg-card border border-dashed border-border rounded-xl p-5">
                <p className="text-sm font-medium text-foreground mb-3">Add More Platforms</p>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_PLATFORMS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleConnect(p.id)}
                      className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-brand/40 hover:bg-brand-soft/20 transition-all text-sm text-muted-foreground hover:text-foreground")}
                    >
                      <div className={cn("w-6 h-6 rounded flex items-center justify-center", p.bg)}>
                        <p.icon className={cn("w-3.5 h-3.5", p.color)} />
                      </div>
                      {p.label}
                      <Plus className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Billing */}
          {activeSection === "billing" && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground">Billing & Plan</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Manage your subscription for the active workspace.</p>
              </div>
              {!activeWorkspace || !subscriptionInfo ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
                  Select a workspace to see its plan.
                </div>
              ) : (
                <>
                  {/* Current plan */}
                  <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-border bg-brand-soft/30">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg font-bold text-foreground capitalize">
                              {subscriptionInfo.plan} Plan
                            </span>
                            <Badge className="bg-brand text-white border-0 text-xs">Current</Badge>
                          </div>
                          <p className="text-2xl font-bold text-foreground">
                            {subscriptionInfo.monthlyPrice}
                            <span className="text-sm font-normal text-muted-foreground"> {subscriptionInfo.currency}/month</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Workspace: <span className="font-medium text-foreground">{activeWorkspace.name}</span>
                          </p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <a href="/pricing">Change Plan</a>
                        </Button>
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Included in your plan</p>
                      <div className="grid grid-cols-2 gap-2">
                        {subscriptionInfo.features.map(f => (
                          <div key={f} className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                            <span className="text-sm text-foreground">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Usage snapshot — uses live workspace stats */}
                  <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <p className="text-sm font-semibold text-foreground mb-3">Current Usage</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                        <p className="text-xs text-muted-foreground">Members</p>
                        <p className="text-lg font-bold text-foreground mt-0.5">
                          {activeWorkspace.members.length}/{activeWorkspace.memberLimit}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                        <p className="text-xs text-muted-foreground">Social Accounts</p>
                        <p className="text-lg font-bold text-foreground mt-0.5">
                          {activeWorkspace.socialAccounts}/{activeWorkspace.socialAccountLimit}
                        </p>
                      </div>
                    </div>
                  </div>

                  {subscriptionInfo.plan !== "free" && (
                    <div className="bg-card border border-destructive/30 rounded-xl p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        <p className="text-sm font-semibold text-destructive">Cancel Subscription</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Canceling will downgrade you to the free plan at the end of your billing period.
                      </p>
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/5" disabled>
                        Cancel Subscription
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Notifications */}
          {activeSection === "notifications" && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground">Notification Preferences</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Choose what you want to be notified about.</p>
              </div>
              <div className="bg-card border border-border rounded-xl shadow-sm divide-y divide-border overflow-hidden">
                {notificationSettings.map((n, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/20 transition-colors">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{n.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>
                    </div>
                    <button
                      onClick={() => setNotifications(prev => ({ ...prev, [i]: !prev[i] }))}
                      className="transition-colors"
                    >
                      {notifications[i]
                        ? <ToggleRight className="w-8 h-8 text-brand" />
                        : <ToggleLeft className="w-8 h-8 text-muted-foreground/40" />
                      }
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Security */}
          {activeSection === "security" && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground">Security Settings</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Manage your account security and authentication.</p>
              </div>
              <div className="space-y-3">
                {[
                  { icon: Key, label: "Change Password", description: "Update your password to keep your account secure", action: "Update" },
                  { icon: Shield, label: "Two-Factor Authentication", description: "Add an extra layer of security to your account", action: "Enable", badge: "Recommended" },
                  { icon: Bell, label: "Login Notifications", description: "Get notified when your account is accessed from a new device", action: "Configure" },
                ].map(item => (
                  <div key={item.label} className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center gap-4 hover:bg-secondary/20 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        {item.badge && (
                          <Badge className="bg-warning-soft text-warning border-0 text-[10px]">{item.badge}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1 shrink-0">
                      {item.action} <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Active sessions */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <p className="text-sm font-semibold text-foreground mb-1">Active Sessions</p>
                <p className="text-xs text-muted-foreground mb-3">
                  See where your account is signed in and revoke sessions you don't recognize.
                </p>
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Shield className="w-6 h-6 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Session tracking isn't available yet.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* API */}
          {activeSection === "api" && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground">API & Integrations</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Access the Postly API and connect third-party tools.</p>
              </div>

              {/* API key */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <p className="text-sm font-semibold text-foreground mb-1">API Key</p>
                <p className="text-xs text-muted-foreground mb-3">Use this key to authenticate API requests. Keep it secret!</p>
                <div className="flex items-center gap-2 p-3 bg-secondary border border-border rounded-lg font-mono text-xs">
                  <span className="flex-1 truncate text-foreground">
                    {showApiKey ? apiKey : apiKey.replace(/./g, "•").slice(0, 32) + "..."}
                  </span>
                  <button onClick={() => setShowApiKey(!showApiKey)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Integrations */}
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <p className="text-sm font-semibold text-foreground">Available Integrations</p>
                </div>
                {[
                  { name: "Zapier", description: "Automate workflows with 5,000+ apps" },
                  { name: "Slack", description: "Get post notifications in Slack channels" },
                  { name: "Google Analytics", description: "Track post performance in GA4" },
                  { name: "Canva", description: "Design and import media directly" },
                  { name: "Dropbox", description: "Import media from your Dropbox library" },
                ].map(item => (
                  <div key={item.name} className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-b-0 hover:bg-secondary/20 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
                      <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <Badge className="bg-secondary text-muted-foreground border-0 text-xs shrink-0">
                      Coming soon
                    </Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
