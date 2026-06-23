import { Trans } from '@lingui/react/macro'
import {
  AtIcon,
  CaretRightIcon,
  EnvelopeIcon,
  Icon,
  LockIcon,
  ShieldWarningIcon,
  SnowflakeIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { clsx } from 'clsx'
import { ReactNode } from 'react'
import { DeactivateAccountDialog } from '#/components/deactivate-account-dialog.tsx'
import { DeleteAccountDialog } from '#/components/delete-account-dialog.tsx'
import { Button, ButtonProps } from '#/components/forms/button.tsx'
import { ReactivateAccountDialog } from '#/components/reactivate-account-dialog.tsx'
import { UpdateEmailDialog } from '#/components/update-email-dialog.tsx'
import { UpdateHandleDialog } from '#/components/update-handle-dialog.tsx'
import { UpdatePasswordDialog } from '#/components/update-password-dialog.tsx'
import { Admonition } from '#/components/utils/admonition'
import { Handle } from '#/components/utils/handle.tsx'
import { VerifyEmailDialog } from '#/components/verify-email-dialog.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import { useCustomizationData } from '#/contexts/customization.tsx'
import {
  useDeactivateAccount,
  useDeleteAccountConfirm,
  useDeleteAccountRequest,
  useReactivateAccount,
} from '#/data/account.ts'
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
      <EmailVerificationRow />
      <EmailUpdateRow />
      <hr className="border-none" aria-hidden />
      <HandleUpdateRow />
      <PasswordUpdateRow />
      <hr className="border-none" aria-hidden />
      <AccountStatusRow />
      <AccountDeletionRow />
    </div>
  )
}

function EmailVerificationRow() {
  const { account } = useAuthenticatedSession()
  const { did, email, emailVerified } = account

  const verifyRequest = useVerifyEmailRequest()
  const verifyConfirm = useVerifyEmailConfirm()

  if (!email || emailVerified) return null

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
            await verifyRequest.mutateAsync({ did })
          }}
          onConfirm={async ({ token }) => {
            await verifyConfirm.mutateAsync({ did, token, email })
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

function EmailUpdateRow(props: Omit<RowProps, 'icon' | 'value'>) {
  const { account } = useAuthenticatedSession()
  const data = useCustomizationData()
  const { did, email } = account

  const updateRequest = useUpdateEmailRequest()
  const updateConfirm = useUpdateEmailConfirm()
  const verifyRequest = useVerifyEmailRequest()
  const verifyConfirm = useVerifyEmailConfirm()

  return (
    <UpdateEmailDialog
      email={email}
      requestPending={updateRequest.isPending}
      confirmPending={updateConfirm.isPending}
      onUpdateRequest={async () => {
        return updateRequest.mutateAsync({ did })
      }}
      onUpdateConfirm={async ({ email, token }) => {
        await updateConfirm.mutateAsync({ did, email, token })
      }}
      onVerifyRequest={async () => {
        await verifyRequest.mutateAsync({ did })
      }}
      onVerifyConfirm={async ({ email, token }) => {
        await verifyConfirm.mutateAsync({ did, email, token })
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

function PasswordUpdateRow(props: Omit<RowProps, 'icon' | 'value'>) {
  const { account } = useAuthenticatedSession()
  const { email } = account

  const resetPasswordRequest = useResetPasswordRequest()
  const resetPasswordConfirm = useResetPasswordConfirm()

  // The /reset-password-request endpoint requires an email, so if the user
  // doesn't have one, we can't let them update their password. These users
  // should not exist in normal conditions (may have been created manually by an
  // admin), and are expected to contact support to update their password.
  if (!email) return null

  return (
    <UpdatePasswordDialog
      email={email}
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

function AccountStatusRow(props: Omit<RowProps, 'icon' | 'value'>) {
  const { account } = useAuthenticatedSession()
  const deactivate = useDeactivateAccount()
  const reactivate = useReactivateAccount()

  if (account.deactivated) {
    return (
      <ReactivateAccountDialog
        onConfirm={async () => {
          await reactivate.mutateAsync({ did: account.did })
        }}
      >
        <Row {...props} icon={SnowflakeIcon} color="primary">
          <Trans>Reactivate account</Trans>
        </Row>
      </ReactivateAccountDialog>
    )
  }

  return (
    <DeactivateAccountDialog
      onConfirm={async () => {
        await deactivate.mutateAsync({ did: account.did })
      }}
    >
      <Row {...props} icon={SnowflakeIcon} color="error">
        <Trans>Deactivate account</Trans>
      </Row>
    </DeactivateAccountDialog>
  )
}

function AccountDeletionRow(props: Omit<RowProps, 'icon' | 'value'>) {
  const { account } = useAuthenticatedSession()
  const { did, email, handle } = account

  const deleteRequest = useDeleteAccountRequest()
  const deleteConfirm = useDeleteAccountConfirm()

  return (
    <DeleteAccountDialog
      handle={handle}
      email={email}
      requestPending={deleteRequest.isPending}
      confirmPending={deleteConfirm.isPending}
      onRequest={async () => {
        await deleteRequest.mutateAsync({ did })
      }}
      onConfirm={async ({ token, password }) => {
        await deleteConfirm.mutateAsync({ did, token, password })
      }}
    >
      <Row {...props} icon={TrashIcon} color="error">
        <Trans>Delete account</Trans>
      </Row>
    </DeleteAccountDialog>
  )
}

function HandleUpdateRow(props: Omit<RowProps, 'icon' | 'value'>) {
  const { account } = useAuthenticatedSession()
  const { availableUserDomains = [] } = useCustomizationData()
  const { did, handle } = account

  const updateHandle = useUpdateHandle()

  return (
    <UpdateHandleDialog
      did={did}
      currentHandle={handle}
      domains={availableUserDomains}
      handler={async ({ handle }) => {
        await updateHandle.mutateAsync({ did, handle })
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
  className,
  transparent = true,
  ...props
}: RowProps) {
  return (
    <Button
      shape="padded"
      {...props}
      transparent={transparent}
      className={clsx('gap-2', className)}
    >
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
