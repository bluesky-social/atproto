import { Trans, useLingui } from '@lingui/react/macro'
import { ReactNode, useEffect, useState } from 'react'
import { FormCardAsync } from '#/components/forms/form-card-async.tsx'
import { FormField } from '#/components/forms/form-field'
import { InputEmailAddress } from '#/components/forms/input-email-address.tsx'
import { InputToken } from '#/components/forms/input-token.tsx'
import { DialogSimple } from './dialog-simple'
import { ButtonRequestCode } from './forms/button-request-code'

export type UpdateEmailDialogProps = {
  email: string
  requestPending?: boolean
  confirmPending?: boolean
  onRequest: () => void | PromiseLike<void>
  onConfirm: (data: {
    token: string
    email: string
  }) => void | PromiseLike<void>
  children: Exclude<ReactNode, false | null | undefined>
}

enum Step {
  EmailEntry,
  Confirm,
}

export function UpdateEmailDialog({
  requestPending,
  confirmPending,
  onRequest,
  onConfirm,
  children,
}: UpdateEmailDialogProps) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(Step.EmailEntry)
  const [newEmail, setNewEmail] = useState<string | undefined>(undefined)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setStep(Step.EmailEntry)
      setNewEmail(undefined)
      setToken(null)
    }
  }, [open])

  return (
    <DialogSimple
      trigger={children}
      title={t`Update your email`}
      open={open}
      onOpenChange={setOpen}
    >
      <FormCardAsync
        disabled={requestPending}
        invalid={!newEmail}
        onSubmit={
          step === Step.EmailEntry
            ? async () => {
                if (!newEmail) return
                await onRequest()
                setStep(Step.Confirm)
              }
            : async () => {
                if (!token || !newEmail) return
                await onConfirm({ token, email: newEmail })
                setOpen(false)
              }
        }
      >
        <FormField label={t`New email address`}>
          <InputEmailAddress
            name="email"
            required
            autoFocus
            value={newEmail}
            onEmail={setNewEmail}
          />
        </FormField>

        {step === Step.Confirm && (
          <>
            <hr className="border-contrast-25 dark:border-contrast-50" />

            <div>
              <h3 className="text-text-default text-base font-semibold">
                <Trans context="Email">Security step required</Trans>
              </h3>
              <p className="mt-1">
                <Trans context="Email">
                  Please enter the security code we sent to your{' '}
                  <strong>previous</strong> email address.
                </Trans>
              </p>
            </div>

            <FormField label={t`Security code`}>
              <InputToken name="code" required autoFocus onToken={setToken} />
            </FormField>

            <p className="text-sm italic">
              <Trans context="Email">Don't see an email?</Trans>
              <ButtonRequestCode
                disabled={confirmPending}
                loading={requestPending}
                action={onRequest}
                transparent
                size="sm"
                shape="padded"
              >
                <Trans context="Email">Click here to resend.</Trans>
              </ButtonRequestCode>
            </p>
          </>
        )}
      </FormCardAsync>
    </DialogSimple>
  )
}
