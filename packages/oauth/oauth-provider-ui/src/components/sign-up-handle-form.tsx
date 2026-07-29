import { Trans } from '@lingui/react/macro'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { HandleString } from '@atproto/syntax'
import { Notice } from '#/components/feedback/notice.tsx'
import { HandleField } from '#/components/forms/fields/handle-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import { useStableCallback } from '#/hooks/use-stable-callback.ts'
import { schemaResolver } from '#/lib/form-resolver.ts'
import {
  type SignUpHandleValues,
  signUpHandleSchema,
} from '#/lib/form-schemas.ts'

export type SignUpHandleData = {
  handle: HandleString
}

export type SignUpHandleFormProps = Omit<
  FormShellProps<SignUpHandleValues>,
  'form' | 'onSubmit'
> & {
  domains: string[]
  values?: Partial<SignUpHandleData>
  onValues?: (values: Partial<SignUpHandleData>) => void
  handler: (
    data: SignUpHandleData,
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

export function SignUpHandleForm({
  domains,
  values,
  onValues,
  handler,
  children,
  ...props
}: SignUpHandleFormProps) {
  const form = useForm<SignUpHandleValues>({
    resolver: schemaResolver(signUpHandleSchema),
    reValidateMode: 'onChange',
    defaultValues: { handle: values?.handle ?? '' },
  })

  // @NOTE Mirror every keystroke back to the wizard, not just the submitted
  // values, so stepping Back and Forward again restores un-submitted input.
  const report = useStableCallback((next: unknown) => {
    onValues?.(next as Partial<SignUpHandleData>)
  })
  useEffect(() => {
    const sub = form.watch((next) => report(next))
    return () => sub.unsubscribe()
  }, [form, report])

  return (
    <FormShell
      {...props}
      form={form}
      onSubmit={(next, signal) => {
        onValues?.({ handle: next.handle as HandleString })
        return handler({ handle: next.handle as HandleString }, signal)
      }}
    >
      <HandleField
        control={form.control}
        name="handle"
        domains={domains}
        required
        autoFocus
      />

      <Notice role="note">
        <Trans>
          You can change this username to any domain name you control after your
          account is set up.
        </Trans>
      </Notice>

      {children}
    </FormShell>
  )
}
