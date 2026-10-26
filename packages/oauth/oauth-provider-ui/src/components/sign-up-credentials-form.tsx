import { Trans, useLingui } from '@lingui/react/macro'
import { HashIcon } from 'lucide-react'
import { EmailField } from '#/components/forms/fields/email-field.tsx'
import { NewPasswordField } from '#/components/forms/fields/new-password-field.tsx'
import { TextField } from '#/components/forms/fields/text-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import type { Override } from '#/lib/util'

// @NOTE Because values here might be spread ({...val}) when used in calling
// code, we don't use optional properties and requires explicitly setting
// undefined values instead.
export type SignUpCredentialsData = {
  email: string
  password: string
  remember: boolean | undefined
  inviteCode: string | undefined
}

export type SignUpCredentialsFormProps = Override<
  FormShellProps<SignUpCredentialsData>,
  {
    inviteCodeRequired?: boolean
    rememberDefault?: boolean
    defaultValues?: Partial<SignUpCredentialsData>
  }
>

export function SignUpCredentialsForm({
  inviteCodeRequired = true,
  rememberDefault: remember = undefined,
  defaultValues,
  onValues,
  handler,
  children,
  ...props
}: SignUpCredentialsFormProps) {
  const { t } = useLingui()

  return (
    <FormShell<{
      email: string
      password: string
      inviteCode: string
    }>
      {...props}
      // @NOTE Mirror every edit back to the wizard, not just the submitted
      // values, so stepping Back and Forward again restores un-submitted input.
      onValues={(values) =>
        onValues?.({
          email: values.email,
          password: values.password,
          inviteCode: values.inviteCode,
          remember,
        })
      }
      handler={({ inviteCode, email, password }, signal) => {
        // Fool-proofing (should be ensured by the form validation)
        if (inviteCodeRequired && !inviteCode) {
          throw new Error('Invite code is required')
        }
        return handler({ email, password, remember, inviteCode }, signal)
      }}
    >
      {inviteCodeRequired && (
        <TextField
          name="inviteCode"
          defaultValue={defaultValues?.inviteCode ?? ''}
          label={<Trans>Invite code</Trans>}
          icon={<HashIcon className="size-5" />}
          autoFocus
          title={t`Invite code`}
          placeholder={t`example-com-xxxxx-xxxxx`}
          required
          enterKeyHint="next"
        />
      )}

      <EmailField
        name="email"
        defaultValue={defaultValues?.email ?? ''}
        label={<Trans>Email</Trans>}
        autoFocus={!inviteCodeRequired}
        autoComplete="username email"
        enterKeyHint="next"
        required
      />

      <NewPasswordField
        name="password"
        defaultValue={defaultValues?.password ?? ''}
        label={<Trans>Password</Trans>}
        enterKeyHint="next"
        required
      />

      {children}
    </FormShell>
  )
}
