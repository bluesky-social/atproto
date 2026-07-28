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
    // @NOTE Deliberately the react-hook-form default (validate on submit,
    // re-validate on change) rather than 'onBlur'. Validating on blur made
    // error messages appear under empty required fields at the first
    // interaction, shifting the layout mid-click. That is a real UX problem,
    // and it broke the e2e label click on the remember checkbox: pointerdown
    // landed on the label, the layout shifted, and mouseup landed elsewhere.
    // It also matches the previous SmartForm, which only validated on submit.
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
