import { Trans } from '@lingui/react/macro'
import { EmailField } from '#/components/forms/fields/email-field.tsx'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import type { Override } from '#/lib/util.ts'

export type UpdateEmailFormData = {
  email: string
  token: string
}

export type UpdateEmailFormProps = Override<
  FormShellProps<UpdateEmailFormData>,
  {
    emailCurrent?: string
    /** Seeds the new-email field when re-opening the dialog. */
    newEmailDefault?: string
    onResend: () => void | PromiseLike<void>
  }
>

export function UpdateEmailForm({
  emailCurrent,
  newEmailDefault,
  onResend,
  ...props
}: UpdateEmailFormProps) {
  return (
    <FormShell<{ email: string; token: string }> {...props}>
      {emailCurrent && (
        // @NOTE For better password managers integration, we include a
        // hidden username field with the current email pre-filled.
        <>
          <input type="password" autoComplete="current-password" hidden />
          <input
            type="email"
            autoComplete="username"
            defaultValue={emailCurrent}
            readOnly
            hidden
          />
        </>
      )}

      <EmailField
        name="email"
        defaultValue={newEmailDefault ?? ''}
        label={<Trans>New email address</Trans>}
        required
        autoFocus
      />

      <Separator />

      <div>
        <h3 className="text-base font-semibold">
          <Trans>Security step required</Trans>
        </h3>
        <p className="mt-1">
          <Trans>
            Please enter the security code that was sent to your email address.
          </Trans>
        </p>
      </div>

      <TokenField
        name="token"
        label={<Trans>Security code</Trans>}
        required
        onResend={onResend}
      />
    </FormShell>
  )
}
