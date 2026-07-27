import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { HandleString } from '@atproto/syntax'
import { HandleField } from '#/components/forms/fields/handle-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import {
  type UpdateHandleValues,
  updateHandleSchema,
} from '#/lib/form-schemas.ts'

export type UpdateHandleDefaultData = {
  handle: HandleString
}

export type UpdateHandleDefaultFormProps = Omit<
  FormShellProps<UpdateHandleValues>,
  'form' | 'onSubmit'
> & {
  domains: string[]
  /** Seeds the field with the account's current handle. */
  handleDefault?: string
  handler: (
    data: UpdateHandleDefaultData,
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

export function UpdateHandleDefaultForm({
  domains,
  handleDefault,
  handler,
  ...props
}: UpdateHandleDefaultFormProps) {
  const form = useForm<UpdateHandleValues>({
    resolver: zodResolver(updateHandleSchema),
    reValidateMode: 'onChange',
    defaultValues: { handle: handleDefault ?? '' },
  })

  return (
    <FormShell
      {...props}
      form={form}
      // @NOTE HandleField only publishes a value once the composed handle is
      // valid, but the domain check is still asserted here — it mirrors the
      // previous validate(), which required the handle to end with one of the
      // available domains.
      onSubmit={(values, signal) => {
        const handle = values.handle as HandleString
        if (!domains.some((dom) => handle.endsWith(dom))) return
        return handler({ handle }, signal)
      }}
    >
      <HandleField
        control={form.control}
        name="handle"
        domains={domains}
        required
        autoFocus
      />
    </FormShell>
  )
}
