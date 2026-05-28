import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { ButtonRequestCode } from '#/components/forms/button-request-code.tsx'
import { ResetEmailConfirmForm } from '#/components/reset-email-confirm-form.tsx'
import { Button } from './forms/button.tsx'
import { FormCard } from './forms/form-card.tsx'
import { VerifyEmailView } from './verify-email-view.tsx'

export type UpdateEmailViewProps = {
  email: string
  initialState?: UpdateEmailViewState.Idle | UpdateEmailViewState.Verify
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

export enum UpdateEmailViewState {
  Idle,
  Verify,
  VerifyNew,
  Update,
}

export function UpdateEmailView({
  email,
  emailVerified,
  initialState = UpdateEmailViewState.Idle,
  requestPending,
  confirmPending,
  verifyRequestPending,
  verifyConfirmPending,
  onRequest,
  onConfirm,
  onVerifyRequest,
  onVerifyConfirm,
}: UpdateEmailViewProps) {
  const [viewStateRaw, setViewState] =
    useState<UpdateEmailViewState>(initialState)

  // Fool-proofing: if the email is already verified, we shouldn't be in a
  // "Verify" state.
  const viewState =
    emailVerified &&
    (viewStateRaw === UpdateEmailViewState.Verify ||
      viewStateRaw === UpdateEmailViewState.VerifyNew)
      ? UpdateEmailViewState.Idle
      : viewStateRaw

  if (
    viewState === UpdateEmailViewState.Verify ||
    viewState === UpdateEmailViewState.VerifyNew
  ) {
    return (
      <VerifyEmailView
        email={email}
        requestPending={verifyRequestPending}
        confirmPending={verifyConfirmPending}
        onCancel={() => {
          setViewState(UpdateEmailViewState.Idle)
        }}
        onRequest={async () => {
          await onVerifyRequest({ email })
        }}
        onConfirm={async ({ token }) => {
          await onVerifyConfirm({ email, token })
          setViewState(UpdateEmailViewState.Idle)
        }}
      >
        {viewState === UpdateEmailViewState.VerifyNew && (
          <p>
            <Trans context="Email">
              Your email has been updated to <strong>{email}</strong>. A
              verification code has been sent to the new address. Enter the code
              below to confirm that you own this address.
            </Trans>
          </p>
        )}
      </VerifyEmailView>
    )
  }

  if (viewState === UpdateEmailViewState.Update) {
    return (
      <div className="space-y-4">
        <ResetEmailConfirmForm
          disabled={confirmPending}
          cancelLabel={<Trans>Cancel</Trans>}
          onCancel={() => {
            setViewState(UpdateEmailViewState.Idle)
          }}
          onSubmit={async (data) => {
            await onConfirm(data)
            setViewState(UpdateEmailViewState.VerifyNew)
          }}
        >
          <p>
            <Trans context="Email">
              To change your email, we'll send a confirmation code to{' '}
              <strong>{email}</strong>. Enter the code below along with your new
              email address.
            </Trans>
          </p>

          <ButtonRequestCode
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
    <FormCard
      actions={
        <>
          {!emailVerified && (
            <Button
              color="primary"
              type="submit"
              onClick={() => {
                setViewState(UpdateEmailViewState.Verify)
              }}
            >
              <Trans context="Email">Verify</Trans>
            </Button>
          )}
          <Button
            color="primary"
            type={emailVerified ? 'button' : 'submit'}
            transparent={!emailVerified}
            onClick={() => {
              setViewState(UpdateEmailViewState.Update)
            }}
          >
            <Trans context="Email">Update</Trans>
          </Button>
        </>
      }
    >
      <p>
        <Trans context="Email">
          Your email address is <strong>{email}</strong>.
        </Trans>
      </p>

      <p className="mt-2 text-sm text-neutral-500">
        {emailVerified ? (
          <Trans context="Email">This email address has been verified.</Trans>
        ) : (
          <Trans context="Email">
            This email address has not been verified. Please verify your email
            to access all features of your account.
          </Trans>
        )}
      </p>
    </FormCard>
  )
}
