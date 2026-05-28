import { Trans } from '@lingui/react/macro'
import { ReactNode } from '@tanstack/react-router'
import { ButtonRequestCode } from '#/components/forms/button-request-code.tsx'
import { VerifyEmailConfirmForm } from './verify-email-confirm-form.tsx'

export type VerifyEmailViewProps = {
  email: string
  requestPending?: boolean
  confirmPending?: boolean
  onRequest: () => void | PromiseLike<void>
  onConfirm: (data: { token: string }) => void | PromiseLike<void>
  /**
   * When set, renders a "Cancel" action on the Request and Confirm steps.
   * Used by callers that embed this view as an optional step in a larger flow
   * (e.g. the update-email view, where verification is abortable).
   */
  onCancel?: () => void
  cancelLabel?: ReactNode
  /**
   * When set, renders this content on the Request step instead of the default
   * instructions. Used by callers that want to provide additional context for
   * the verification step (e.g. the update-email view, which needs to explain
   * that the code is being sent to the old email address, not the new one).
   */
  children?: ReactNode
}

export function VerifyEmailView({
  email,
  requestPending,
  confirmPending,
  onRequest,
  onConfirm,
  onCancel,
  children,
  cancelLabel,
}: VerifyEmailViewProps) {
  return (
    <div className="space-y-4">
      {children ?? (
        <p>
          <Trans context="Email">
            To verify your email, we'll send a verification code to{' '}
            <strong>{email}</strong>. Enter the code below to confirm that you
            own this address.
          </Trans>
        </p>
      )}

      <ButtonRequestCode
        action={onRequest}
        loading={requestPending}
        disabled={confirmPending}
        className="max-w-full"
      />

      <VerifyEmailConfirmForm
        disabled={confirmPending}
        onCancel={onCancel}
        cancelLabel={cancelLabel}
        onSubmit={onConfirm}
      />
    </div>
  )
}
