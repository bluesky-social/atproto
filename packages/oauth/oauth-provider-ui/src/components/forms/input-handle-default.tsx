import { Trans, useLingui } from '@lingui/react/macro'
import { AtIcon, CheckIcon, XIcon } from '@phosphor-icons/react'
import { composeRefs } from '@radix-ui/react-compose-refs'
import { clsx } from 'clsx'
import { type JSX, useCallback, useEffect, useRef, useState } from 'react'
import { type HandleString, isValidHandle } from '@atproto/syntax'
import { useStableCallback } from '#/hooks/use-stable-callback.ts'
import {
  MAX_FULL_LENGTH,
  MAX_LENGTH,
  MIN_LENGTH,
  type ValidDomain,
  isValidDomain,
} from '#/lib/handle.ts'
import type { Override } from '#/lib/util.ts'
import { Handle } from '../utils/handle.tsx'
import { InputText, type InputTextProps } from './input-text.tsx'

export type InputHandleProvidedProps = Override<
  Omit<
    InputTextProps,
    | 'type'
    | 'value'
    | 'defaultValue'
    | 'onChange'
    | 'append'
    | 'bellow'
    | 'pattern'
    | 'minLength'
    | 'maxLength'
  >,
  {
    /** Initial handle, used to seed the segment + selected domain. */
    handle?: HandleString
    /** Called whenever the current handle becomes valid or invalid. */
    onHandle?: (handle: HandleString | undefined) => void
    /** List of available domains for the handle */
    domains: string[]
  }
>

export function InputHandleDefault({
  domains: availableDomains,
  handle: handleInit,
  onHandle,

  // InputTextProps
  autoCapitalize = 'none',
  autoComplete = 'off',
  autoCorrect = 'off',
  dir = 'auto',
  icon = <AtIcon aria-hidden weight="bold" className="size-5" />,
  ref,
  title,
  ...props
}: InputHandleProvidedProps) {
  const { t } = useLingui()
  const domains = availableDomains.filter(isValidDomain)

  const inputRef = useRef<HTMLInputElement>(null)

  const [domainIdx, setDomainIdx] = useState(() => {
    if (!handleInit) return 0
    const idx = domains.findIndex((d) => handleInit.endsWith(d))
    return idx === -1 ? 0 : idx
  })
  const [segment, setSegment] = useState(() => {
    if (!handleInit) return ''
    const domain = domains[domainIdx]
    return handleInit.endsWith(domain)
      ? handleInit.slice(0, -domain.length)
      : ''
  })

  const domain: ValidDomain | null = domains[domainIdx] || domains[0] || null

  const { minLength, maxLength, validateSegment } = useSegmentValidator(domain)

  const [handle, setHandle] = useState<HandleString | undefined>(handleInit)
  const [validity, setValidity] = useState(() => validateSegment(segment))

  const update = useStableCallback((segment: string, domainIdx: number) => {
    const validity = validateSegment(segment)
    const domain = domains[domainIdx]
    const handle = domain && validity.valid && `${segment}${domain}`

    setSegment(segment)
    setValidity(validity)
    setDomainIdx(domainIdx)

    if (handle && isValidHandle(handle)) {
      setHandle(handle)
      onHandle?.(handle)
    } else {
      setHandle(undefined)
      onHandle?.(undefined)
    }
  })

  // Automatically update the domain index when the list length changes
  useEffect(() => {
    if (domainIdx >= domains.length) update(segment, 0)
  }, [update, segment, domains.length, domainIdx])

  return (
    <>
      <div>
        <ValidationMessage hasValue={!!segment} valid={validity.validLength}>
          <Trans>
            Between {minLength} and {maxLength} characters
          </Trans>
        </ValidationMessage>
        <ValidationMessage hasValue={!!segment} valid={validity.validCharset}>
          <Trans>Only letters, numbers, and hyphens</Trans>
        </ValidationMessage>
      </div>

      <InputText
        {...props}
        ref={composeRefs(ref, inputRef)}
        title={title ?? t`Type your username`}
        type="text"
        pattern="[a-z0-9][a-z0-9\-]+[a-z0-9]"
        minLength={minLength}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        dir={dir}
        icon={icon}
        value={segment}
        onChange={(event) => {
          const value = event.target.value.toLowerCase()

          // Ensure the input is always lowercase
          const selectionStart = event.target.selectionStart
          const selectionEnd = event.target.selectionEnd
          event.target.value = value
          event.target.setSelectionRange(selectionStart, selectionEnd)

          update(value, domainIdx)
        }}
        append={
          // @TODO refactor this to a separate component
          domains.length > 1 && (
            <select
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              value={domainIdx}
              aria-label={t`Select domain`}
              onChange={(event) => {
                update(segment, Number(event.target.value))
                inputRef.current?.focus()
              }}
              className={clsx(
                // Layout
                'block w-full',
                'rounded-lg',
                'p-2 pr-1',
                'text-sm',
                'cursor-pointer',
                // Transitions
                'transition duration-300 ease-in-out',
                // Border
                'outline-none',
                'focus:ring-primary focus:ring-2 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-black',
                // Color
                'accent-primary',
                'text-text-light',
                'hover:bg-gray-300 dark:hover:bg-gray-600',
                'bg-gray-200 dark:bg-gray-700',
              )}
            >
              {domains.map((d, idx) => (
                <option key={d} value={idx}>
                  {d}
                </option>
              ))}
            </select>
          )
        }
      >
        <span className="truncate">
          <Trans>
            Your full username will be:{' '}
            {handle ? (
              <Handle className="text-text-default" handle={handle} />
            ) : (
              <span
                aria-hidden
                className="bg-text-light inline-block h-[1em] w-24 rounded-md align-middle"
              />
            )}
          </Trans>
        </span>
      </InputText>
    </>
  )
}

function useSegmentValidator(domain: ValidDomain | null) {
  const minLen = MIN_LENGTH
  const maxLen = domain
    ? Math.min(MAX_LENGTH, MAX_FULL_LENGTH - domain.length)
    : MAX_LENGTH

  const validateSegment = useCallback(
    (segment: string) => {
      const validLength = segment.length >= minLen && segment.length <= maxLen
      const validCharset = /^[a-z0-9][a-z0-9-]+[a-z0-9]$/.test(segment)

      return { validLength, validCharset, valid: validLength && validCharset }
    },
    [maxLen, minLen],
  )

  return {
    minLength: minLen,
    maxLength: maxLen,
    validateSegment,
  }
}

type ValidationMessageProps = JSX.IntrinsicElements['div'] & {
  valid: boolean
  hasValue: boolean
}

function ValidationMessage({
  valid,
  hasValue,

  // div
  children,
  className,
  ...props
}: ValidationMessageProps) {
  const { t } = useLingui()
  return (
    <div
      {...props}
      className={clsx('flex flex-row items-center gap-2', className)}
    >
      {hasValue ? (
        <>
          {valid ? (
            <CheckIcon
              className="text-success inline-block h-4 w-4"
              aria-label={t`Valid`}
            />
          ) : (
            <XIcon
              className="text-error inline-block h-4 w-4"
              aria-label={t`Invalid`}
            />
          )}
        </>
      ) : (
        <div aria-hidden className="flex h-4 w-4 items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-gray-300 dark:bg-slate-600" />
        </div>
      )}
      <div className="text-sm">{children}</div>
    </div>
  )
}
