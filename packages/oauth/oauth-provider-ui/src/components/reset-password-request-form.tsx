import { Trans, useLingui } from '@lingui/react/macro'
import { useForm } from 'react-hook-form'
import { EmailField } from '#/components/forms/fields/email-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import { schemaResolver } from '#/lib/form-resolver.ts'
import {
  type ResetPasswordRequestValues,
  resetPasswordRequestSchema,
} from '#/lib/form-schemas.ts'

export type ResetPasswordRequestData = { email: string }

export type ResetPasswordRequestFormProps = Omit<
  FormShellProps<ResetPasswordRequestValues>,
  'form' | 'onSubmit'
> & {
  emailDefault?: string
  handler: (
    data: ResetPasswordRequestData,
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

export function ResetPasswordRequestForm({
  emailDefault,
  handler,
  ...props
}: ResetPasswordRequestFormProps) {
  const { t } = useLingui()

  const form = useForm<ResetPasswordRequestValues>({
    resolver: schemaResolver(resetPasswordRequestSchema),
    // @NOTE Never `mode: 'onBlur'`: it renders errors under untouched
    // required fields, which shifts the layout between mousedown and mouseup
    // and silently drops the click.
    reValidateMode: 'onChange',
    defaultValues: { email: emailDefault ?? '' },
  })

  return (
    <FormShell
      {...props}
      form={form}
      onSubmit={(values, signal) => handler({ email: values.email }, signal)}
    >
      <EmailField
        control={form.control}
        name="email"
        label={<Trans>Email address</Trans>}
        placeholder={t`Enter your email address`}
        title={t`Email address`}
        required
        autoFocus
      />
    </FormShell>
  )
}
