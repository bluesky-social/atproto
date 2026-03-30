import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { Button } from '#/components/forms/button.tsx'
import { LayoutTitle } from './layouts/layout-title.tsx'
import { ResetPasswordConfirmForm } from './reset-password-confirm-form.tsx'
import { ResetPasswordRequestForm } from './reset-password-request-form.tsx'

export type ResetPasswordViewProps = {
  emailDefault?: string
  onResetPasswordRequest: (
    data: { email: string },
    signal: AbortSignal,
  ) => void | PromiseLike<void>
  onResetPasswordConfirm: (
    data: {
      token: string
      password: string
    },
    signal: AbortSignal,
  ) => void | PromiseLike<void>
  onBack: () => void
}

enum View {
  RequestReset,
  ConfirmReset,
  PasswordUpdated,
}

export function ResetPasswordView({
  emailDefault,
  onResetPasswordRequest,
  onResetPasswordConfirm,
  onBack,
}: ResetPasswordViewProps) {
  const { t } = useLingui()
  const [view, setView] = useState<View>(View.RequestReset)

  if (view === View.RequestReset) {
    return (
      <LayoutTitle
        title={t`Forgot Password`}
        subtitle={<Trans>Let's get your password reset!</Trans>}
      >
        <ResetPasswordRequestForm
          emailDefault={emailDefault}
          submitLabel={<Trans>Next</Trans>}
          onSubmit={async (data, signal) => {
            await onResetPasswordRequest(data, signal)
            if (!signal.aborted) setView(View.ConfirmReset)
          }}
          cancelLabel={<Trans>Back</Trans>}
          onCancel={onBack}
        />
        <hr className="my-5 border-gray-300 dark:border-gray-700" />
        <center>
          <Button transparent onClick={() => setView(View.ConfirmReset)}>
            <Trans>Already have a code?</Trans>
          </Button>
        </center>
      </LayoutTitle>
    )
  }

  if (view === View.ConfirmReset) {
    return (
      <LayoutTitle
        title={msg`Reset Password`}
        subtitle={
          <Trans>Enter the code you received to reset your password.</Trans>
        }
      >
        <ResetPasswordConfirmForm
          submitLabel={<Trans>Next</Trans>}
          onSubmit={async (data, signal) => {
            await onResetPasswordConfirm(data, signal)
            if (!signal.aborted) setView(View.PasswordUpdated)
          }}
          cancelLabel={<Trans>Back</Trans>}
          onCancel={onBack}
        />
      </LayoutTitle>
    )
  }

  if (view === View.PasswordUpdated) {
    return (
      <LayoutTitle
        title={msg`Password Updated`}
        subtitle={<Trans>Your password has been updated!</Trans>}
      >
        <center>
          <h2 className="pb-2 text-xl font-bold">
            <Trans>Password updated!</Trans>
          </h2>
          <p className="pb-4">
            <Trans>You can now sign in with your new password.</Trans>
          </p>
          <Button color="primary" onClick={onBack}>
            <Trans>Okay</Trans>
          </Button>
        </center>
      </LayoutTitle>
    )
  }

  throw new Error(`Invalid view: ${view}`)
}
