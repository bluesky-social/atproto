import { Trans } from '@lingui/react/macro'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import type { Override } from '#/lib/util'

export type VerifyEmailConfirmData = { token: string }

export type VerifyEmailConfirmFormProps = Override<
  FormShellProps<VerifyEmailConfirmData>,
  {
    onResend?: () => void | PromiseLike<void>
  }
>

export function VerifyEmailConfirmForm({
  onResend,
  ...props
}: VerifyEmailConfirmFormProps) {
  return (
    <FormShell<VerifyEmailConfirmData> {...props}>
      <TokenField
        name="token"
        label={<Trans>Verification code</Trans>}
        enterKeyHint="done"
        required
        autoFocus
        onResend={onResend}
      />
    </FormShell>
  )
}
