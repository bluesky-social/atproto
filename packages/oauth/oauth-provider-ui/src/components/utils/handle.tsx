import { Trans, useLingui } from '@lingui/react/macro'
import { AtIcon, WarningIcon } from '@phosphor-icons/react'
import { JSX } from 'react'
import { isValidHandle } from '@atproto/syntax'
import { Override } from '#/lib/util'

export function isInvalidHandle(handle: string): boolean {
  return handle === 'handle.invalid' || !isValidHandle(handle)
}

export function sanitizeHandle(handle?: string): string | undefined {
  if (!handle) return undefined
  return isInvalidHandle(handle)
    ? '⚠Invalid Handle'
    : handle.startsWith('@')
      ? handle
      : `@${handle}`
}

export type HandleProps = Override<
  Omit<JSX.IntrinsicElements['span'], 'children'>,
  {
    handle?: string
  }
>

export function Handle({
  handle,

  // span
  'aria-label': ariaLabel,
  ...props
}: HandleProps) {
  const { t } = useLingui()
  if (!handle) return undefined

  return (
    <span {...props} aria-label={ariaLabel ?? t`Account username`}>
      {isInvalidHandle(handle) ? (
        <>
          <WarningIcon weight="bold" className="inline-block" aria-hidden />
          <Trans>Invalid Handle</Trans>
        </>
      ) : (
        <>
          <AtIcon weight="bold" className="inline-block" aria-hidden />
          {handle}
        </>
      )}
    </span>
  )
}
