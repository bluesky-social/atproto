import { Trans } from '@lingui/react/macro'
import {
  AtIcon,
  CaretRightIcon,
  EnvelopeIcon,
  Icon,
  KeyIcon,
  ShieldCheckIcon,
} from '@phosphor-icons/react'
import { ReactNode } from 'react'
import { Button, ButtonProps } from '#/components/forms/button'
import { UpdateEmailDialog } from '#/components/update-email-dialog.tsx'
import { UpdateHandleDialog } from '#/components/update-handle-dialog.tsx'
import { UpdatePasswordDialog } from '#/components/update-password-dialog.tsx'
import { VerifyEmailDialog } from '#/components/verify-email-dialog.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import { useCustomizationData } from '#/contexts/customization.tsx'
import {
  useUpdateEmailConfirm,
  useUpdateEmailRequest,
  useVerifyEmailConfirm,
  useVerifyEmailRequest,
} from '#/data/email'
import { useUpdateHandle } from '#/data/handle.ts'
import {
  useResetPasswordConfirm,
  useResetPasswordRequest,
} from '#/data/password.ts'
import { Override } from '#/lib/util'

export function Page() {
  return (
    <div className="flex flex-col gap-2">
      <VerifyEmailRow bordered color="info" />
      <UpdateEmailRow />
      <UpdatePasswordRow />
      <UpdateHandleRow />
    </div>
  )
}

function VerifyEmailRow(props: ButtonProps) {
  const { account } = useAuthenticatedSession()
  const { sub, email, email_verified } = account

  const verifyRequest = useVerifyEmailRequest()
  const verifyConfirm = useVerifyEmailConfirm()

  if (!email || email_verified) return null

  return (
    <VerifyEmailDialog
      email={email}
      requestPending={verifyRequest.isPending}
      confirmPending={verifyConfirm.isPending}
      onRequest={async () => {
        await verifyRequest.mutateAsync({ sub })
      }}
      onConfirm={async ({ token }) => {
        await verifyConfirm.mutateAsync({ sub, token, email })
      }}
    >
      <Row icon={ShieldCheckIcon} {...props}>
        <Trans>Verify your email</Trans>
      </Row>
    </VerifyEmailDialog>
  )
}

function UpdateEmailRow(props: ButtonProps) {
  const { account } = useAuthenticatedSession()
  const { sub, email } = account

  const updateRequest = useUpdateEmailRequest()
  const updateConfirm = useUpdateEmailConfirm()

  if (!email) return null

  return (
    <UpdateEmailDialog
      email={email}
      requestPending={updateRequest.isPending}
      confirmPending={updateConfirm.isPending}
      onRequest={async () => {
        await updateRequest.mutateAsync({ sub })
      }}
      onConfirm={async ({ email, token }) => {
        await updateConfirm.mutateAsync({ sub, token, email })
      }}
    >
      <Row icon={EnvelopeIcon} value={email} {...props}>
        <Trans>Email</Trans>
      </Row>
    </UpdateEmailDialog>
  )
}

function UpdatePasswordRow(props: ButtonProps) {
  const { account } = useAuthenticatedSession()
  const { email } = account

  const resetPasswordRequest = useResetPasswordRequest()
  const resetPasswordConfirm = useResetPasswordConfirm()

  if (!email) return null

  return (
    <UpdatePasswordDialog
      requestPending={resetPasswordRequest.isPending}
      confirmPending={resetPasswordConfirm.isPending}
      onRequest={async () => {
        await resetPasswordRequest.mutateAsync({ email })
      }}
      onConfirm={async ({ token, password }) => {
        await resetPasswordConfirm.mutateAsync({ token, password })
      }}
    >
      <Row icon={KeyIcon} {...props}>
        <Trans>Password</Trans>
      </Row>
    </UpdatePasswordDialog>
  )
}

function UpdateHandleRow(props: ButtonProps) {
  const { account } = useAuthenticatedSession()
  const { availableUserDomains = [] } = useCustomizationData()
  const { sub, preferred_username: handle } = account

  const updateHandle = useUpdateHandle()

  return (
    <UpdateHandleDialog
      did={sub}
      currentHandle={handle}
      domains={availableUserDomains}
      onSubmit={async ({ handle }) => {
        await updateHandle.mutateAsync({ sub, handle })
      }}
    >
      <Row icon={AtIcon} value={handle ? `@${handle}` : undefined} {...props}>
        <Trans>Username</Trans>
      </Row>
    </UpdateHandleDialog>
  )
}

type RowProps = Override<
  ButtonProps,
  {
    icon: Icon
    value?: ReactNode
  }
>

function Row({
  icon: Icon,
  value,

  // ButtonProps
  children,
  ...props
}: RowProps) {
  return (
    <Button {...props}>
      <Icon aria-hidden className="size-5 shrink-0 grow-0" />
      <span className="grow-1 truncate pl-4 text-left font-medium">
        {children}
      </span>
      {value != null && (
        <span className="min-w-0 flex-1 truncate text-right">{value}</span>
      )}
      <CaretRightIcon aria-hidden className="size-4 shrink-0" />
    </Button>
  )
}
