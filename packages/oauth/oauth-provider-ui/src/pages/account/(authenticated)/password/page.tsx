import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { ButtonRequestReset } from '#/components/forms/button-request-reset.tsx'
import { ResetPasswordConfirmForm } from '#/components/reset-password-confirm-form.tsx'
import { Admonition } from '#/components/utils/admonition.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import {
  useResetPasswordConfirm,
  useResetPasswordRequest,
} from '#/data/password.ts'

export function Page() {
  const [success, setSuccess] = useState(false)
  const { account } = useAuthenticatedSession()

  const { email } = account
  if (!email) {
    return (
      <Admonition role="status">
        <Trans context="PasswordReset">
          No email associated with this account. Password reset is unavailable.
        </Trans>
      </Admonition>
    )
  }

  const resetPasswordRequest = useResetPasswordRequest()
  const resetPasswordConfirm = useResetPasswordConfirm()

  return (
    <div className="space-y-4">
      <p>
        <Trans context="PasswordReset">
          To reset your password, we'll send a verification code to{' '}
          <strong>{email}</strong>. Enter the code below to set a new password.
        </Trans>
      </p>

      <ButtonRequestReset
        action={async () => resetPasswordRequest.mutateAsync({ email })}
        loading={resetPasswordRequest.isPending}
        disabled={success}
        className="max-w-full"
      />

      <ResetPasswordConfirmForm
        disabled={success || resetPasswordConfirm.isPending}
        onSubmit={async (data) => {
          await resetPasswordConfirm.mutateAsync(data)
          setSuccess(true)
        }}
      />
    </div>
  )
}
