import { useState } from 'react'
import { Button } from '../../../components/forms/button'
import {
  LayoutTitlePage,
  LayoutTitlePageProps,
} from '../../../components/layouts/layout-title-page'
import { Override } from '../../../lib/util'
import { ResetPasswordConfirmForm } from './reset-password-confirm-form'
import { ResetPasswordRequestForm } from './reset-password-request-form'

export type ResetPasswordViewProps = Override<
  Omit<LayoutTitlePageProps, 'title' | 'subtitle'>,
  {
    emailDefault?: string
    onresetPasswordRequest: (
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
>

enum View {
  RequestReset,
  ConfirmReset,
  PasswordUpdated,
}

export function ResetPasswordView({
  emailDefault,
  onresetPasswordRequest,
  onResetPasswordConfirm,
  onBack,

  // LayoutTitlePage
  ...props
}: ResetPasswordViewProps) {
  const [view, setView] = useState<View>(View.RequestReset)

  if (view === View.RequestReset) {
    return (
      <LayoutTitlePage
        {...props}
        title="Forgot Password"
        subtitle="Let's get your password reset!"
      >
        <ResetPasswordRequestForm
          emailDefault={emailDefault}
          submitLabel="Next"
          onSubmit={async (data, signal) => {
            await onresetPasswordRequest(data, signal)
            if (!signal.aborted) setView(View.ConfirmReset)
          }}
          cancelLabel="Back"
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
        {...props}
        title="Forgot Password"
        subtitle="Let's get your password reset!"
      >
        <ResetPasswordConfirmForm
          submitLabel="Next"
          onSubmit={async (data, signal) => {
            await onResetPasswordConfirm(data, signal)
            if (!signal.aborted) setView(View.PasswordUpdated)
          }}
          cancelLabel="Back"
          onCancel={onBack}
        />
      </LayoutTitlePage>
    )
  }

  if (view === View.PasswordUpdated) {
    return (
      <LayoutTitlePage
        {...props}
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
