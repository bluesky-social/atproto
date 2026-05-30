import { Trans } from '@lingui/react/macro'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { FormField } from '#/components/forms/form-field'
import { InputEmailAddress } from '#/components/forms/input-email-address.tsx'
import { InputToken } from '#/components/forms/input-token.tsx'
import { DialogSimple } from './dialog-simple'
import { AsyncForm } from './forms/async-form'
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
  const [email, setEmail] = useState<string | undefined>(undefined)
  const [confirmToken, setConfirmToken] = useState<string | null>(null)
  const [verifyToken, setVerifyToken] = useState<string | null>(null)

  useEffect(() => {
    setStep(Step.Init)
    setEmail(undefined)
  }, [open])

  useEffect(() => {
    setConfirmToken(null)
    setVerifyToken(null)
  }, [step])

  const sendRequest = async (data: { email: string; token?: string }) => {
    const { tokenRequired } = await onRequest()
    if (tokenRequired) setStep(Step.Token)
    else {
      await onConfirm(data)

      if (onVerify) setStep(Step.Verify)
      else setOpen(false)
    }
  }

  const initData = useMemo(() => {
    if (email) return { email, token: undefined }
  }, [email])

  const confirmData = useMemo(() => {
    if (email && confirmToken) return { email, token: confirmToken }
  }, [email, confirmToken])

  const verifyData = useMemo(() => {
    if (email && verifyToken) return { email, token: verifyToken }
  }, [email, verifyToken])

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
            <strong>{email}</strong>.
          </Trans>
        }
      >
        <AsyncForm
          onCancel={() => setOpen(false)}
          cancelLabel={<Trans context="verify email">Later</Trans>}
          submitLabel={<Trans context="verify email">Verify now</Trans>}
          submitData={verifyData}
          submitHandler={async (data) => {
            await onVerify(data)
            setOpen(false)
          }}
        >
          <FormField label={<Trans>Verification code</Trans>}>
            <InputToken
              name="code"
              required
              autoFocus
              defaultValue={verifyToken ?? undefined}
              onToken={setVerifyToken}
            />
          </FormField>
        </AsyncForm>
      </DialogSimple>
    )
  }

  if (step === Step.Token && initData) {
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
        <AsyncForm
          loading={requestPending}
          submitData={confirmData}
          submitHandler={async (data) => {
            await onConfirm(data)

            if (onVerify) setStep(Step.Verify)
            else setOpen(false)
          }}
        >
          <FormField label={<Trans>New email address</Trans>}>
            <InputEmailAddress
              name="email"
              required
              autoFocus
              defaultValue={email}
              onEmail={setEmail}
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
              defaultValue={confirmToken ?? undefined}
              onToken={setConfirmToken}
            />
          </FormField>

          <p className="text-sm italic">
            <Trans>Don't see an email?</Trans>
            <ButtonRequestCode
              disabled={confirmPending}
              loading={requestPending}
              action={() => sendRequest(initData)}
              transparent
              size="sm"
              shape="padded"
              startWithCooldown
            >
              <Trans>Click here to resend.</Trans>
            </ButtonRequestCode>
          </p>
        </AsyncForm>
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
      <AsyncForm
        disabled={requestPending}
        submitData={initData}
        submitHandler={async (data) => sendRequest(data)}
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
            defaultValue={email}
            onEmail={setEmail}
          />
        </FormField>
      </AsyncForm>
    </DialogSimple>
  )
}
