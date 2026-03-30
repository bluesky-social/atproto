import { Trans } from '@lingui/react/macro'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { ButtonCooldown } from '#/components/forms/button-cooldown.tsx'
import { Button } from '#/components/forms/button.tsx'
import { ResetPasswordConfirmForm } from '#/components/reset-password-confirm-form.tsx'
import { Admonition } from '#/components/utils/admonition.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import {
  useResetPasswordConfirm,
  useResetPasswordRequest,
} from '#/data/password.ts'

enum Step {
  Initial,
  CodeSent,
}

export function Page() {
  const { account } = useAuthenticatedSession()
  const [step, setStep] = useState<Step>(Step.Initial)

  const { email } = account
  if (!email) {
    return (
      <Admonition type="alert">
        <Trans context="PasswordReset">
          No email associated with this account. Password reset is unavailable.
        </Trans>
      </Admonition>
    )
  }

  const resetPasswordRequest = useResetPasswordRequest()
  const resetPasswordConfirm = useResetPasswordConfirm()

  if (step === Step.Initial) {
    return (
      <div className="space-y-4">
        <p>
          <Trans context="PasswordReset">
            Click the button below to receive a password reset token via email.
            We'll send it to <strong>{email}</strong>.
          </Trans>
        </p>

        <div className="flex justify-center">
          <Button
            color="primary"
            onClick={async () => {
              await resetPasswordRequest.mutateAsync({ email })
              setStep(Step.CodeSent)
            }}
            loading={resetPasswordRequest.isPending}
          >
            <PaperPlaneTiltIcon className="mr-2" />
            <Trans context="PasswordReset">Send password reset email</Trans>
          </Button>
        </div>

        {resetPasswordRequest.isError && (
          <Admonition type="alert">
            <Trans context="PasswordReset">
              Failed to send password reset token. Please try again later.
            </Trans>
          </Admonition>
        )}
      </div>
    )
  }

  // CodeSent step
  return (
    <ResetPasswordConfirmForm
      disabled={resetPasswordConfirm.isPending}
      actions={
        <ButtonCooldown
          onClick={async () => resetPasswordRequest.mutateAsync({ email })}
          cooldownSeconds={30}
          initialCooldown={30}
          loading={resetPasswordRequest.isPending}
          transparent
        >
          <Trans context="PasswordReset">Resend email</Trans>
        </ButtonCooldown>
      }
      onSubmit={async (data) => {
        await resetPasswordConfirm.mutateAsync(data)
        setStep(Step.Initial)
      }}
    />
  )
}
