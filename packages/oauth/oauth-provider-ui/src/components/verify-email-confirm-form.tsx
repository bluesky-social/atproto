import { Trans } from '@lingui/react/macro'
import { useForm } from 'react-hook-form'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import { schemaResolver } from '#/lib/form-resolver.ts'
import {
  type VerifyEmailConfirmValues,
  verifyEmailConfirmSchema,
} from '#/lib/form-schemas.ts'

export type VerifyEmailConfirmData = { token: string }

export type VerifyEmailConfirmFormProps = Omit<
  FormShellProps<VerifyEmailConfirmValues>,
  'form' | 'onSubmit'
> & {
  onResend?: () => void | PromiseLike<void>
  handler: (
    data: VerifyEmailConfirmData,
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

export function VerifyEmailConfirmForm({
  onResend,
  handler,
  ...props
}: VerifyEmailConfirmFormProps) {
  const form = useForm<VerifyEmailConfirmValues>({
    resolver: schemaResolver(verifyEmailConfirmSchema),
    reValidateMode: 'onChange',
    defaultValues: { code: '' },
  })

  return (
    <FormShell
      {...props}
      form={form}
      // The API field is `token`; the form field stays `code` so the rendered
      // input keeps its contracted name.
      onSubmit={(values, signal) => handler({ token: values.code }, signal)}
    >
      <TokenField
        control={form.control}
        name="code"
        label={<Trans>Verification code</Trans>}
        enterKeyHint="done"
        required
        autoFocus
        onResend={onResend}
      />
    </FormShell>
  )
}
