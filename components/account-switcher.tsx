"use client"

import { Instagram, Layers } from "lucide-react"
import { FaTiktok, FaFacebookF, FaLinkedinIn } from "react-icons/fa"
import { RiTwitterXFill } from "react-icons/ri"

import { cn } from "@/lib/utils"

export interface SwitchableAccount {
    _id: string
    platform: string
    accountName?: string
    accountUsername: string
    profilePictureUrl?: string
    followerCount?: number
}

interface AccountSwitcherProps {
    accounts: SwitchableAccount[]
    selectedAccountId: string | null
    onSelect: (accountId: string) => void
    /** Filter accounts by platform. Empty/undefined → no filter (all platforms). */
    platforms?: string[]
    /** Whether to show an "All accounts" tab. Defaults to true. */
    includeAll?: boolean
    /** Sentinel value for the "all" tab. Callers compare selectedAccountId === this. */
    allValue?: string
    onSelectAll?: () => void
}

const PLATFORM_CONFIG: Record<
    string,
    { label: string; icon: React.ElementType; color: string; bg: string }
> = {
    INSTAGRAM: { label: "Instagram", icon: Instagram, color: "text-pink-500", bg: "bg-pink-500/10" },
    INSTAGRAM_STANDALONE: { label: "Instagram", icon: Instagram, color: "text-pink-500", bg: "bg-pink-500/10" },
    TWITTER: { label: "X (Twitter)", icon: RiTwitterXFill, color: "text-foreground", bg: "bg-foreground/10" },
    LINKEDIN: { label: "LinkedIn", icon: FaLinkedinIn, color: "text-blue-600", bg: "bg-blue-600/10" },
    FACEBOOK: { label: "Facebook", icon: FaFacebookF, color: "text-blue-500", bg: "bg-blue-500/10" },
    TIKTOK: { label: "TikTok", icon: FaTiktok, color: "text-foreground", bg: "bg-foreground/10" },
}

function platformOf(key: string) {
    return PLATFORM_CONFIG[key] ?? PLATFORM_CONFIG.TWITTER
}

function normalizePlatform(p: string) {
    return p === "INSTAGRAM_STANDALONE" ? "INSTAGRAM" : p
}

export function AccountSwitcher({
    accounts,
    selectedAccountId,
    onSelect,
    platforms,
    includeAll = true,
    allValue = "__ALL__",
    onSelectAll,
}: AccountSwitcherProps) {
    const filtered = platforms?.length
        ? accounts.filter((a) => platforms.includes(normalizePlatform(a.platform)))
        : accounts

    if (filtered.length === 0) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-xs text-muted-foreground">
                No matching accounts connected.
            </div>
        )
    }

    return (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {includeAll && (
                <AccountTab
                    active={selectedAccountId === allValue}
                    onClick={() => (onSelectAll ? onSelectAll() : onSelect(allValue))}
                    label="All accounts"
                    sublabel={`${filtered.length} connected`}
                    iconNode={
                        <div className="w-7 h-7 rounded-full bg-brand-soft text-brand flex items-center justify-center">
                            <Layers className="w-3.5 h-3.5" />
                        </div>
                    }
                />
            )}
            {filtered.map((acc) => {
                const cfg = platformOf(acc.platform)
                const Icon = cfg.icon
                return (
                    <AccountTab
                        key={acc._id}
                        active={selectedAccountId === acc._id}
                        onClick={() => onSelect(acc._id)}
                        label={acc.accountName || cfg.label}
                        sublabel={acc.accountUsername ? `@${acc.accountUsername}` : cfg.label}
                        iconNode={
                            acc.profilePictureUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={acc.profilePictureUrl}
                                    alt={acc.accountName ?? acc.accountUsername}
                                    className="w-7 h-7 rounded-full object-cover"
                                />
                            ) : (
                                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center", cfg.bg)}>
                                    <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                                </div>
                            )
                        }
                    />
                )
            })}
        </div>
    )
}

function AccountTab({
    active,
    onClick,
    label,
    sublabel,
    iconNode,
}: {
    active: boolean
    onClick: () => void
    label: string
    sublabel: string
    iconNode: React.ReactNode
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all shrink-0 min-w-[180px]",
                active
                    ? "bg-brand-soft border-brand/30 shadow-sm"
                    : "bg-card border-border hover:border-foreground/20 hover:bg-secondary/50",
            )}
        >
            <span className="shrink-0">{iconNode}</span>
            <span className="flex-1 min-w-0 text-left">
                <span
                    className={cn(
                        "block text-xs font-semibold truncate",
                        active ? "text-brand" : "text-foreground",
                    )}
                >
                    {label}
                </span>
                <span className="block text-[10px] text-muted-foreground truncate">{sublabel}</span>
            </span>
        </button>
    )
}
