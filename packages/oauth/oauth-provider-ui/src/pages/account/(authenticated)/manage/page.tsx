import { Trans } from '@lingui/react/macro'
import {
  AtSignIcon,
  ChevronRightIcon,
  LockIcon,
  type LucideIcon,
  MailIcon,
  ShieldAlertIcon,
  SnowflakeIcon,
  TrashIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { DeactivateAccountDialog } from '#/components/deactivate-account-dialog.tsx'
import { DeleteAccountDialog } from '#/components/delete-account-dialog.tsx'
import { Notice } from '#/components/feedback/notice.tsx'
import { ReactivateAccountDialog } from '#/components/reactivate-account-dialog.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '#/components/ui/item.tsx'
import { UpdateEmailDialog } from '#/components/update-email-dialog.tsx'
import { UpdateHandleDialog } from '#/components/update-handle-dialog.tsx'
import { UpdatePasswordDialog } from '#/components/update-password-dialog.tsx'
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
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'

export function Page() {
  return (
    <div className="flex flex-col gap-4">
      <EmailVerificationRow />

      {/* @NOTE ItemGroup gives the rows role="list" and a consistent gap, and
        ItemSeparator marks the section breaks. Both were previously faked with
        a flex wrapper and invisible <hr className="border-none"> spacers, which
        left the gaps looking arbitrary. */}
      <ItemGroup>
        <EmailUpdateRow />
        <ItemSeparator />
        <HandleUpdateRow />
        <PasswordUpdateRow />
        <ItemSeparator />
        <AccountStatusRow />
        <AccountDeletionRow />
      </ItemGroup>
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
    <Notice
      role="info"
      icon={ShieldAlertIcon}
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
          <Button size="sm" variant="secondary">
            <Trans context="verify email">Verify now</Trans>
          </Button>
        </VerifyEmailDialog>
      }
    >
      <Trans>Your email address needs to be verified.</Trans>
    </Notice>
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
          <Notice role="warning" className="text-sm">
            <Trans>
              If you update your email address, email 2FA (if enabled) will be
              disabled.
            </Trans>
          </Notice>
        )
      }
    >
      <Row {...props} icon={MailIcon} value={email}>
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
        <Row {...props} icon={SnowflakeIcon} variant="default">
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
      <Row {...props} icon={SnowflakeIcon} variant="destructive">
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
      <Row {...props} icon={TrashIcon} variant="destructive">
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
      <Row {...props} icon={AtSignIcon} value={<Handle handle={handle} />}>
        <Trans>Username</Trans>
      </Row>
    </UpdateHandleDialog>
  )
}

type RowProps = Override<
  Omit<React.ComponentProps<typeof Item>, 'render'>,
  {
    icon: LucideIcon
    value?: ReactNode
    /** Destructive rows keep the danger signal without a full red fill. */
    variant?: 'default' | 'destructive'
  }
>

/**
 * A tappable settings row, built on the shadcn `item` primitive — the
 * canonical pattern for this kind of list.
 *
 * @NOTE `render={<button/>}` makes the row keyboard focusable, which `Item`'s
 * default `<div>` is not. `itemVariants` has no destructive variant
 * (default/outline/muted only), so destructive rows tint the icon and label
 * rather than filling the row.
 */
function Row({
  icon: Icon,
  value,
  variant = 'default',
  children,
  className,
  ...props
}: RowProps) {
  const destructive = variant === 'destructive'

  return (
    <Item
      {...props}
      render={<button type="button" />}
      className={cn(
        'hover:bg-muted w-full text-left',
        destructive && 'text-destructive hover:bg-destructive/10',
        className,
      )}
    >
      <ItemMedia variant="icon">
        <Icon aria-hidden className={cn(destructive && 'text-destructive')} />
      </ItemMedia>

      <ItemContent>
        <ItemTitle>
          <span>{children}</span>
        </ItemTitle>
      </ItemContent>

      <ItemActions>
        {value != null && (
          <span className="text-muted-foreground hidden max-w-[16rem] truncate text-sm sm:inline">
            {value}
          </span>
        )}
        <ChevronRightIcon aria-hidden className="size-4 shrink-0 opacity-60" />
      </ItemActions>
    </Item>
  )
}
