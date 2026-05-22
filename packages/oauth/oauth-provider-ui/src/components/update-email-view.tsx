import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { ButtonRequestReset } from '#/components/forms/button-request-reset'
import { ResetEmailConfirmForm } from '#/components/reset-email-confirm-form.tsx'
import { Button } from './forms/button.tsx'
import { VerifyEmailView } from './verify-email-view.tsx'

export type UpdateEmailViewProps = {
  email: string
  emailVerified?: boolean
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

enum ViewState {
  Idle,
  Verify,
  VerifyNew,
  Update,
}

export function UpdateEmailView({
  email,
  emailVerified,
  requestPending,
  confirmPending,
  verifyRequestPending,
  verifyConfirmPending,
  onRequest,
  onConfirm,
  onVerifyRequest,
  onVerifyConfirm,
}: UpdateEmailViewProps) {
  const [viewStateRaw, setViewState] = useState<ViewState>(ViewState.Idle)

  // Fool-proofing: if the email is already verified, we shouldn't be in a
  // "Verify" state.
  const viewState =
    emailVerified &&
    (viewStateRaw === ViewState.Verify || viewStateRaw === ViewState.VerifyNew)
      ? ViewState.Idle
      : viewStateRaw

  if (viewState === ViewState.Verify || viewState === ViewState.VerifyNew) {
    return (
      <VerifyEmailView
        email={email}
        requestPending={verifyRequestPending}
        confirmPending={verifyConfirmPending}
        onCancel={() => {
          setViewState(ViewState.Idle)
        }}
        onRequest={async () => {
          await onVerifyRequest({ email })
        }}
        onConfirm={async ({ token }) => {
          await onVerifyConfirm({ email, token })
          setViewState(ViewState.Idle)
        }}
      >
        {viewState === ViewState.VerifyNew && (
          <p>
            <Trans context="EmailVerify">
              Your email has been updated to <strong>{email}</strong>. A
              verification code has been sent to the new address. Enter the code
              below to confirm that you own this address.
            </Trans>
          </p>
        )}
      </VerifyEmailView>
    )
  }

  if (viewState === ViewState.Update) {
    return (
      <div className="space-y-4">
        <ResetEmailConfirmForm
          disabled={confirmPending}
          cancelLabel={<Trans>Cancel</Trans>}
          onCancel={() => {
            setViewState(ViewState.Idle)
          }}
          onSubmit={async (data, signal) => {
            await onConfirm(data)
            if (!signal.aborted) setViewState(ViewState.VerifyNew)
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

  return (
    <div>
      <p>
        <Trans context="EmailChange">
          Your current email is <strong>{email}</strong>.
        </Trans>
      </p>

      {emailVerified ? (
        <p>
          <Trans context="EmailChange">
            This email address has been verified.
          </Trans>
        </p>
      ) : (
        <p>
          <Trans context="EmailChange">
            This email address has not been verified. Please verify your email
            to access all features of your account.
          </Trans>
        </p>
      )}

      <div className="flex flex-row flex-wrap items-center justify-end space-x-2">
        <div className="flex-auto" />
        {!emailVerified && (
          <Button
            color="primary"
            onClick={() => {
              setViewState(ViewState.Verify)
            }}
          >
            <Trans>Verify email</Trans>
          </Button>
        )}
        <Button
          color="primary"
          onClick={() => {
            setViewState(ViewState.Update)
          }}
        >
          <Trans>Update email</Trans>
        </Button>
      </div>
    </div>
  )
}
