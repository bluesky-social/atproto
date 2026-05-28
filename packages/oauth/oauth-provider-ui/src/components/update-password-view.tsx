import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { ButtonRequestCode } from '#/components/forms/button-request-code'
import { ResetPasswordConfirmForm } from '#/components/reset-password-confirm-form.tsx'

export type UpdatePasswordViewProps = {
  email: string
  requestPending?: boolean
  confirmPending?: boolean
  onRequest: () => void | PromiseLike<void>
  onConfirm: (data: {
    token: string
    password: string
  }) => void | PromiseLike<void>
}

export function UpdatePasswordView({
  email,
  requestPending,
  confirmPending,
  onRequest,
  onConfirm,
}: UpdatePasswordViewProps) {
  const [success, setSuccess] = useState(false)

  return (
    <div className="space-y-4">
      <p>
        <Trans context="PasswordReset">
          To reset your password, we'll send a verification code to{' '}
          <strong>{email}</strong>. Enter the code below to set a new password.
        </Trans>
      </p>

      <ButtonRequestCode
        action={onRequest}
        loading={requestPending}
        disabled={success}
        className="max-w-full"
      />

      <ResetPasswordConfirmForm
        disabled={success || confirmPending}
        onSubmit={async (data) => {
          await onConfirm(data)
          setSuccess(true)
        }}
      />
    </div>
  )
}
