import { Trans } from '@lingui/react/macro'
import { ReactNode, useEffect, useState } from 'react'
import { FormCardAsync } from '#/components/forms/form-card-async.tsx'
import { FormField } from '#/components/forms/form-field'
import { InputEmailAddress } from '#/components/forms/input-email-address.tsx'
import { InputToken } from '#/components/forms/input-token.tsx'
import { DialogSimple } from './dialog-simple'
import { ButtonRequestCode } from './forms/button-request-code'
import { Admonition } from './utils/admonition'

export type UpdateEmailDialogProps = {
  email: string
  requestPending?: boolean
  confirmPending?: boolean
  onRequest: () => Promise<{ tokenRequired: boolean }>
  onConfirm: (data: { email: string; token?: string }) => Promise<void>
  onVerify?: (data: { email: string; token: string }) => Promise<void>
  children: Exclude<ReactNode, false | null | undefined>
}

enum Step {
  Init,
  Token,
  Verify,
}

export function UpdateEmailDialog({
  email: emailCurrent,
  requestPending,
  confirmPending,
  onRequest,
  onConfirm,
  onVerify,
  children,
}: UpdateEmailDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(Step.Init)
  const [emailNext, setEmailNext] = useState<string | undefined>(undefined)
  const [confirmToken, setConfirmToken] = useState<string | null>(null)
  const [verifyToken, setVerifyToken] = useState<string | null>(null)

  useEffect(() => {
    setStep(Step.Init)
    setEmailNext(undefined)
  }, [open])

  useEffect(() => {
    setConfirmToken(null)
    setVerifyToken(null)
  }, [step])

  const sendRequest = async () => {
    // Fool proofing and type safety
    if (!emailNext) return setStep(Step.Init)

    const { tokenRequired } = await onRequest()
    if (tokenRequired) setStep(Step.Token)
    else {
      await onConfirm({ email: emailNext, token: undefined })

      if (onVerify) setStep(Step.Verify)
      else setOpen(false)
    }
  }

  const sendConfirm = async () => {
    // Fool proofing and type safety
    if (!emailNext || !confirmToken) return setStep(Step.Init)

    await onConfirm({ email: emailNext, token: confirmToken })

    if (onVerify) setStep(Step.Verify)
    else setOpen(false)
  }

  const sendVerify = async () => {
    // Fool proofing and type safety
    if (!emailNext || !verifyToken) return setStep(Step.Init)

    await onVerify?.({ email: emailNext, token: verifyToken })

    setOpen(false)
  }

  if (step === Step.Verify && onVerify) {
    return (
      <DialogSimple
        trigger={children}
        open={open}
        onOpenChange={setOpen}
        title={<Trans>Email address successfully updated</Trans>}
        description={
          <Trans>
            Your email address has been successfully updated and needs to be
            verified. Please enter the verification code that was sent to{' '}
            <strong>{emailNext}</strong>.
          </Trans>
        }
      >
        <FormCardAsync
          onCancel={() => setOpen(false)}
          cancelLabel={<Trans context="verify email">Later</Trans>}
          onSubmit={sendVerify}
          submitLabel={<Trans context="verify email">Verify now</Trans>}
          invalid={!emailNext || !verifyToken}
        >
          <FormField label={<Trans>Verification code</Trans>}>
            <InputToken
              name="code"
              required
              autoFocus
              onToken={setVerifyToken}
            />
          </FormField>
        </FormCardAsync>
      </DialogSimple>
    )
  }

  if (step === Step.Token) {
    return (
      <DialogSimple
        trigger={children}
        open={open}
        onOpenChange={setOpen}
        title={<Trans>Update your email</Trans>}
        description={
          <Trans>
            Choose a new email address to associate with your account.
          </Trans>
        }
      >
        <FormCardAsync
          disabled={requestPending}
          invalid={!emailNext || !confirmToken}
          onSubmit={sendConfirm}
        >
          <FormField label={<Trans>New email address</Trans>}>
            <InputEmailAddress
              name="email"
              required
              autoFocus
              value={emailNext}
              onEmail={setEmailNext}
            />
          </FormField>

          <hr className="border-contrast-25 dark:border-contrast-50" />

          <div>
            <h3 className="text-text-default text-base font-semibold">
              <Trans>Security step required</Trans>
            </h3>
            <p className="mt-1">
              <Trans>
                Please enter the security code that was sent to your current
                email address <strong>{emailCurrent}</strong>.
              </Trans>
            </p>
          </div>

          <FormField label={<Trans>Security code</Trans>}>
            <InputToken
              name="code"
              required
              autoFocus
              onToken={setConfirmToken}
            />
          </FormField>

          <p className="text-sm italic">
            <Trans>Don't see an email?</Trans>
            <ButtonRequestCode
              disabled={confirmPending}
              loading={requestPending}
              action={sendRequest}
              transparent
              size="sm"
              shape="padded"
              startWithCooldown
            >
              <Trans>Click here to resend.</Trans>
            </ButtonRequestCode>
          </p>
        </FormCardAsync>
      </DialogSimple>
    )
  }

  return (
    <DialogSimple
      trigger={children}
      open={open}
      onOpenChange={setOpen}
      title={<Trans>Update your email</Trans>}
      description={
        <Trans>
          Choose a new email address to associate with your account.
        </Trans>
      }
    >
      <FormCardAsync
        disabled={requestPending}
        invalid={!emailNext}
        onSubmit={sendRequest}
      >
        <Admonition role="warning" className="text-sm">
          <Trans>
            If you update your email address, email 2FA (if enabled) will be
            disabled.
          </Trans>
        </Admonition>

        <FormField label={<Trans>New email address</Trans>}>
          <InputEmailAddress
            name="email"
            required
            autoFocus
            value={emailNext}
            onEmail={setEmailNext}
          />
        </FormField>
      </FormCardAsync>
    </DialogSimple>
  )
}
