import { useState } from 'react'
import { Button } from '../components/button'
import { LayoutTitlePage } from '../components/layout-title-page'
import { ResetPasswordConfirmForm } from '../components/reset-password-confirm-form'
import ResetPasswordInitForm from '../components/reset-password-init-form'

export type ResetPasswordViewProps = {
  loginHint?: string

  onResetPasswordInit: (email: string) => void | PromiseLike<void>
  onResetPasswordConfirm: (
    code: string,
    password: string,
  ) => void | PromiseLike<void>
  onBack: () => void
}

enum View {
  RequestReset,
  ConfirmReset,
  PasswordUpdated,
}

export function ResetPasswordView({
  onResetPasswordInit,
  onResetPasswordConfirm,
  onBack,
}: ResetPasswordViewProps) {
  const [view, setView] = useState<View>(View.RequestReset)

  if (view === View.RequestReset) {
    return (
      <LayoutTitlePage
        title="Forgot Password"
        subtitle="Let's get your password reset!"
      >
        <ResetPasswordInitForm
          submitAria="Next"
          onSubmit={async (email) => {
            await onResetPasswordInit(email)
            setView(View.ConfirmReset)
          }}
          cancelAria="Back"
          onCancel={onBack}
        />
        <hr className="mb-2" />
        <center>
          <Button transparent onClick={() => setView(View.ConfirmReset)}>
            Already have a code?
          </Button>
        </center>
      </LayoutTitlePage>
    )
  }

  if (view === View.ConfirmReset) {
    return (
      <LayoutTitlePage
        title="Forgot Password"
        subtitle="Let's get your password reset!"
      >
        <ResetPasswordConfirmForm
          submitAria="Next"
          onSubmit={async (code, password) => {
            await onResetPasswordConfirm(code, password)
            setView(View.PasswordUpdated)
          }}
          cancelAria="Back"
          onCancel={onBack}
        />
      </LayoutTitlePage>
    )
  }

  if (view === View.PasswordUpdated) {
    return (
      <LayoutTitlePage
        title="Forgot Password"
        subtitle="Let's get your password reset!"
      >
        <center>
          <h2 className="text-xl font-bold">Password updated!</h2>
          <p className="space-y-4">
            You can now sign in with your new password.
          </p>
          <Button color="brand" onClick={onBack}>
            Okay
          </Button>
        </center>
      </LayoutTitlePage>
    )
  }

  throw new Error(`Invalid view: ${view}`)
}
