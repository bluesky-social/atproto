import { Trans } from '@lingui/react/macro'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import type { Override } from '#/lib/util.ts'

export type DisableEmailAuthFactorData = { token: string }

export type DisableEmailAuthFactorConfirmFormProps = Override<
  FormShellProps<DisableEmailAuthFactorData>,
  {
    onResend?: () => void | PromiseLike<void>
  }
>

export function DisableEmailAuthFactorConfirmForm({
  onResend,
  ...props
}: DisableEmailAuthFactorConfirmFormProps) {
  return (
    <FormShell<DisableEmailAuthFactorData> {...props}>
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
