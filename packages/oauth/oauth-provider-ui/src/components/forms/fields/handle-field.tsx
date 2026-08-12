import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { AtSignIcon } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Input } from '#/components/ui/input.tsx'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group.tsx'
import { HANDLE_SEGMENT_PATTERN } from '#/lib/form-patterns.ts'
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
 * The two controls stack rather than share a row. A domain beside the input
 * has to shrink, clip or wrap depending on how long it happens to be, so the
 * same field looked different per deployment. Full-width radio rows fit any
 * domain identically, show every option at once instead of hiding them behind
 * a listbox, and leave the input the whole line. The preview underneath is
 * what ties the two back together.
 *
 * Deliberately not wrapped in a `Field.Root`: a Field binds every control
 * inside it to the field's own name, which would make the domain submit under
 * `handle` and clobber the segment. The length and charset rules are shown by
 * the hint below instead of a `Field.Error`.
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
  const valid =
    segment.length >= minLength &&
    segment.length <= maxLength &&
    /^[a-z0-9][a-z0-9-]+[a-z0-9]$/.test(segment)

  // Stands in for the segment before anything is typed, so the preview can
  // show a whole handle from the start rather than a gap or a grey bar.
  const exampleSegment = t`yourname`

  // @NOTE The conditional below is placeholder {0} of this Trans block, and
  // the msgid it produces is the one the catalogs already carry. Do not add or
  // reorder elements inside it.
  const preview = (
    <Trans>
      Your full username will be:{' '}
      {segment ? (
        <span className="text-foreground block break-all font-medium">
          @{segment}
          {domain}
        </span>
      ) : (
        <span className="block break-all">
          @{exampleSegment}
          {domain}
        </span>
      )}
    </Trans>
  )

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
          placeholder={exampleSegment}
          type="text"
          pattern={HANDLE_SEGMENT_PATTERN}
          minLength={MIN_LENGTH}
          maxLength={maxLength}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          dir="auto"
          autoFocus={autoFocus}
          required={required}
          aria-describedby="handle-hint"
          className="pl-10"
          value={segment}
          onChange={(event) => setSegment(event.target.value.toLowerCase())}
        />
      </div>

      {/* @NOTE One line stating both rules, always rendered, so the row height
        never changes under the cursor mid-click — only its colour does. */}
      <p
        id="handle-hint"
        className={cn(
          'text-xs',
          !segment || valid ? 'text-muted-foreground' : 'text-destructive',
        )}
      >
        {/* @NOTE The noun agrees with the end of the range, so the plural is
          driven by `maxLength`. Locales with more than two plural categories
          need the form even though the count is never one here. */}
        {t`Use ${minLength}–${plural(maxLength, {
          one: '# letter, number or hyphen',
          other: '# letters, numbers or hyphens',
        })}`}
      </p>

      {domains.length > 1 ? (
        <>
          {/* @NOTE The radio value is the domain itself, so Base UI's own
            hidden input submits under `domain` with no mapping and no second
            source of truth. */}
          <RadioGroup
            name="domain"
            value={domain ?? ''}
            onValueChange={(value) => setDomain(value as ValidDomain)}
            aria-label={t`Select domain`}
            className="mt-1 gap-2"
          >
            {domains.map((d) => (
              <label
                key={d}
                htmlFor={`domain-${d}`}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                  'has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2',
                  d === domain
                    ? 'border-primary bg-accent/50'
                    : 'border-input hover:bg-accent/40',
                )}
              >
                <RadioGroupItem id={`domain-${d}`} value={d} />
                <span className="text-sm font-medium">{d}</span>
              </label>
            ))}
          </RadioGroup>

          <p className="text-muted-foreground mt-1 text-sm">{preview}</p>
        </>
      ) : (
        <>
          <input type="hidden" name="domain" value={domain ?? ''} />

          {/* @NOTE With no choice to make, the preview is the only thing
            showing the domain at all, so it gets a surface of its own rather
            than sitting as one more line of grey copy. */}
          <p className="bg-muted text-muted-foreground mt-1 rounded-lg px-3 py-2.5 text-sm">
            {preview}
          </p>
        </>
      )}
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
