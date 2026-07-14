import { Trans } from '@lingui/react/macro'
import { FormField } from '#/components/forms/form-field'
import { InputToken } from '#/components/forms/input-token.tsx'
import { SmartForm, WrappedSmartFormProps } from '#/components/forms/smart-form'

export type VerifyEmailConfirmData = { token: string }

export type VerifyEmailConfirmFormProps =
  WrappedSmartFormProps<VerifyEmailConfirmData> & {
    onResend?: () => void | PromiseLike<void>
  }

export function VerifyEmailConfirmForm({
  onResend,
  ...props
}: VerifyEmailConfirmFormProps) {
  return (
    <SmartForm
      {...props}
      validate={({ token }) => {
        if (token) return { token }
      }}
      fields={({ set, values }) => (
        <FormField label={<Trans>Verification code</Trans>}>
          <InputToken
            name="code"
            enterKeyHint="done"
            required
            autoFocus={true}
            defaultValue={values.token}
            onToken={(value) => set('token', value ?? undefined)}
            onResend={onResend}
          />
        </FormField>
      )}
    />
  )
}
