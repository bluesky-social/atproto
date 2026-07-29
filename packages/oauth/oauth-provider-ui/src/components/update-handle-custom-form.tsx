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
import { InputHandleCustomInstructions } from './forms/input-handle-custom-instructions.tsx'

// @NOTE The key is `domain` even though the value is a full handle: the
// rendered `name` is a public contract.
type Values = { domain: string }

export type UpdateHandleCustomData = {
  handle: HandleString
}

export type UpdateHandleCustomFormProps = Omit<
  FormShellProps<Values>,
  'form' | 'onSubmit'
> & {
  did: string
  /** Seeds the field when re-opening the dialog. */
  domainDefault?: string
  handler: (
    data: UpdateHandleCustomData,
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

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
  ...props
}: UpdateHandleCustomFormProps) {
  const { t } = useLingui()

  // The DNS/HTTP instructions update live as the user types.
  const [domain, setDomain] = useState(domainDefault ?? '')
  const handle = parseHandle(domain)

  return (
    <FormShell<Values>
      {...props}
      submittable={handle != null}
      onSubmit={(values, signal) => {
        const parsed = parseHandle(values.domain)
        if (!parsed) return
        return handler({ handle: parsed }, signal)
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
