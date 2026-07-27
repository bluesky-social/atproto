import { zodResolver } from '@hookform/resolvers/zod'
import { Trans } from '@lingui/react/macro'
import { useForm } from 'react-hook-form'
import { NewPasswordField } from '#/components/forms/fields/new-password-field.tsx'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
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
    resolver: zodResolver(resetPasswordConfirmSchema),
    // @NOTE Deliberately the react-hook-form default (validate on submit,
    // re-validate on change) rather than 'onBlur'. Validating on blur made
    // error messages appear under empty required fields at the first
    // interaction, shifting the layout mid-click. That is a real UX problem,
    // and it broke the e2e label click on the remember checkbox: pointerdown
    // landed on the label, the layout shifted, and mouseup landed elsewhere.
    // It also matches the previous SmartForm, which only validated on submit.
    reValidateMode: 'onChange',
    defaultValues: { code: '', password: '' },
  })

  return (
    <FormShell
      {...props}
      form={form}
      onSubmit={(values, signal) =>
        // @NOTE The API field is `token`; the form field is `code` so the
        // rendered input keeps the name the pds e2e suite selects on.
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
