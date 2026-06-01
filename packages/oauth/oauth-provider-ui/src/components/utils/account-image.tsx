import { useLingui } from '@lingui/react/macro'
import { UserIcon } from '@phosphor-icons/react'
import { clsx } from 'clsx'
import { useEffect, useState } from 'react'
import type { Account } from '@atproto/oauth-provider-api'

export type AccountImageProps = {
  account?: Account
  size?: keyof typeof sizeMap
  className?: string
}

const sizeMap = {
  sm: 'size-5',
  md: 'size-6',
  lg: 'size-8',
  xl: 'size-12',
  '2xl': 'size-16',
  '3xl': 'size-24',
}

export function AccountImage({
  className = '',
  account,
  size = 'md',
}: AccountImageProps) {
  const [errored, setErrored] = useState(false)
  const { t } = useLingui()

  const src = account?.picture

  useEffect(() => {
    setErrored(false)
  }, [src])

  return src && !errored ? (
    <img
      aria-hidden
      src={src}
      alt={t`Account avatar`}
      className={clsx(`rounded-full`, sizeMap[size], className)}
      onError={() => setErrored(true)}
    />
  ) : (
    <div
      aria-hidden
      className={clsx(
        'bg-primary border-primary overflow-hidden rounded-full border-2 border-solid text-white',
        sizeMap[size],
        className,
      )}
    >
      <UserIcon className="size-full" />
    </div>
  )
}
