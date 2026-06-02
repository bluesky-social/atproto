import { Trans } from '@lingui/react/macro'
import {
  AtIcon,
  CaretRightIcon,
  EnvelopeIcon,
  Icon,
  LockIcon,
  ShieldWarningIcon,
} from '@phosphor-icons/react'
import { ReactNode } from 'react'
import { isValidHandle } from '@atproto/syntax'
import { Button, ButtonProps } from '#/components/forms/button'
import { UpdateEmailDialog } from '#/components/update-email-dialog.tsx'
import { UpdateHandleDialog } from '#/components/update-handle-dialog.tsx'
import { UpdatePasswordDialog } from '#/components/update-password-dialog.tsx'
import { Admonition } from '#/components/utils/admonition'
import { Handle } from '#/components/utils/handle.tsx'
import { VerifyEmailDialog } from '#/components/verify-email-dialog.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import { useCustomizationData } from '#/contexts/customization.tsx'
import {
  useUpdateEmailConfirm,
  useUpdateEmailRequest,
  useVerifyEmailConfirm,
  useVerifyEmailRequest,
} from '#/data/email.ts'
import { useUpdateHandle } from '#/data/handle.ts'
import {
  useResetPasswordConfirm,
  useResetPasswordRequest,
} from '#/data/password.ts'
import { Override } from '#/lib/util.ts'

export function Page() {
  return (
    <div className="flex flex-col gap-2">
      <VerifyEmailRow />
      <UpdateEmailRow />
      <UpdatePasswordRow />
      <hr className="border-none" aria-hidden />
      <UpdateHandleRow />
    </div>
  )
}

function VerifyEmailRow() {
  const { account } = useAuthenticatedSession()
  const { sub, email, email_verified } = account

  const verifyRequest = useVerifyEmailRequest()
  const verifyConfirm = useVerifyEmailConfirm()

  if (!email || email_verified) return null

  return (
    <Admonition
      role="info"
      icon={ShieldWarningIcon}
      action={
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
          <Button size="sm" color="info">
            <Trans context="verify email">Verify now</Trans>
          </Button>
        </VerifyEmailDialog>
      }
    >
      <Trans>Your email address needs to be verified.</Trans>
    </Admonition>
  )
}

function UpdateEmailRow(props: Omit<RowProps, 'icon' | 'value'>) {
  const { account } = useAuthenticatedSession()
  const data = useCustomizationData()
  const { sub, email } = account

  const updateRequest = useUpdateEmailRequest()
  const updateConfirm = useUpdateEmailConfirm()
  const verifyConfirm = useVerifyEmailConfirm()

  if (!email) return null

  return (
    <UpdateEmailDialog
      email={email}
      requestPending={updateRequest.isPending}
      confirmPending={updateConfirm.isPending}
      onRequest={async () => {
        return updateRequest.mutateAsync({ sub })
      }}
      onConfirm={async ({ email, token }) => {
        await updateConfirm.mutateAsync({ sub, email, token })
      }}
      onVerify={async ({ email, token }) => {
        await verifyConfirm.mutateAsync({ sub, email, token })
      }}
      introMessage={
        data.show2FaWarningOnEmailUpdate && (
          <Admonition role="warning" className="text-sm">
            <Trans>
              If you update your email address, email 2FA (if enabled) will be
              disabled.
            </Trans>
          </Admonition>
        )
      }
    >
      <Row {...props} icon={EnvelopeIcon} value={email}>
        <Trans>Email address</Trans>
      </Row>
    </UpdateEmailDialog>
  )
}

function UpdatePasswordRow(props: Omit<RowProps, 'icon' | 'value'>) {
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
      <Row {...props} icon={LockIcon}>
        <Trans>Password</Trans>
      </Row>
    </UpdatePasswordDialog>
  )
}

function UpdateHandleRow(props: Omit<RowProps, 'icon' | 'value'>) {
  const { account } = useAuthenticatedSession()
  const { availableUserDomains = [] } = useCustomizationData()
  const { sub, preferred_username } = account
  const handle =
    preferred_username && isValidHandle(preferred_username)
      ? preferred_username
      : undefined

  const updateHandle = useUpdateHandle()

  return (
    <UpdateHandleDialog
      did={sub}
      currentHandle={handle}
      domains={availableUserDomains}
      handler={async ({ handle }) => {
        await updateHandle.mutateAsync({ sub, handle })
      }}
    >
      <Row {...props} icon={AtIcon} value={<Handle handle={handle} />}>
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
  className = '',
  ...props
}: RowProps) {
  return (
    <Button shape="padded" {...props} className={`gap-2 ${className}`}>
      <Icon aria-hidden className="size-5 shrink-0 grow-0" />
      <span className="grow-1 truncate text-left font-medium">{children}</span>
      {value != null && (
        <span className="hidden min-w-0 flex-1 truncate text-right text-sm sm:inline">
          {value}
        </span>
      )}
      <CaretRightIcon aria-hidden className="size-4 shrink-0" />
    </Button>
  )
}
