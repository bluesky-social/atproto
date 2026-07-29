import { Trans } from '@lingui/react/macro'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'

export type VerifyEmailConfirmData = { token: string }

type Values = { code: string }

export type VerifyEmailConfirmFormProps = Omit<
  FormShellProps<Values>,
  'onSubmit'
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
  return (
    <FormShell<Values>
      {...props}
      // The API field is `token`; the form field stays `code` so the rendered
      // input keeps its contracted name.
      onSubmit={(values, signal) => handler({ token: values.code }, signal)}
    >
      <TokenField
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
