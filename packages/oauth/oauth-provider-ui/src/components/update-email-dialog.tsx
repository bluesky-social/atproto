import { Trans } from '@lingui/react/macro'
import { CheckIcon } from 'lucide-react'
import { type ReactElement, type ReactNode, useEffect, useState } from 'react'
import { DialogShell } from '#/components/dialogs/dialog-shell.tsx'
import { EmailField } from '#/components/forms/fields/email-field.tsx'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import type { Override } from '#/lib/util.ts'
import { UpdateEmailForm } from './update-email-form.tsx'

export type UpdateEmailDialogProps = {
  email?: string
  requestPending?: boolean
  confirmPending?: boolean
  onUpdateRequest: () => Promise<{ tokenRequired: boolean }>
  onUpdateConfirm: (data: { email: string; token?: string }) => Promise<void>
  onVerifyRequest?: () => Promise<void>
  onVerifyConfirm?: (data: { email: string; token: string }) => Promise<void>
  children: ReactElement
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
  onUpdateRequest,
  onUpdateConfirm,
  onVerifyRequest,
  onVerifyConfirm,
  children,
  introMessage,
}: UpdateEmailDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(Step.Init)
  const [email, setEmail] = useState<string | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setStep(Step.Init)
    setEmail(undefined)
  }, [open])

  const dismissable = !submitting

  // @NOTE Naming the current address here is the only place it can be read in
  // full: the settings row that opens this dialog truncates it, and on a touch
  // screen there is no hover to reveal the rest.
  const chooseDescription = emailCurrent ? (
    <Trans>
      Your account currently uses{' '}
      <strong className="break-words">{emailCurrent}</strong>. Choose a new
      email address to associate with it.
    </Trans>
  ) : (
    <Trans>Choose a new email address to associate with your account.</Trans>
  )

  if (step === Step.Verify && email && onVerifyConfirm) {
    return (
      <DialogShell
        trigger={children}
        open={open}
        onOpenChange={setOpen}
        dismissable={dismissable}
        title={
          <>
            <CheckIcon className="text-success mr-2 inline size-4" />
            <Trans>Email address successfully updated</Trans>
          </>
        }
        description={
          <Trans>
            Your email address has been successfully updated and needs to be
            verified. Please enter the verification code that was sent to{' '}
            <strong className="break-words">{email}</strong>.
          </Trans>
        }
      >
        <VerifyStepForm
          email={email}
          onCancel={() => setOpen(false)}
          onLoadingChange={setSubmitting}
          onResend={onVerifyRequest}
          handler={async (data) => {
            await onVerifyConfirm(data)
            setOpen(false)
          }}
        />
      </DialogShell>
    )
  }

  if (step === Step.Token) {
    return (
      <DialogShell
        trigger={children}
        open={open}
        onOpenChange={setOpen}
        dismissable={dismissable}
        title={<Trans>Update your email</Trans>}
        description={chooseDescription}
      >
        <UpdateEmailForm
          emailCurrent={emailCurrent}
          loading={requestPending || confirmPending}
          newEmailDefault={email}
          onLoadingChange={setSubmitting}
          onCancel={() => setOpen(false)}
          onResend={async () => {
            await onUpdateRequest()
          }}
          handler={async (data) => {
            await onUpdateConfirm(data)

            setEmail(data.email)

            if (onVerifyConfirm) setStep(Step.Verify)
            else setOpen(false)
          }}
        />
      </DialogShell>
    )
  }

  return (
    <DialogShell
      trigger={children}
      open={open}
      onOpenChange={setOpen}
      dismissable={dismissable}
      title={<Trans>Update your email</Trans>}
      description={chooseDescription}
    >
      <EmailRequestForm
        emailDefault={email}
        disabled={requestPending}
        onLoadingChange={setSubmitting}
        onCancel={() => setOpen(false)}
        introMessage={introMessage}
        handler={async (data) => {
          const { tokenRequired } = await onUpdateRequest()

          setEmail(data.email)

          // If the previous email was not verified, we can skip asking for a
          // token to confirm ownership of that old email (since it was not
          // verified in the first place). In that case, we can directly go to
          // confirming the new email, and optionally verifying it if
          // `onVerifyConfirm` is provided.

          if (tokenRequired) setStep(Step.Token)
          else {
            await onUpdateConfirm(data)

            if (onVerifyConfirm) setStep(Step.Verify)
            else setOpen(false)
          }
        }}
      />
    </DialogShell>
  )
}

type EmailRequestFormProps = Override<
  FormShellProps<{ email: string }>,
  {
    emailDefault?: string
    introMessage?: ReactNode
    disabled?: boolean
    onCancel?: () => void
    onLoadingChange?: (loading: boolean) => void
  }
>

function EmailRequestForm({
  emailDefault,
  introMessage,
  ...props
}: EmailRequestFormProps) {
  return (
    <FormShell<{ email: string }> {...props}>
      {introMessage}

      <EmailField
        name="email"
        defaultValue={emailDefault ?? ''}
        label={<Trans>New email address</Trans>}
        required
        autoFocus
      />
    </FormShell>
  )
}

type VerifyStepFormData = { email: string; token: string }
type VerifyStepFormProps = Override<
  FormShellProps<VerifyStepFormData>,
  {
    children?: never
    email: string
    onResend?: () => Promise<void>
    onCancel?: () => void
    onLoadingChange?: (loading: boolean) => void
  }
>

function VerifyStepForm({
  email,
  onResend,
  onValues,
  handler,
  ...props
}: VerifyStepFormProps) {
  return (
    <FormShell<{ token: string }>
      {...props}
      cancelLabel={<Trans context="verify email">Later</Trans>}
      submitLabel={<Trans context="verify email">Verify now</Trans>}
      onValues={(values) => onValues?.({ ...values, email })}
      handler={(values, signal) => handler({ ...values, email }, signal)}
    >
      <TokenField
        name="token"
        label={<Trans>Verification code</Trans>}
        required
        autoFocus
        onResend={onResend}
      />
    </FormShell>
  )
}
