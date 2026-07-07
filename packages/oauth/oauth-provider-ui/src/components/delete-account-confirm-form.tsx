import { Trans } from '@lingui/react/macro'
import { useRef } from 'react'
import { FormField } from '#/components/forms/form-field.tsx'
import { InputPassword } from '#/components/forms/input-password.tsx'
import { InputToken } from '#/components/forms/input-token.tsx'
import {
  SmartForm,
  type WrappedSmartFormProps,
} from '#/components/forms/smart-form.tsx'

export type DeleteAccountConfirmData = {
  token: string
  password: string
}

export type DeleteAccountConfirmFormProps =
  WrappedSmartFormProps<DeleteAccountConfirmData> & {
    email?: string
    onResend: () => void | PromiseLike<void>
  }

export function DeleteAccountConfirmForm({
  email,
  onResend,
  ...props
}: DeleteAccountConfirmFormProps) {
  const pwdRef = useRef<HTMLInputElement>(null)
  return (
    <SmartForm
      {...props}
      submitColor="error"
      loading={props.loading}
      submitLabel={<Trans>Delete my account</Trans>}
      validate={({ token, password }) => {
        if (token && password) return { token, password }
      }}
      fields={({ values, set, setterFor }) => (
        <>
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

          <FormField label={<Trans>Confirmation code</Trans>}>
            <InputToken
              name="code"
              enterKeyHint="next"
              required
              autoFocus
              defaultValue={values.token}
              onToken={(value) => {
                set('token', value ?? undefined)
                if (value) pwdRef.current?.focus()
              }}
              onResend={onResend}
            />
          </FormField>

          <FormField label={<Trans>Password</Trans>}>
            <InputPassword
              ref={pwdRef}
              name="password"
              autoComplete="current-password"
              enterKeyHint="done"
              required
              defaultValue={values.password}
              onPassword={setterFor('password')}
            />
          </FormField>
        </>
      )}
    />
  )
}
