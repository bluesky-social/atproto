import { Trans } from '@lingui/react/macro'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { ButtonCooldown } from '#/components/forms/button-cooldown.tsx'
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

      <ButtonCooldown
        onClick={async () => {
          await resetPasswordRequest.mutateAsync({ email })
        }}
        cooldownSeconds={30}
        loading={resetPasswordRequest.isPending}
        disabled={success}
        className="max-w-full"
      >
        <PaperPlaneTiltIcon aria-hidden className="mr-2" weight="bold" />
        <span className="flex-1 truncate">
          <Trans context="PasswordReset">Send reset code</Trans>
        </span>
      </ButtonCooldown>

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
