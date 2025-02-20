import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { Button } from '../../../components/forms/button.tsx'
import {
  LayoutTitlePage,
  LayoutTitlePageProps,
} from '../../../components/layouts/layout-title-page.tsx'
import { Override } from '../../../lib/util.ts'
import { ResetPasswordConfirmForm } from './reset-password-confirm-form.tsx'
import { ResetPasswordRequestForm } from './reset-password-request-form.tsx'

export type ResetPasswordViewProps = Override<
  LayoutTitlePageProps,
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
  title = <Trans>Forgot Password</Trans>,
  subtitle,
  ...props
}: ResetPasswordViewProps) {
  const [view, setView] = useState<View>(View.RequestReset)

  if (view === View.RequestReset) {
    return (
      <LayoutTitlePage
        {...props}
        title={title}
        subtitle={subtitle || <Trans>Let's get your password reset!</Trans>}
      >
        <ResetPasswordRequestForm
          emailDefault={emailDefault}
          submitLabel={<Trans>Next</Trans>}
          onSubmit={async (data, signal) => {
            await onresetPasswordRequest(data, signal)
            if (!signal.aborted) setView(View.ConfirmReset)
          }}
          cancelLabel={<Trans>Back</Trans>}
          onCancel={onBack}
        />
        <hr className="mb-2" />
        <center>
          <Button transparent onClick={() => setView(View.ConfirmReset)}>
            <Trans>Already have a code?</Trans>
          </Button>
        </center>
      </LayoutTitlePage>
    )
  }

  if (view === View.ConfirmReset) {
    return (
      <LayoutTitlePage
        {...props}
        title={title}
        subtitle={
          subtitle || (
            <Trans>Enter the code you received to reset your password.</Trans>
          )
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
      </LayoutTitlePage>
    )
  }

  if (view === View.PasswordUpdated) {
    return (
      <LayoutTitlePage
        {...props}
        title={title}
        subtitle={subtitle || <Trans>Your password has been updated!</Trans>}
      >
        <center>
          <h2 className="text-xl font-bold">
            <Trans>Password updated!</Trans>
          </h2>
          <p className="space-y-4">
            <Trans>You can now sign in with your new password.</Trans>
          </p>
          <Button color="brand" onClick={onBack}>
            <Trans>Okay</Trans>
          </Button>
        </center>
      </LayoutTitlePage>
    )
  }

  throw new Error(`Invalid view: ${view}`)
}
