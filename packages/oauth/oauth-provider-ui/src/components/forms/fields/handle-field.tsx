import { Trans, useLingui } from '@lingui/react/macro'
import { AtSignIcon, CheckIcon, XIcon } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Input } from '#/components/ui/input.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx'
import { Handle } from '#/components/utils/handle.tsx'
import {
  MAX_FULL_LENGTH,
  MAX_LENGTH,
  MIN_LENGTH,
  type ValidDomain,
  isValidDomain,
} from '#/lib/handle.ts'
import { cn } from '#/lib/utils.ts'

export type HandleFieldProps = {
  label?: ReactNode
  /** List of available domains for the handle. */
  domains: readonly string[]
  defaultHandle?: string
  autoFocus?: boolean
  required?: boolean
}

/**
 * Composes a full handle out of a typed segment and a chosen domain.
 *
 * @NOTE Two named controls — `handle` for the segment, `domain` for the
 * suffix — so the form's values hold exactly what the user sees in each.
 * Callers join them with `composeHandle`.
 *
 * Deliberately not wrapped in a `Field.Root`: a Field binds every control
 * inside it to the field's own name, which would make the Select submit under
 * `handle` and clobber the segment. The length and charset rules are shown by
 * `ValidationMessage` below instead of a `Field.Error`.
 */
export function HandleField({
  label,
  domains: availableDomains,
  defaultHandle,
  autoFocus,
  required,
}: HandleFieldProps) {
  const { t } = useLingui()
  const domains = useMemo(
    () => availableDomains.filter(isValidDomain),
    [availableDomains],
  )

  const [domain, setDomain] = useState<ValidDomain | null>(() => {
    const matched =
      defaultHandle && domains.find((d) => defaultHandle.endsWith(d))
    return matched || domains[0] || null
  })

  const [segment, setSegment] = useState(() => {
    if (!defaultHandle || !domain) return ''
    return defaultHandle.endsWith(domain)
      ? defaultHandle.slice(0, -domain.length)
      : ''
  })

  const minLength = MIN_LENGTH
  const maxLength = domain
    ? Math.min(MAX_LENGTH, MAX_FULL_LENGTH - domain.length)
    : MAX_LENGTH
  const validLength = segment.length >= minLength && segment.length <= maxLength
  const validCharset = /^[a-z0-9][a-z0-9-]+[a-z0-9]$/.test(segment)
  const full = domain && validLength && validCharset ? segment + domain : ''

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label
          htmlFor="handle"
          className="flex w-fit items-center gap-2 text-sm font-medium leading-snug"
        >
          {label}
        </label>
      )}

      <div>
        <ValidationMessage hasValue={!!segment} valid={validLength}>
          <Trans>
            Between {minLength} and {maxLength} characters
          </Trans>
        </ValidationMessage>
        <ValidationMessage hasValue={!!segment} valid={validCharset}>
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
        <Input
          id="handle"
          name="handle"
          title={t`Type your username`}
          type="text"
          pattern="[a-z0-9][a-z0-9\-]+[a-z0-9]"
          minLength={MIN_LENGTH}
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
          onChange={(event) => setSegment(event.target.value.toLowerCase())}
        />

        {/* @NOTE Holds the domain itself rather than an index, so
          `Select.Value` renders it without a mapping function. */}
        {domains.length > 1 && (
          <div className="absolute right-1">
            <Select
              name="domain"
              value={domain ?? ''}
              onValueChange={(value) => setDomain(value as ValidDomain)}
            >
              <SelectTrigger size="sm" aria-label={t`Select domain`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {domains.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {domains.length <= 1 && (
        <input type="hidden" name="domain" value={domain ?? ''} />
      )}

      {/* @NOTE The conditional below is placeholder <0> of this Trans block.
        Do not add or reorder elements inside it. */}
      <span className="text-muted-foreground truncate text-sm">
        <Trans>
          Your full username will be:{' '}
          {full ? (
            <Handle className="text-foreground" handle={full} />
          ) : (
            <span
              aria-hidden
              className="bg-muted-foreground inline-block h-[1em] w-24 rounded-md align-middle"
            />
          )}
        </Trans>
      </span>
    </div>
  )
}

/** Joins the `handle` segment and `domain` suffix a HandleField contributes. */
export function composeHandle(values: {
  handle?: unknown
  domain?: unknown
}): string {
  return `${String(values.handle ?? '')}${String(values.domain ?? '')}`
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
            ? 'text-success'
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
