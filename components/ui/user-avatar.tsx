'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  /** Avatar source. Treated as an image URL only if it starts with http(s):// or data:image. */
  src?: string | null
  /** Full name used to derive the initials fallback. */
  name?: string | null
  className?: string
  /** Tailwind classes applied to the fallback (initials) tile. */
  fallbackClassName?: string
}

/**
 * Renders a user's avatar as an <img> when `src` is a real URL, falling back
 * to initials otherwise. Centralizes this rule so we don't accidentally
 * render a long Google avatar URL as raw text anywhere (it looks like an
 * "endless random string"). For Google accounts `src` is typically
 * `https://lh3.googleusercontent.com/a/…`; for email/password accounts it's
 * usually null and we show initials.
 */
export function UserAvatar({ src, name, className, fallbackClassName }: UserAvatarProps) {
  const isRenderableUrl =
    typeof src === 'string'
    && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:image/'))

  const initials =
    (name ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || 'U'

  return (
    <Avatar className={cn('size-8 shrink-0', className)}>
      {isRenderableUrl && (
        <AvatarImage
          src={src!}
          alt={name ?? 'User avatar'}
          referrerPolicy="no-referrer"
          className="object-cover"
        />
      )}
      <AvatarFallback
        className={cn(
          'bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-xs font-semibold',
          fallbackClassName,
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
