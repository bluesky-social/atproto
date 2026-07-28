import { Trans, useLingui } from '@lingui/react/macro'
import { AtSignIcon, CheckIcon, XIcon } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { type HandleString, isValidHandle } from '@atproto/syntax'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '#/components/ui/form.tsx'
import { Input } from '#/components/ui/input.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx'
import { Handle } from '#/components/utils/handle.tsx'
import { useStableCallback } from '#/hooks/use-stable-callback.ts'
import {
  MAX_FULL_LENGTH,
  MAX_LENGTH,
  MIN_LENGTH,
  type ValidDomain,
  isValidDomain,
} from '#/lib/handle.ts'
import { cn } from '#/lib/utils.ts'

export type HandleFieldProps<TValues extends FieldValues> = {
  control: Control<TValues>
  name: FieldPath<TValues>
  label?: ReactNode
  /** List of available domains for the handle. */
  domains: readonly string[]
  autoFocus?: boolean
  required?: boolean
}

/**
 * Composes a full handle out of a user-typed segment and a chosen domain.
 *
 * @NOTE This is the one field that cannot simply wrap an input: the value the
 * form stores (a full `HandleString`) is derived from two controls. It owns the
 * segment/domain state internally and publishes only the composed handle — the
 * same split the previous `InputHandleDefault` used.
 */
export function HandleField<TValues extends FieldValues>({
  control,
  name,
  label,
  domains: availableDomains,
  autoFocus,
  required,
}: HandleFieldProps<TValues>) {
  const domains = availableDomains.filter(isValidDomain)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <HandleFieldInner
          domains={domains}
          label={label}
          autoFocus={autoFocus}
          required={required}
          inputRef={inputRef}
          initialHandle={field.value as HandleString | undefined}
          onHandle={(handle) => field.onChange(handle ?? '')}
          onBlur={field.onBlur}
          fieldName={field.name}
        />
      )}
    />
  )
}

