import { Trans } from '@lingui/react/macro'
import { type ReactElement, useEffect, useState } from 'react'
import { DialogShell } from '#/components/dialogs/dialog-shell.tsx'
import { DisableEmailAuthFactorConfirmForm } from '#/components/disable-email-auth-factor-confirm-form.tsx'
import { Notice } from '#/components/feedback/notice.tsx'
import { actionRow } from '#/components/forms/form-shell.tsx'
import { RequestCodeButton } from '#/components/forms/request-code-button.tsx'
import { Button } from '#/components/ui/button.tsx'

export type DisableEmailAuthFactorDialogProps = {
  email: string
  requestPending?: boolean
  confirmPending?: boolean
  onRequest: () => void | PromiseLike<{ tokenRequired: boolean } | void>
  onConfirm: (data: { token: string }) => void | PromiseLike<void>
  children: ReactElement
}

enum Step {
  Confirm,
  EnterCode,
}

export function DisableEmailAuthFactorDialog({
  email,
  requestPending,
  confirmPending,
  onRequest,
  onConfirm,
  children,
}: DisableEmailAuthFactorDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(Step.Confirm)
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)

  useEffect(() => {
    if (!open) setStep(Step.Confirm)
  }, [open])

  const dismissable = !requestPending && !confirmSubmitting

  // @NOTE Only advance to code entry when an OTP was actually dispatched. If
  // the factor was already disabled (e.g. a stale second tab), there is nothing
  // left to confirm, so close instead.
  const request = async () => {
    const result = await onRequest()
    if (result && result.tokenRequired === true) setStep(Step.EnterCode)
    else setOpen(false)
  }

  return (
    <DialogShell
      trigger={children}
      title={<Trans>Disable two-factor authentication</Trans>}
      description={
        step === Step.Confirm ? (
          <Trans>
            To disable your email two-factor authentication, please verify your
            access to <strong>{email}</strong>
          </Trans>
        ) : (
          <Trans>
            Enter the security code we sent to <strong>{email}</strong> to
            disable email two-factor authentication.
          </Trans>
        )
      }
      open={open}
      onOpenChange={setOpen}
      dismissable={dismissable}
    >
      {step === Step.Confirm ? (
        <div className="flex flex-col gap-4">
          <Notice role="warning" className="text-sm">
            <Trans>
              Disabling two-factor authentication makes your account less
              secure.
            </Trans>
          </Notice>

          {/* @NOTE Actions rather than destinations, so these are `Button`s and
            not an option list: sending the code is the main path, "Already have
            a code?" the escape hatch. `RequestCodeButton` defaults to
            `size="sm"` for the inline resend; as a primary dialog action it
            takes the default. */}
          <div className={actionRow}>
            <RequestCodeButton
              action={request}
              disabled={requestPending || confirmPending}
              variant="default"
              size="default"
              className="w-full sm:w-auto"
            >
              <Trans>Send email to verify</Trans>
            </RequestCodeButton>

            <Button
              variant="ghost"
              onClick={() => setStep(Step.EnterCode)}
              className="w-full sm:w-auto"
            >
              <Trans>Already have a code?</Trans>
            </Button>
          </div>
        </div>
      ) : (
        <DisableEmailAuthFactorConfirmForm
          disabled={confirmPending}
          submitVariant="destructive"
          submitLabel={<Trans>Disable 2FA</Trans>}
          onLoadingChange={setConfirmSubmitting}
          onResend={request}
          handler={async (data) => {
            await onConfirm(data)
            setOpen(false)
          }}
        />
      )}
    </DialogShell>
  )
}
