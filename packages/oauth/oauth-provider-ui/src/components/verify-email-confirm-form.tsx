import { zodResolver } from '@hookform/resolvers/zod'
import { Trans } from '@lingui/react/macro'
import { useForm } from 'react-hook-form'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
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
    resolver: zodResolver(verifyEmailConfirmSchema),
    reValidateMode: 'onChange',
    defaultValues: { code: '' },
  })

  return (
    <FormShell
      {...props}
      form={form}
      // The API field is `token`; the form field is `code` so the rendered
      // input keeps the name the e2e suite selects on.
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
