import { useLingui } from '@lingui/react/macro'
import { SnowflakeIcon, UserIcon } from '@phosphor-icons/react'
import { clsx } from 'clsx'
import { JSX, useEffect, useState } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import { Override } from '#/lib/util'

const sizeMap = {
  xs: 'size-3',
  sm: 'size-5',
  md: 'size-6',
  lg: 'size-8',
  xl: 'size-12',
  '2xl': 'size-16',
  '3xl': 'size-24',
}

const borderSizeMap = {
  xs: 'ring-1',
  sm: 'ring-1',
  md: 'ring-1',
  lg: 'ring-2',
  xl: 'ring-2',
  '2xl': 'ring-3',
  '3xl': 'ring-3',
}

export type AccountImageSize = keyof typeof sizeMap

export type AccountImageProps = Override<
  JSX.IntrinsicElements['div'],
  {
    account?: Account
    size?: AccountImageSize
  }
>

export function AccountImage({
  account,
  size = 'md',
  // div
  className,
  ...props
}: AccountImageProps) {
  const [errored, setErrored] = useState(false)
  const { t } = useLingui()

  const src = account?.picture

  useEffect(() => {
    setErrored(false)
  }, [src])

  return (
    <div {...props} className={clsx(`relative flex-none`, className)}>
      {src && !errored ? (
        <img
          aria-hidden
          src={src}
          alt={t`Account avatar`}
          className={clsx(`rounded-full`, sizeMap[size])}
          onError={() => setErrored(true)}
        />
      ) : (
        <div
          aria-hidden
          className={clsx(
            'bg-primary border-primary overflow-hidden rounded-full border-2 border-solid text-white',
            sizeMap[size],
          )}
        >
          <UserIcon className="m-[10%] size-[80%]" />
        </div>
      )}
      {account?.deactivated && (
        <div
          aria-hidden
          className={clsx(
            'bg-error absolute right-0 top-0 flex size-[30%] items-center justify-center rounded-full text-white ring-white dark:ring-black',
            borderSizeMap[size],
          )}
          title={t`Deactivated account`}
        >
          <SnowflakeIcon className="size-[70%]" />
        </div>
      )}
    </div>
  )
}
