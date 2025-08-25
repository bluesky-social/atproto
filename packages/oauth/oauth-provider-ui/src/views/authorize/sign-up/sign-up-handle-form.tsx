import { Trans, useLingui } from '@lingui/react/macro'
import { clsx } from 'clsx'
import { JSX, ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import {
  AsyncActionController,
  FormCardAsync,
  FormCardAsyncProps,
} from '../../../components/forms/form-card-async.tsx'
import { InputText } from '../../../components/forms/input-text.tsx'
import { Admonition } from '../../../components/utils/admonition.tsx'
import {
  AtSymbolIcon,
  CheckMarkIcon,
  XMarkIcon,
} from '../../../components/utils/icons.tsx'
import { mergeRefs } from '../../../lib/ref.ts'
import { Override } from '../../../lib/util.ts'

/**
 * Spec limit is 63, but in practice, we've limited it to 18 in our implementations.
 *
 * @see {@link https://atproto.com/specs/handle | ATProto Handle Spec}
 */
const MAX_LENGTH = 18

/**
 * Spec limit is 1, but in practice, we've targeted at least 3 characters in handles.
 *
 * @see {@link https://atproto.com/specs/handle | ATProto Handle Spec}
 */
const MIN_LENGTH = 3

/**
 * Spec limit is 253, but in practice, we've targeted 30 characters in handles.
 *
 * @see {@link https://atproto.com/specs/handle | ATProto Handle Spec}
 */
const MAX_FULL_LENGTH = 30

type ValidDomain = `.${string}`
const isValidDomain = (domain: string): domain is ValidDomain =>
  // Ignore domains that are so long that they would make the handle smaller
  // than MIN_LENGTH characters
  MIN_LENGTH + domain.length <= MAX_FULL_LENGTH &&
  // Basic validation here
  domain.startsWith('.') &&
  !domain.endsWith('.')

function useSegmentValidator(domain: ValidDomain) {
  const minLen = MIN_LENGTH
  const maxLen = Math.min(MAX_LENGTH, MAX_FULL_LENGTH - domain.length)

  const validateSegment = useCallback(
    (segment: string) => {
      const validLength = segment.length >= minLen && segment.length <= maxLen
      const validCharset = /^[a-z0-9][a-z0-9-]+[a-z0-9]$/g.test(segment)

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

export type SignUpHandleFormProps = Override<
  Omit<
    FormCardAsyncProps,
    'append' | 'onCancel' | 'cancelLabel' | 'onSubmit' | 'submitLabel'
  >,
  {
    domains: string[]

    onNext: (signal: AbortSignal) => void | PromiseLike<void>
    nextLabel?: ReactNode

    onPrev?: () => void
    prevLabel?: ReactNode

    handle?: string
    onHandle?: (handle: string | undefined) => void
  }
>

export function SignUpHandleForm({
  domains: availableDomains,

  onNext,
  nextLabel,

  onPrev,
  prevLabel,

  handle: handleInit,
  onHandle,

  // FormCardProps
  invalid,
  children,
  ref,
  ...props
}: SignUpHandleFormProps) {
  const { t } = useLingui()
  const domains = availableDomains.filter(isValidDomain)

  const formRef = useRef<AsyncActionController>(null)

  const [domainIdx, setDomainIdx] = useState(() => {
    const idx = domains.findIndex((d) => handleInit?.endsWith(d))
    return idx === -1 ? 0 : idx
  })
  const [segment, setSegment] = useState(() => handleInit?.split('.')[0] || '')

  // Automatically update the domain index when the list length changes
  useEffect(() => {
    setDomainIdx((v) => Math.min(v, domains.length - 1))
  }, [domains.length])

  const domain: ValidDomain | null = domains[domainIdx] || domains[0] || null

  const { minLength, maxLength, validateSegment } = useSegmentValidator(domain)

  const validity = validateSegment(segment)
  const handle = domain && validity.valid ? `${segment}${domain}` : undefined
  useEffect(() => {
    // Whenever the user changes the handle, abort any pending form action
    formRef.current?.reset()
    onHandle?.(handle)
  }, [onHandle, handle])

  const inputRef = useRef<HTMLInputElement>(null)

  const preview = `@${segment}${domain}`

  return (
    <FormCardAsync
      {...props}
      ref={mergeRefs([ref, formRef])}
      onCancel={onPrev}
      cancelLabel={prevLabel}
      onSubmit={onNext}
      submitLabel={nextLabel}
      invalid={invalid || !handle}
      append={children}
    >
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
        ref={inputRef}
        icon={<AtSymbolIcon className="w-5" />}
        name="handle"
        type="text"
        title={t`Type your desired username`}
        pattern="[a-z0-9][a-z0-9\-]+[a-z0-9]"
        minLength={minLength}
        maxLength={maxLength}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        dir="auto"
        enterKeyHint="done"
        autoFocus
        required
        value={segment}
        onChange={(event) => {
          const segment = event.target.value.toLowerCase()

          // Ensure the input is always lowercase
          const selectionStart = event.target.selectionStart
          const selectionEnd = event.target.selectionEnd
          event.target.value = segment
          event.target.setSelectionRange(selectionStart, selectionEnd)

          setSegment(segment)
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
                setDomainIdx(Number(event.target.value))
                inputRef.current?.focus()
              }}
              className={clsx(
                'block w-full',
                'text-sm',

                'accent-primary',
                'cursor-pointer',
                // Background
                'bg-gray-100 dark:bg-gray-800',
                'hover:bg-gray-200 dark:hover:bg-gray-700',
                // Border
                'transition duration-300 ease-in-out',
                'outline-none',
                'focus:ring-primary focus:ring-2 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-black',
                // Font
                'text-slate-600 dark:text-slate-300',
                // Layout
                'rounded-lg',
                'p-2 pr-1',
              )}
            >
              {domains.map((domain, idx) => (
                <option key={domain} value={idx}>
                  {domain}
                </option>
              ))}
            </select>
          )
        }
        bellow={
          <Trans>
            Your full username will be:{' '}
            {segment.length ? (
              <strong className="text-gray-800 dark:text-gray-200">
                {preview}
              </strong>
            ) : (
              <span
                aria-hidden
                className="w-24 rounded-md bg-gray-300 p-2 dark:bg-slate-600"
              />
            )}
          </Trans>
        }
      />

      <Admonition type="status">
        <Trans>
          You can change this username to any domain name you control after your
          account is set up.
        </Trans>
      </Admonition>
    </FormCardAsync>
  )
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
            <CheckMarkIcon
              className="text-success inline-block h-4 w-4"
              title={t`Valid`}
            />
          ) : (
            <XMarkIcon
              className="text-error inline-block h-4 w-4"
              title={t`Invalid`}
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
