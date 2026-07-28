import { Trans, useLingui } from '@lingui/react/macro'
import { AtSignIcon } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
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
import { schemaResolver } from '#/lib/form-resolver.ts'
import {
  type UpdateHandleCustomValues,
  updateHandleCustomSchema,
} from '#/lib/form-schemas.ts'
import { InputHandleCustomInstructions } from './forms/input-handle-custom-instructions.tsx'

export type UpdateHandleCustomData = {
  handle: HandleString
}

export type UpdateHandleCustomFormProps = Omit<
  FormShellProps<UpdateHandleCustomValues>,
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

  const form = useForm<UpdateHandleCustomValues>({
    resolver: schemaResolver(updateHandleCustomSchema),
    reValidateMode: 'onChange',
    defaultValues: { domain: domainDefault ?? '' },
  })

  // The DNS/HTTP instructions update live as the user types.
  const domain = useWatch({ control: form.control, name: 'domain' })
  const handle = parseHandle(domain ?? '')

  return (
    <FormShell
      {...props}
      form={form}
      submittable={handle != null}
      onSubmit={(values, signal) => {
        const parsed = parseHandle(values.domain)
        if (!parsed) return
        return handler({ handle: parsed }, signal)
      }}
    >
      <TextField
        control={form.control}
        name="domain"
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
