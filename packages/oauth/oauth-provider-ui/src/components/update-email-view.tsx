import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { ButtonRequestReset } from '#/components/forms/button-request-reset'
import { ResetEmailConfirmForm } from '#/components/reset-email-confirm-form.tsx'
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
}: UpdateEmailViewProps) {
  const [newEmail, setNewEmail] = useState<string | null>(null)

  if (newEmail) {
    return (
      <VerifyEmailView
        email={newEmail}
        requestPending={verifyRequestPending}
        confirmPending={verifyConfirmPending}
        onRequest={() => onVerifyRequest({ email: newEmail })}
        onConfirm={({ token }) => onVerifyConfirm({ email: newEmail, token })}
        onDone={() => setNewEmail(null)}
      >
        <p>
          <Trans context="EmailChange">
            Your email has been updated to <strong>{newEmail}</strong>. A
            verification code has been sent to the new address.
          </Trans>
        </p>
      </VerifyEmailView>
    )
  }

  return (
    <div className="space-y-4">
      <ResetEmailConfirmForm
        disabled={confirmPending}
        cancelLabel={<Trans>Cancel</Trans>}
        onSubmit={async (data, signal) => {
          await onConfirm(data)
          if (signal.aborted) return
          setNewEmail(data.email)
        }}
      >
        <p>
          <Trans context="EmailChange">
            To change your email, we'll send a confirmation code to{' '}
            <strong>{email}</strong>. Enter the code below along with your new
            email address.
          </Trans>
        </p>

        <ButtonRequestReset
          action={onRequest}
          loading={requestPending}
          disabled={confirmPending}
          className="max-w-full"
        />
      </ResetEmailConfirmForm>
    </div>
  )
}
