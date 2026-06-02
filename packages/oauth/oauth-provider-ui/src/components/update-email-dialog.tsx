import { Trans } from '@lingui/react/macro'
import { CheckIcon } from '@phosphor-icons/react'
import { ReactNode, useEffect, useState } from 'react'
import { FormField } from '#/components/forms/form-field'
import { InputEmailAddress } from '#/components/forms/input-email-address.tsx'
import { InputToken } from '#/components/forms/input-token.tsx'
import { DialogSimple } from './dialog-simple'
import { SmartForm } from './forms/smart-form'
import { UpdateEmailForm } from './update-email-form'

export type UpdateEmailDialogProps = {
  email: string
  requestPending?: boolean
  confirmPending?: boolean
  onRequest: () => Promise<{ tokenRequired: boolean }>
  onConfirm: (data: { email: string; token?: string }) => Promise<void>
  onVerify?: (data: { email: string; token: string }) => Promise<void>
  children: Exclude<ReactNode, false | null | undefined>
  introMessage?: ReactNode
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
  introMessage,
}: UpdateEmailDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(Step.Init)
  const [email, setEmail] = useState<string | undefined>(undefined)

  useEffect(() => {
    setStep(Step.Init)
    setEmail(undefined)
  }, [open])

  if (step === Step.Verify && email && onVerify) {
    return (
      <DialogSimple
        trigger={children}
        open={open}
        onOpenChange={setOpen}
        title={
          <>
            <CheckIcon className="text-success inline" weight="bold" />{' '}
            <Trans>Email address successfully updated</Trans>
          </>
        }
        description={
          <Trans>
            Your email address has been successfully updated and needs to be
            verified. Please enter the verification code that was sent to{' '}
            <strong>{email}</strong>.
          </Trans>
        }
      >
        <SmartForm
          onCancel={() => setOpen(false)}
          cancelLabel={<Trans context="verify email">Later</Trans>}
          submitLabel={<Trans context="verify email">Verify now</Trans>}
          validate={({ token }: { token?: string }) =>
            token ? { token, email } : undefined
          }
          handler={async (data) => {
            await onVerify(data)
            setOpen(false)
          }}
          fields={({ values, set }) => (
            <FormField label={<Trans>Verification code</Trans>}>
              <InputToken
                name="code"
                required
                autoFocus
                defaultValue={values.token ?? undefined}
                onToken={(value) => set('token', value ?? undefined)}
              />
            </FormField>
          )}
        />
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
        <UpdateEmailForm
          emailCurrent={emailCurrent}
          requestPending={requestPending}
          confirmPending={confirmPending}
          values={{ email }}
          onResend={async () => {
            await onRequest()
          }}
          handler={async (data) => {
            await onConfirm(data)

            setEmail(data.email)

            if (onVerify) setStep(Step.Verify)
            else setOpen(false)
          }}
        />
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
      <SmartForm
        disabled={requestPending}
        values={{ email }}
        validate={({ email }) => (email ? { email } : undefined)}
        handler={async (data: { email: string; token?: string }) => {
          const { tokenRequired } = await onRequest()

          setEmail(data.email)

          if (tokenRequired) setStep(Step.Token)
          else {
            await onConfirm(data)

            if (onVerify) setStep(Step.Verify)
            else setOpen(false)
          }
        }}
        fields={({ values, set }) => (
          <>
            {introMessage}

            <FormField label={<Trans>New email address</Trans>}>
              <InputEmailAddress
                name="email"
                required
                autoFocus
                defaultValue={values.email}
                onEmail={(email) => set('email', email)}
              />
            </FormField>
          </>
        )}
      />
    </DialogSimple>
  )
}
