import { Trans } from '@lingui/react/macro'
import { FormField } from '#/components/forms/form-field'
import { InputToken } from '#/components/forms/input-token.tsx'
import {
  SmartForm,
  type WrappedSmartFormProps,
} from '#/components/forms/smart-form'

export type DisableEmailAuthFactorData = { token: string }

export type DisableEmailAuthFactorConfirmFormProps =
  WrappedSmartFormProps<DisableEmailAuthFactorData> & {
    onResend?: () => void | PromiseLike<void>
  }

export function DisableEmailAuthFactorConfirmForm({
  onResend,
  ...props
}: DisableEmailAuthFactorConfirmFormProps) {
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
