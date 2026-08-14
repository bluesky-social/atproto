import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { AuthShell } from '#/components/layouts/auth-shell.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import { ResetPasswordConfirmForm } from './reset-password-confirm-form.tsx'
import { ResetPasswordRequestForm } from './reset-password-request-form.tsx'

export type ResetPasswordViewProps = {
  emailDefault?: string
  /**
   * Sub-step to start on. Allows restoring the "confirm" step (the reset
   * code was already emailed) after a page refresh.
   */
  initialView?: 'request' | 'confirm'
  /**
   * Reports sub-step changes so the parent can reflect them (e.g. in the
   * URL). The transient "password updated" screen is reported as
   * 'request'.
   */
  onViewChange?: (view: 'request' | 'confirm') => void
  onResetPasswordRequest: (data: { email: string }) => void | PromiseLike<void>
  onResetPasswordConfirm: (data: {
    token: string
    password: string
  }) => void | PromiseLike<void>
  onBack?: () => void
}

enum View {
  RequestReset,
  ConfirmReset,
  PasswordUpdated,
}

export function ResetPasswordView({
  emailDefault,
  initialView,
  onViewChange,
  onResetPasswordRequest,
  onResetPasswordConfirm,
  onBack,
}: ResetPasswordViewProps) {
  const { t } = useLingui()
  const [view, setViewState] = useState<View>(
    initialView === 'confirm' ? View.ConfirmReset : View.RequestReset,
  )
  const [email, setEmail] = useState(emailDefault)

  const setView = (next: View) => {
    setViewState(next)
    onViewChange?.(next === View.ConfirmReset ? 'confirm' : 'request')
  }

  if (view === View.RequestReset) {
    return (
      <AuthShell
        title={t`Forgot Password`}
        subtitle={<Trans>Let's get your password reset!</Trans>}
      >
        <p className="mb-4">
          <Trans>
            Enter the email you used to create your account. We'll send you a
            "reset code" so you can set a new password.
          </Trans>
        </p>

        <ResetPasswordRequestForm
          emailDefault={emailDefault}
          submitLabel={<Trans>Next</Trans>}
          handler={async (data) => {
            await onResetPasswordRequest(data)
            setEmail(data.email)
            setView(View.ConfirmReset)
          }}
          onBack={onBack}
        />

        <Separator className="my-5" />

        <div className="text-center">
          <Button variant="ghost" onClick={() => setView(View.ConfirmReset)}>
            <Trans>Already have a code?</Trans>
          </Button>
        </div>
      </AuthShell>
    )
  }

  if (view === View.ConfirmReset) {
    return (
      <AuthShell
        title={msg`Reset Password`}
        subtitle={
          <Trans>Enter the code you received to reset your password.</Trans>
        }
      >
        <p className="mb-4">
          <Trans>
            You will receive an email with a "reset code". Enter that code here
            then enter your new password.
          </Trans>
        </p>

        <ResetPasswordConfirmForm
          email={email}
          submitLabel={<Trans>Next</Trans>}
          handler={async (data) => {
            await onResetPasswordConfirm(data)
            setView(View.PasswordUpdated)
          }}
          onBack={() => setView(View.RequestReset)}
        />
      </AuthShell>
    )
  }

  if (view === View.PasswordUpdated) {
    return (
      <AuthShell
        title={msg`Password Updated`}
        subtitle={<Trans>You can now sign in with your new password.</Trans>}
      >
        <div className="text-center">
          {onBack && (
            <Button onClick={() => onBack()}>
              <Trans>Okay</Trans>
            </Button>
          )}
        </div>
      </AuthShell>
    )
  }

  throw new Error(`Invalid view: ${view}`)
}
