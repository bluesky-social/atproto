import { Trans } from '@lingui/react/macro'
import { useRef } from 'react'
import { FormField } from '#/components/forms/form-field'
import { InputNewPassword } from '#/components/forms/input-new-password.tsx'
import { InputToken } from '#/components/forms/input-token.tsx'
import {
  SmartForm,
  type WrappedSmartFormProps,
} from '#/components/forms/smart-form'

export type ResetPasswordConfirmData = {
  token: string
  password: string
}

export type ResetPasswordConfirmFormProps =
  WrappedSmartFormProps<ResetPasswordConfirmData> & {
    email?: string
    onResend?: () => void | PromiseLike<void>
  }

export function ResetPasswordConfirmForm({
  email,
  onResend,
  ...props
}: ResetPasswordConfirmFormProps) {
  const passwordRef = useRef<HTMLInputElement>(null)
  return (
    <SmartForm
      {...props}
      validate={({ token, password }) => {
        if (token && password) return { token, password }
      }}
      fields={({ values, set, setterFor }) => {
        return (
          <>
            {email && (
              // For better password managers integration, we include a hidden
              // username field with the email pre-filled. This allows password
              // managers to associate the reset token and new password with the
              // correct account.
              <input
                type="text"
                autoComplete="username"
                defaultValue={email}
                readOnly
                hidden
              />
            )}

            <FormField label={<Trans>Reset code</Trans>}>
              <InputToken
                name="code"
                enterKeyHint="next"
                required
                autoFocus={true}
                defaultValue={values.token}
                onResend={onResend}
                onToken={(value) => {
                  set('token', value ?? undefined)
                  // Auto-focus next field when token is complete
                  if (value) passwordRef.current?.focus()
                }}
              />
            </FormField>

            <FormField label={<Trans>New password</Trans>}>
              <InputNewPassword
                ref={passwordRef}
                name="password"
                enterKeyHint="done"
                required
                defaultValue={values.password}
                onPassword={setterFor('password')}
              />
            </FormField>
          </>
        )
      }}
    />
  )
}
