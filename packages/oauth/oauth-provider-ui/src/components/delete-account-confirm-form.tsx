import { zodResolver } from '@hookform/resolvers/zod'
import { Trans } from '@lingui/react/macro'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PasswordField } from '#/components/forms/fields/password-field.tsx'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import { otpCodeSchema } from '#/lib/form-schemas.ts'

const schema = z.object({
  // Field keys are the rendered `name` attributes the e2e suite selects on.
  code: otpCodeSchema,
  password: z.string().min(1),
})

type Values = z.infer<typeof schema>

export type DeleteAccountConfirmData = {
  token: string
  password: string
}

export type DeleteAccountConfirmFormProps = Omit<
  FormShellProps<Values>,
  'form' | 'onSubmit'
> & {
  email?: string
  onResend: () => void | PromiseLike<void>
  handler: (
    data: DeleteAccountConfirmData,
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

export function DeleteAccountConfirmForm({
  email,
  onResend,
  handler,
  ...props
}: DeleteAccountConfirmFormProps) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    reValidateMode: 'onChange',
    defaultValues: { code: '', password: '' },
  })

  return (
    <FormShell
      {...props}
      form={form}
      submitVariant="destructive"
      submitLabel={<Trans>Delete my account</Trans>}
      onSubmit={(values, signal) =>
        handler({ token: values.code, password: values.password }, signal)
      }
    >
      {email && (
        // For better password managers integration, we include a hidden
        // username field with the email pre-filled.
        <input
          type="text"
          autoComplete="username"
          defaultValue={email}
          readOnly
          hidden
        />
      )}

      <TokenField
        control={form.control}
        name="code"
        label={<Trans>Confirmation code</Trans>}
        enterKeyHint="next"
        required
        autoFocus
        onResend={onResend}
      />

      <PasswordField
        control={form.control}
        name="password"
        label={<Trans>Password</Trans>}
        autoComplete="current-password"
        enterKeyHint="done"
        required
      />
    </FormShell>
  )
}
