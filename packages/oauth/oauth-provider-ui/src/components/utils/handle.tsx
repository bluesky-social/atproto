import { Trans, useLingui } from '@lingui/react/macro'
import { clsx } from 'clsx'
import { JSX } from 'react'
import { isValidHandle } from '@atproto/syntax'
import { Override } from '#/lib/util.ts'

export function isInvalidHandle(handle: string): boolean {
  return handle === 'handle.invalid' || !isValidHandle(handle)
}

export function stringifyHandle(handle?: string): string | undefined {
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
  className,
  ...props
}: HandleProps) {
  const { t } = useLingui()
  if (!handle) return undefined

  const isInvalid = isInvalidHandle(handle)

  return (
    <span
      {...props}
      className={clsx(
        { 'whitespace-nowrap': !isInvalid },
        // @NOTE We use pseudo elements here so that selecting the handle text
        // (or checking in tests) ignores the "⚠"/"@" prefix, which are only
        // meant to be visual indicators for the handle. We use pseudo element
        // instead of icons so that font size, weight, and color are consistent
        // with the handle text.
        isInvalid ? "before:content-['⚠']" : "before:content-['@']",
        className,
      )}
      aria-label={ariaLabel ?? t`Account username`}
      title={props.title ?? (isInvalid ? undefined : handle)}
    >
      {isInvalid ? <Trans>Invalid Handle</Trans> : handle}
    </span>
  )
}
