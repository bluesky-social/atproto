import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { ButtonRequestReset } from '#/components/forms/button-request-reset'
import { Button } from '#/components/forms/button.tsx'
import { ResetEmailConfirmForm } from '#/components/reset-email-confirm-form.tsx'
import { Admonition } from '#/components/utils/admonition.tsx'
import { VerifyEmailView } from './verify-email-view.tsx'

export type UpdateEmailViewProps = {
  email: string
  requestPending?: boolean
  confirmPending?: boolean
  verifyRequestPending?: boolean
  verifyConfirmPending?: boolean
  onRequest: () => void | PromiseLike<void>
  onConfirm: (data: {
    token: string
    email: string
  }) => void | PromiseLike<void>
  /**
   * Re-request a verification code for the *new* email (after the change has
   * been confirmed).
   */
  onVerifyRequest: (data: { email: string }) => void | PromiseLike<void>
  /**
   * Confirm the verification code for the *new* email.
   */
  onVerifyConfirm: (data: {
    email: string
    token: string
  }) => void | PromiseLike<void>
  onDone: () => void
}

enum Step {
  Request,
  Confirm,
  Verify,
}

export function UpdateEmailView({
  email,
  requestPending,
  confirmPending,
  verifyRequestPending,
  verifyConfirmPending,
  onRequest,
  onConfirm,
  onVerifyRequest,
  onVerifyConfirm,
  onDone,
}: UpdateEmailViewProps) {
  const [step, setStep] = useState<Step>(Step.Request)
  const [newEmail, setNewEmail] = useState<string | null>(null)

  if (step === Step.Verify && newEmail) {
    return (
      <div className="space-y-4">
        <Admonition role="note" variant="success">
          <Trans context="EmailChange">
            Your email has been updated to <strong>{newEmail}</strong>. A
            verification code has been sent to the new address.
          </Trans>
        </Admonition>

        <VerifyEmailView
          email={newEmail}
          skipRequest
          requestPending={verifyRequestPending}
          confirmPending={verifyConfirmPending}
          onRequest={() => onVerifyRequest({ email: newEmail })}
          onConfirm={({ token }) => onVerifyConfirm({ email: newEmail, token })}
          onCancel={onDone}
          onDone={onDone}
        />
      </div>
    )
  }

  if (step === Step.Confirm) {
    return (
      <div className="space-y-4">
        <p>
          <Trans context="EmailChange">
            Enter the confirmation code we sent to <strong>{email}</strong>{' '}
            along with your new email address.
          </Trans>
        </p>

        <ResetEmailConfirmForm
          disabled={confirmPending}
          onSubmit={async (data) => {
            await onConfirm(data)
            setNewEmail(data.email)
            setStep(Step.Verify)
          }}
        />

        <div className="flex items-center gap-2 text-sm">
          <Trans context="EmailChange">Didn't receive it?</Trans>
          <ButtonRequestReset action={onRequest} loading={requestPending} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p>
        <Trans context="EmailChange">
          To change your email, we'll send a confirmation code to{' '}
          <strong>{email}</strong>. On the next step you'll enter the code and
          your new email address.
        </Trans>
      </p>

      <ButtonRequestReset
        action={async () => {
          await onRequest()
          setStep(Step.Confirm)
        }}
        loading={requestPending}
        className="max-w-full"
      />

      <hr className="border-contrast-100 dark:border-contrast-200" />

      <Button onClick={() => setStep(Step.Confirm)}>
        <Trans context="EmailChange">I already have a code</Trans>
      </Button>
    </div>
  )
}
