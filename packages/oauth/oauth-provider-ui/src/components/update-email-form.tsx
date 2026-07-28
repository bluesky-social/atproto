import { Trans } from '@lingui/react/macro'
import { useForm } from 'react-hook-form'
import { EmailField } from '#/components/forms/fields/email-field.tsx'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import { schemaResolver } from '#/lib/form-resolver.ts'
import {
  type UpdateEmailValues,
  updateEmailSchema,
} from '#/lib/form-schemas.ts'

export type UpdateEmailFormData = {
  email: string
  token: string
}

export type UpdateEmailFormProps = Omit<
  FormShellProps<UpdateEmailValues>,
  'form' | 'onSubmit'
> & {
  emailCurrent?: string
  /** Seeds the new-email field when re-opening the dialog. */
  newEmailDefault?: string
  requestPending?: boolean
  confirmPending?: boolean
  onResend: () => void | PromiseLike<void>
  handler: (
    data: UpdateEmailFormData,
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

export function UpdateEmailForm({
  emailCurrent,
  newEmailDefault,
  requestPending,
  confirmPending: _confirmPending,
  onResend,
  handler,
  ...props
}: UpdateEmailFormProps) {
  const form = useForm<UpdateEmailValues>({
    resolver: schemaResolver(updateEmailSchema),
    reValidateMode: 'onChange',
    defaultValues: { newEmail: newEmailDefault ?? '', code: '' },
  })

  return (
    <FormShell
      {...props}
      form={form}
      loading={props.loading || requestPending}
      onSubmit={(values, signal) =>
        handler({ email: values.newEmail, token: values.code }, signal)
      }
    >
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
        control={form.control}
        name="newEmail"
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
        control={form.control}
        name="code"
        label={<Trans>Security code</Trans>}
        required
        onResend={onResend}
      />
    </FormShell>
  )
}
