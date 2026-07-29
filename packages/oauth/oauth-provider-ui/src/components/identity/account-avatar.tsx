import { useLingui } from '@lingui/react/macro'
import { SnowflakeIcon, UserIcon } from 'lucide-react'
import type { JSX } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from '#/components/ui/avatar.tsx'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'

// @NOTE `ui/avatar` exposes only sm/default/lg. Callers here need a wider
// range than that — the account overview renders at `3xl`.
const sizeMap = {
  xs: 'size-3',
  sm: 'size-5',
  md: 'size-6',
  lg: 'size-8',
  xl: 'size-12',
  '2xl': 'size-16',
  '3xl': 'size-24',
} as const

const badgeSizeMap = {
  xs: 'size-1.5 ring-1 [&>svg]:hidden',
  sm: 'size-2 ring-1 [&>svg]:hidden',
  md: 'size-2.5 ring-1 [&>svg]:size-1.5',
  lg: 'size-3 ring-2 [&>svg]:size-2',
  xl: 'size-4 ring-2 [&>svg]:size-2.5',
  '2xl': 'size-5 ring-2 [&>svg]:size-3',
  '3xl': 'size-7 ring-4 [&>svg]:size-4',
} as const

export type AccountAvatarSize = keyof typeof sizeMap

export type AccountAvatarProps = Override<
  JSX.IntrinsicElements['div'],
  {
    account?: Account
    size?: AccountAvatarSize
  }
>

export function AccountAvatar({
  account,
  size = 'md',
  className,
  ...props
}: AccountAvatarProps) {
  const { t } = useLingui()

  return (
    <div className={cn('relative flex-none', className)} {...props}>
      <Avatar className={sizeMap[size]}>
        <AvatarImage src={account?.picture} alt={t`Account avatar`} />
        {/* @NOTE Left at the default `bg-muted` rather than a primary fill. */}
        <AvatarFallback>
          <UserIcon className="m-[10%] size-[80%]" />
        </AvatarFallback>
      </Avatar>

      {account?.deactivated && (
        <AvatarBadge
          aria-hidden
          className={cn(
            'bg-destructive text-white',
            'bottom-auto right-0 top-0',
            badgeSizeMap[size],
          )}
          title={t`Deactivated account`}
        >
          <SnowflakeIcon />
        </AvatarBadge>
      )}
    </div>
  )
}
