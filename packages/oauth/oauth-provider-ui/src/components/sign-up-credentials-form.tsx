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

export type SignUpCredentialsData = {
  email: string
  password: string
  inviteCode?: string
}

export type SignUpCredentialsFormProps = Omit<
  FormShellProps<Values>,
  'onSubmit' | 'onValues'
> & {
  inviteCodeRequired?: boolean
  values?: Partial<SignUpCredentialsData>
  onValues?: (values: Partial<SignUpCredentialsData>) => void
  handler: (
    data: SignUpCredentialsData,
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

export function SignUpCredentialsForm({
  inviteCodeRequired = true,
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
        const data: SignUpCredentialsData = inviteCodeRequired
          ? {
              email: next.email,
              password: next.password,
              inviteCode: next.inviteCode,
            }
          : { email: next.email, password: next.password }
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
