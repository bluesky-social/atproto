import { Trans } from '@lingui/react/macro'
import { PasswordField } from '#/components/forms/fields/password-field.tsx'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import type { Override } from '#/lib/util.ts'

export type DeleteAccountConfirmData = {
  token: string
  password: string
}

export type DeleteAccountConfirmFormProps = Override<
  FormShellProps<DeleteAccountConfirmData>,
  {
    currentUsername?: string
    onResend: () => void | PromiseLike<void>
  }
>

export function DeleteAccountConfirmForm({
  currentUsername,
  onResend,
  ...props
}: DeleteAccountConfirmFormProps) {
  return (
    <FormShell<DeleteAccountConfirmData>
      {...props}
      submitVariant="destructive"
      submitLabel={<Trans>Delete my account</Trans>}
    >
      {currentUsername && (
        // For better password managers integration, we include a hidden
        // username field with the current username pre-filled.
        <input
          type="text"
          autoComplete="username"
          defaultValue={currentUsername}
          readOnly
          hidden
        />
      )}

      <TokenField
        name="token"
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
