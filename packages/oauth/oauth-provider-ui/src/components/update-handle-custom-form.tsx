import { Trans, useLingui } from '@lingui/react/macro'
import { AtSignIcon } from 'lucide-react'
import { useState } from 'react'
import {
  type HandleString,
  isValidHandle,
  isValidTld,
  normalizeHandle,
} from '@atproto/syntax'
import { TextField } from '#/components/forms/fields/text-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import type { Override } from '#/lib/util.ts'
import { InputHandleCustomInstructions } from './forms/input-handle-custom-instructions.tsx'

export type UpdateHandleCustomData = {
  handle: HandleString
}

export type UpdateHandleCustomFormProps = Override<
  FormShellProps<UpdateHandleCustomData>,
  {
    did: string
    /** Seeds the field when re-opening the dialog. */
    domainDefault?: string
  }
>

/** Normalises typed input into a handle, or undefined when it is not yet one. */
function parseHandle(value: string): HandleString | undefined {
  const trimmed = normalizeHandle(value.trim())
  if (trimmed.length && isValidHandle(trimmed) && isValidTld(trimmed)) {
    return trimmed as HandleString
  }
  return undefined
}

export function UpdateHandleCustomForm({
  did,
  domainDefault,
  handler,
  onValues,
  ...props
}: UpdateHandleCustomFormProps) {
  const { t } = useLingui()

  // The DNS/HTTP instructions update live as the user types.
  const [domain, setDomain] = useState(domainDefault ?? '')
  const handle = parseHandle(domain)

  return (
    <FormShell<{
      domain: string
    }>
      {...props}
      submittable={handle != null}
      onValues={({ domain }) => {
        const handle = domain ? parseHandle(domain) : undefined
        onValues?.({ handle })
      }}
      handler={(values, signal) => {
        const handle = parseHandle(values.domain)
        // Fool-proofing (should be ensured by the "submittable" prop)
        if (!handle) {
          throw new Error('Invalid handle')
        }
        return handler({ handle }, signal)
      }}
    >
      <TextField
        name="domain"
        defaultValue={domainDefault ?? ''}
        onChange={(event) => setDomain(event.currentTarget.value)}
        label={<Trans>Enter the domain you want to use</Trans>}
        icon={<AtSignIcon className="size-5" />}
        type="text"
        title={t`Type your domain`}
        placeholder={t`alice.com`}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        dir="auto"
        required
        autoFocus
        enterKeyHint="done"
      />

      <InputHandleCustomInstructions
        className="text-sm"
        handle={handle}
        did={did}
      />
    </FormShell>
  )
}
