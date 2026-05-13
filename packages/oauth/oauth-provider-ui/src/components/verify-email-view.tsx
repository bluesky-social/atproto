import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { ButtonRequestReset } from '#/components/forms/button-request-reset'
import { Button } from '#/components/forms/button.tsx'
import { Admonition } from '#/components/utils/admonition.tsx'
import { VerifyEmailConfirmForm } from './verify-email-confirm-form.tsx'
import { VerifyEmailRequestForm } from './verify-email-request-form.tsx'

export type VerifyEmailViewProps = {
  email: string
  requestPending?: boolean
  confirmPending?: boolean
  onRequest: () => void | PromiseLike<void>
  onConfirm: (
    data: { token: string },
    signal: AbortSignal,
  ) => void | PromiseLike<void>
  onDone: () => void
  /**
   * When set, renders a "Cancel" action on the Request and Confirm steps.
   * Used by callers that embed this view as an optional step in a larger flow
   * (e.g. the update-email view, where verification is abortable).
   */
  onCancel?: () => void
  /**
   * Skip the initial "we'll send you a code" step — useful when a code has
   * already been sent by a prior action (e.g. right after an email change).
   */
  skipRequest?: boolean
}

enum Step {
  Request,
  Confirm,
  Done,
}

export function VerifyEmailView({
  email,
  requestPending,
  confirmPending,
  onRequest,
  onConfirm,
  onDone,
  onCancel,
  skipRequest = false,
}: VerifyEmailViewProps) {
  const [step, setStep] = useState<Step>(
    skipRequest ? Step.Confirm : Step.Request,
  )

  if (step === Step.Done) {
    return (
      <div className="space-y-4">
        <Admonition role="note" variant="success">
          <Trans context="EmailVerify">
            <strong>{email}</strong> has been verified.
          </Trans>
        </Admonition>

        <Button color="primary" onClick={onDone}>
          <Trans>Done</Trans>
        </Button>
      </div>
    )
  }

  if (step === Step.Confirm) {
    return (
      <div className="space-y-4">
        <VerifyEmailConfirmForm
          disabled={confirmPending}
          onCancel={onCancel}
          cancelLabel={<Trans>Cancel</Trans>}
          onSubmit={async (data, signal) => {
            await onConfirm(data, signal)
            if (!signal.aborted) setStep(Step.Done)
          }}
        />

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Trans context="EmailVerify">Didn't receive it?</Trans>
          <ButtonRequestReset action={onRequest} loading={requestPending} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <VerifyEmailRequestForm
        email={email}
        disabled={requestPending}
        onCancel={onCancel}
        cancelLabel={<Trans>Cancel</Trans>}
        onSubmit={async (signal) => {
          await onRequest()
          if (!signal.aborted) setStep(Step.Confirm)
        }}
      />

      <hr className="border-contrast-100 dark:border-contrast-200" />

      <Button onClick={() => setStep(Step.Confirm)}>
        <Trans context="EmailVerify">I already have a code</Trans>
      </Button>
    </div>
  )
}
