import { Trans, useLingui } from '@lingui/react/macro'
import { HashIcon } from 'lucide-react'
import { EmailField } from '#/components/forms/fields/email-field.tsx'
import { NewPasswordField } from '#/components/forms/fields/new-password-field.tsx'
import { TextField } from '#/components/forms/fields/text-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'

type Values = { email: string; password: string; inviteCode: string }

// @NOTE Because values here might be spread ({...val}) when used in calling
// code, we don't use optional properties and requires explicitly setting
// undefined values instead.
export type SignUpCredentialsData = {
  email: string
  password: string
  remember: boolean | undefined
  inviteCode: string | undefined
}

export type SignUpCredentialsFormProps = Omit<
  FormShellProps<Values>,
  'onSubmit' | 'onValues'
> & {
  inviteCodeRequired?: boolean
  rememberDefault?: boolean
  values?: Partial<SignUpCredentialsData>
  onValues?: (values: Partial<SignUpCredentialsData>) => void
  handler: (
    data: SignUpCredentialsData,
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

export function SignUpCredentialsForm({
  inviteCodeRequired = true,
  rememberDefault = undefined,
  values,
  onValues,
  handler,
  children,
  ...props
}: SignUpCredentialsFormProps) {
  const { t } = useLingui()

  return (
    <FormShell<Values>
      {...props}
      // @NOTE Mirror every edit back to the wizard, not just the submitted
      // values, so stepping Back and Forward again restores un-submitted input.
      onValues={(next) => onValues?.(next as Partial<SignUpCredentialsData>)}
      onSubmit={(next, signal) => {
        const data: SignUpCredentialsData = {
          email: next.email,
          password: next.password,
          remember: rememberDefault,
          inviteCode: inviteCodeRequired ? next.inviteCode : undefined,
        }

        onValues?.(data)
        return handler(data, signal)
      }}
    >
      {inviteCodeRequired && (
        <TextField
          name="inviteCode"
          defaultValue={values?.inviteCode ?? ''}
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
        defaultValue={values?.email ?? ''}
        label={<Trans>Email</Trans>}
        autoFocus={!inviteCodeRequired}
        autoComplete="username email"
        enterKeyHint="next"
        required
      />

      <NewPasswordField
        name="password"
        defaultValue={values?.password ?? ''}
        label={<Trans>Password</Trans>}
        enterKeyHint="next"
        required
      />

      {children}
    </FormShell>
  )
}
