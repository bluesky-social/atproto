import { Trans, useLingui } from '@lingui/react/macro'
import { FormField } from '#/components/forms/form-field'
import { InputEmailAddress } from '#/components/forms/input-email-address.tsx'
import {
  SmartForm,
  type WrappedSmartFormProps,
} from '#/components/forms/smart-form'

export type ResetPasswordRequestData = { email: string }

export type ResetPasswordRequestFormProps =
  WrappedSmartFormProps<ResetPasswordRequestData> & {
    emailDefault?: string
  }

export function ResetPasswordRequestForm({
  emailDefault,

  // SmartFormProps
  ...props
}: ResetPasswordRequestFormProps) {
  const { t } = useLingui()

  return (
    <SmartForm
      {...props}
      validate={({ email }) => {
        if (email) return { email }
      }}
      fields={({ values, setterFor }) => (
        <FormField label={<Trans>Email address</Trans>}>
          <InputEmailAddress
            name="email"
            placeholder={t`Enter your email address`}
            title={t`Email address`}
            required
            autoFocus={true}
            defaultValue={values.email}
            onEmail={setterFor('email')}
          />
        </FormField>
      )}
    />
  )
}
