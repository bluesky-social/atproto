import { zodResolver } from '@hookform/resolvers/zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { HashIcon } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { EmailField } from '#/components/forms/fields/email-field.tsx'
import { NewPasswordField } from '#/components/forms/fields/new-password-field.tsx'
import { TextField } from '#/components/forms/fields/text-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import { useStableCallback } from '#/hooks/use-stable-callback.ts'
import {
  type SignUpCredentialsValues,
  buildSignUpCredentialsSchema,
} from '#/lib/form-schemas.ts'

export type SignUpCredentialsData = {
  email: string
  password: string
  inviteCode?: string
}

export type SignUpCredentialsFormProps = Omit<
  FormShellProps<SignUpCredentialsValues>,
  'form' | 'onSubmit'
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

  const schema = useMemo(
    () => buildSignUpCredentialsSchema(inviteCodeRequired),
    [inviteCodeRequired],
  )

  const form = useForm<SignUpCredentialsValues>({
    resolver: zodResolver(schema),
    reValidateMode: 'onChange',
    defaultValues: {
      email: values?.email ?? '',
      password: values?.password ?? '',
      inviteCode: values?.inviteCode ?? '',
    },
  })

  // @NOTE Mirror every keystroke back to the wizard, not just the submitted
  // values, so stepping Back and Forward again restores un-submitted input —
  // the behaviour the previous SmartForm's onValues provided.
  const report = useStableCallback((next: unknown) => {
    onValues?.(next as Partial<SignUpCredentialsData>)
  })
  useEffect(() => {
    const sub = form.watch((next) => report(next))
    return () => sub.unsubscribe()
  }, [form, report])

  return (
    <FormShell
      {...props}
      form={form}
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
          control={form.control}
          name="inviteCode"
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
        control={form.control}
        name="email"
        label={<Trans>Email</Trans>}
        autoFocus={!inviteCodeRequired}
        autoComplete="username email"
        enterKeyHint="next"
        required
      />

      <NewPasswordField
        control={form.control}
        name="password"
        label={<Trans>Password</Trans>}
        enterKeyHint="next"
        required
      />

      {children}
    </FormShell>
  )
}
