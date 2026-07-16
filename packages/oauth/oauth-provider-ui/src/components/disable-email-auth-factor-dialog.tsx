import { Trans } from '@lingui/react/macro'
import { type ReactNode, useEffect, useState } from 'react'
import { DisableEmailAuthFactorConfirmForm } from '#/components/disable-email-auth-factor-confirm-form.tsx'
import { Button } from '#/components/forms/button.tsx'
import { Admonition } from '#/components/utils/admonition.tsx'
import { DialogSimple } from '#/components/utils/dialog-simple.tsx'

export type DisableEmailAuthFactorDialogProps = {
  email: string
  requestPending?: boolean
  confirmPending?: boolean
  onRequest: () => void | PromiseLike<{ tokenRequired: boolean } | void>
  onConfirm: (data: { token: string }) => void | PromiseLike<void>
  children: Exclude<ReactNode, false | null | undefined>
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

  return (
    <DialogSimple
      trigger={children}
      title={<Trans>Disable email 2FA</Trans>}
      description={
        step === Step.Confirm ? (
          <Trans>
            To disable your email 2FA method, please verify your access to{' '}
            <strong>{email}</strong>
          </Trans>
        ) : (
          <Trans>
            Enter the security code we sent to <strong>{email}</strong> to
            disable two-factor authentication.
          </Trans>
        )
      }
      open={open}
      onOpenChange={setOpen}
      dismissable={dismissable}
    >
      {step === Step.Confirm ? (
        <div className="align-stretch flex flex-col gap-4">
          <Admonition role="warning" className="text-sm">
            <Trans>
              Disabling two-factor authentication makes your account less
              secure.
            </Trans>
          </Admonition>

          <Button
            color="primary"
            loading={requestPending}
            className="w-full"
            onClick={async () => {
              const result = await onRequest()
              // Only advance to code entry when an OTP was actually dispatched.
              // If the factor was already disabled (e.g. a stale second tab),
              // there is nothing to confirm, close the dialog.
              if (result && result.tokenRequired === true) {
                setStep(Step.EnterCode)
              } else {
                setOpen(false)
              }
            }}
          >
            <Trans>Send email to verify</Trans>
          </Button>

          <Button onClick={() => setStep(Step.EnterCode)} className="w-full">
            <Trans>Already have a code?</Trans>
          </Button>
        </div>
      ) : (
        <DisableEmailAuthFactorConfirmForm
          disabled={confirmPending}
          submitColor="error"
          submitLabel={<Trans>Disable 2FA</Trans>}
          onLoadingChange={setConfirmSubmitting}
          onResend={async () => {
            const result = await onRequest()
            if (!result || !result.tokenRequired) {
              setOpen(false)
            }
          }}
          handler={async (data) => {
            await onConfirm(data)
            setOpen(false)
          }}
        />
      )}
    </DialogSimple>
  )
}
