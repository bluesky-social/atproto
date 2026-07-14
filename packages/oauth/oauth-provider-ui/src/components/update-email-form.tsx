import { Trans } from '@lingui/react/macro'
import { FormField } from '#/components/forms/form-field.tsx'
import { InputEmailAddress } from '#/components/forms/input-email-address.tsx'
import { InputToken } from '#/components/forms/input-token.tsx'
import {
  SmartForm,
  type WrappedSmartFormProps,
} from '#/components/forms/smart-form.tsx'

export type UpdateEmailFormData = {
  email: string
  token: string
}

export type UpdateEmailFormProps =
  WrappedSmartFormProps<UpdateEmailFormData> & {
    emailCurrent?: string
    requestPending?: boolean
    confirmPending?: boolean
    onResend: () => void | PromiseLike<void>
  }

export function UpdateEmailForm({
  emailCurrent,
  requestPending,
  confirmPending,
  onResend,
  ...props
}: UpdateEmailFormProps) {
  return (
    <SmartForm
      {...props}
      loading={props.loading || requestPending}
      validate={({ email, token }) => {
        if (email && token) return { email, token }
      }}
      fields={({ values, set }) => (
        <>
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

          <FormField label={<Trans>New email address</Trans>}>
            <InputEmailAddress
              name="newEmail"
              required
              autoFocus
              defaultValue={values.email}
              onEmail={(value) => set('email', value)}
            />
          </FormField>

          <hr className="border-contrast-25 dark:border-contrast-50" />

          <div>
            <h3 className="text-text-default text-base font-semibold">
              <Trans>Security step required</Trans>
            </h3>
            <p className="mt-1">
              <Trans>
                Please enter the security code that was sent to your email
                address.
              </Trans>
            </p>
          </div>

          <FormField label={<Trans>Security code</Trans>}>
            <InputToken
              name="code"
              required
              autoFocus
              defaultValue={values.token}
              onToken={(value) => set('token', value ?? undefined)}
              onResend={onResend}
            />
          </FormField>
        </>
      )}
    />
  )
}
