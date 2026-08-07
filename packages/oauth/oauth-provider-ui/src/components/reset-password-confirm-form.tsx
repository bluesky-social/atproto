import { Trans } from '@lingui/react/macro'
import { NewPasswordField } from '#/components/forms/fields/new-password-field.tsx'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'

// @NOTE `code`, not `token`: the key becomes the rendered `name`, which is a
// public contract. The view maps it to the API's `token` field.
type Values = { code: string; password: string }

export type ResetPasswordConfirmData = {
  token: string
  password: string
}

export type ResetPasswordConfirmFormProps = Omit<
  FormShellProps<Values>,
  'onSubmit'
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
  return (
    <FormShell<Values>
      {...props}
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
        name="code"
        label={<Trans>Reset code</Trans>}
        enterKeyHint="next"
        required
        autoFocus
        onResend={onResend}
      />

      <NewPasswordField
        name="password"
        label={<Trans>New password</Trans>}
        enterKeyHint="done"
        required
      />
    </FormShell>
  )
}
