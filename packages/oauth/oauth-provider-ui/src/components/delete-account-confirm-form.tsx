import { Trans } from '@lingui/react/macro'
import { PasswordField } from '#/components/forms/fields/password-field.tsx'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'

type Values = { code: string; password: string }

export type DeleteAccountConfirmData = {
  token: string
  password: string
}

export type DeleteAccountConfirmFormProps = Omit<
  FormShellProps<Values>,
  'onSubmit'
> & {
  email?: string
  onResend: () => void | PromiseLike<void>
  handler: (
    data: DeleteAccountConfirmData,
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

export function DeleteAccountConfirmForm({
  email,
  onResend,
  handler,
  ...props
}: DeleteAccountConfirmFormProps) {
  return (
    <FormShell<Values>
      {...props}
      submitVariant="destructive"
      submitLabel={<Trans>Delete my account</Trans>}
      onSubmit={(values, signal) =>
        handler({ token: values.code, password: values.password }, signal)
      }
    >
      {email && (
        // For better password managers integration, we include a hidden
        // username field with the email pre-filled.
        <input
          type="text"
          autoComplete="username"
          defaultValue={email}
          readOnly
          hidden
        />
      )}

      <TokenField
        name="code"
        label={<Trans>Confirmation code</Trans>}
        enterKeyHint="next"
        required
        autoFocus
        onResend={onResend}
      />

      <PasswordField
        name="password"
        label={<Trans>Password</Trans>}
        autoComplete="current-password"
        enterKeyHint="done"
        required
      />
    </FormShell>
  )
}
