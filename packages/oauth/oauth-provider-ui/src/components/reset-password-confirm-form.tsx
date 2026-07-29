import { Trans } from '@lingui/react/macro'
import { useForm } from 'react-hook-form'
import { NewPasswordField } from '#/components/forms/fields/new-password-field.tsx'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import { schemaResolver } from '#/lib/form-resolver.ts'
import {
  type ResetPasswordConfirmValues,
  resetPasswordConfirmSchema,
} from '#/lib/form-schemas.ts'

export type ResetPasswordConfirmData = {
  token: string
  password: string
}

export type ResetPasswordConfirmFormProps = Omit<
  FormShellProps<ResetPasswordConfirmValues>,
  'form' | 'onSubmit'
> & {
  email?: string
  onResend?: () => void | PromiseLike<void>
  handler: (
    data: ResetPasswordConfirmData,
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

export function ResetPasswordConfirmForm({
  email,
  onResend,
  handler,
  ...props
}: ResetPasswordConfirmFormProps) {
  const form = useForm<ResetPasswordConfirmValues>({
    resolver: schemaResolver(resetPasswordConfirmSchema),
    // @NOTE Never `mode: 'onBlur'`: it renders errors under untouched
    // required fields, which shifts the layout between mousedown and mouseup
    // and silently drops the click.
    reValidateMode: 'onChange',
    defaultValues: { code: '', password: '' },
  })

  return (
    <FormShell
      {...props}
      form={form}
      onSubmit={(values, signal) =>
        // @NOTE The API field is `token`; the form field stays `code` so the
        // rendered input keeps its contracted name.
        handler({ token: values.code, password: values.password }, signal)
      }
    >
      {email && (
        // For better password managers integration, we include a hidden
        // username field with the email pre-filled. This allows password
        // managers to associate the reset token and new password with the
        // correct account.
        <input
          type="text"
          autoComplete="username"
          defaultValue={email}
          readOnly
          hidden
        />
      )}

      <TokenField
        control={form.control}
        name="code"
        label={<Trans>Reset code</Trans>}
        enterKeyHint="next"
        required
        autoFocus
        onResend={onResend}
      />

      <NewPasswordField
        control={form.control}
        name="password"
        label={<Trans>New password</Trans>}
        enterKeyHint="done"
        required
      />
    </FormShell>
  )
}