function HandleFieldInner({
  domains,
  label,
  autoFocus,
  required,
  inputRef,
  initialHandle,
  onHandle,
  onBlur,
  fieldName,
}: {
  domains: ValidDomain[]
  label?: ReactNode
  autoFocus?: boolean
  required?: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  initialHandle?: HandleString
  onHandle: (handle: HandleString | undefined) => void
  onBlur: () => void
  fieldName: string
}) {
  // @NOTE useLingui() must be called here rather than receiving `t` as a prop:
  // the Lingui macro only transforms t in a scope that imports the hook,
  // so passing t down silently left the strings untranslated and dropped them
  // from the catalogs.
  const { t } = useLingui()
  const [domainIdx, setDomainIdx] = useState(() => {
    if (!initialHandle) return 0
    const idx = domains.findIndex((d) => initialHandle.endsWith(d))
    return idx === -1 ? 0 : idx
  })
  const [segment, setSegment] = useState(() => {
    if (!initialHandle) return ''
    const domain = domains[domainIdx]
    return domain && initialHandle.endsWith(domain)
      ? initialHandle.slice(0, -domain.length)
      : ''
  })

  const domain: ValidDomain | null = domains[domainIdx] || domains[0] || null
  const { minLength, maxLength, validateSegment } = useSegmentValidator(domain)

  const [handle, setHandle] = useState<HandleString | undefined>(initialHandle)
  const [validity, setValidity] = useState(() => validateSegment(segment))

  const update = useStableCallback((segment: string, domainIdx: number) => {
    const validity = validateSegment(segment)
    const domain = domains[domainIdx]
    const next = domain && validity.valid && `${segment}${domain}`

    setSegment(segment)
    setValidity(validity)
    setDomainIdx(domainIdx)

    if (next && isValidHandle(next)) {
      setHandle(next)
      onHandle(next)
    } else {
      setHandle(undefined)
      onHandle(undefined)
    }
  })

  // Automatically update the domain index when the list length changes
  useEffect(() => {
    if (domainIdx >= domains.length) update(segment, 0)
  }, [update, segment, domains.length, domainIdx])

  return (
    <FormItem>
      {label && <FormLabel>{label}</FormLabel>}

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

      <div className="relative flex items-center">
        <span
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute left-3 flex items-center"
        >
          <AtSignIcon className="size-5" />
        </span>
        <FormControl>
          <Input
            ref={inputRef}
            name={fieldName}
            title={t`Type your username`}
            type="text"
            pattern="[a-z0-9][a-z0-9\-]+[a-z0-9]"
            minLength={minLength}
            maxLength={maxLength}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            dir="auto"
            autoFocus={autoFocus}
            required={required}
            className={cn('pl-10', domains.length > 1 && 'pr-40')}
            value={segment}
            onBlur={onBlur}
            onChange={(event) => {
              const value = event.target.value.toLowerCase()

              // Ensure the input is always lowercase
              const selectionStart = event.target.selectionStart
              const selectionEnd = event.target.selectionEnd
              event.target.value = value
              event.target.setSelectionRange(selectionStart, selectionEnd)

              update(value, domainIdx)
            }}
          />
        </FormControl>

        {domains.length > 1 && (
          <div className="absolute right-1">
            <Select
              value={String(domainIdx)}
              onValueChange={(value) => {
                update(segment, Number(value))
                inputRef.current?.focus()
              }}
            >
              <SelectTrigger size="sm" aria-label={t`Select domain`}>
                {/* @NOTE Base UI's `Select.Value` renders the raw `value` and
                  needs a function to map it to a label — unlike Radix's, which
                  echoed the selected item's own content. The value here is the
                  domain's index, so without this the trigger read "0". */}
                <SelectValue>
                  {(value) => domains[Number(value)] ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {domains.map((d, idx) => (
                  <SelectItem key={d} value={String(idx)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* @NOTE The conditional below is placeholder <0> of this Trans block.
        Do not add or reorder elements inside it. */}
      <span className="text-muted-foreground truncate text-sm">
        <Trans>
          Your full username will be:{' '}
          {handle ? (
            <Handle className="text-foreground" handle={handle} />
          ) : (
            <span
              aria-hidden
              className="bg-muted-foreground inline-block h-[1em] w-24 rounded-md align-middle"
            />
          )}
        </Trans>
      </span>

      <FormMessage />
    </FormItem>
  )
}

function ValidationMessage({
  hasValue,
  valid,
  children,
}: {
  hasValue: boolean
  valid: boolean
  children: ReactNode
}) {
  const { t } = useLingui()
  return (
    <p
      className={cn(
        'flex items-center gap-1 text-xs',
        !hasValue
          ? 'text-muted-foreground'
          : valid
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-destructive',
      )}
    >
      {/* @NOTE The indicator always occupies the same box, including before
        the user types. Reserving the space keeps the row height constant so
        the layout cannot shift under the cursor mid-click. */}
      <span
        aria-hidden
        className="inline-flex size-3 items-center justify-center"
      >
        {hasValue ? (
          valid ? (
            <CheckIcon aria-label={t`Valid`} className="size-3" />
          ) : (
            <XIcon aria-label={t`Invalid`} className="size-3" />
          )
        ) : (
          <span className="bg-muted-foreground/40 size-1.5 rounded-full" />
        )}
      </span>
      {children}
    </p>
  )
}

function useSegmentValidator(domain: ValidDomain | null) {
  const minLength = MIN_LENGTH
  const maxLength = domain
    ? Math.min(MAX_LENGTH, MAX_FULL_LENGTH - domain.length)
    : MAX_LENGTH

  const validateSegment = (segment: string) => {
    const validLength =
      segment.length >= minLength && segment.length <= maxLength
    // @NOTE `+` not `*` — matches the original exactly. It requires at least
    // three characters, consistent with MIN_LENGTH.
    const validCharset = /^[a-z0-9][a-z0-9-]+[a-z0-9]$/.test(segment)
    return { validLength, validCharset, valid: validLength && validCharset }
  }

  return { minLength, maxLength, validateSegment }
}
