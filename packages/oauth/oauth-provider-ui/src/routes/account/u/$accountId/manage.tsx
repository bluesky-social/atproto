import { Trans } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
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
import type { ComponentProps, ReactNode } from 'react'
import { DeactivateAccountDialog } from '#/components/deactivate-account-dialog.tsx'
import { DeleteAccountDialog } from '#/components/delete-account-dialog.tsx'
import { Notice } from '#/components/feedback/notice.tsx'
import { ReactivateAccountDialog } from '#/components/reactivate-account-dialog.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item.tsx'
import { UpdateEmailDialog } from '#/components/update-email-dialog.tsx'
import { UpdateHandleDialog } from '#/components/update-handle-dialog.tsx'
import { UpdatePasswordDialog } from '#/components/update-password-dialog.tsx'
import {
  accountRowClassName,
  accountRowDiscClassName,
  accountRowMediaClassName,
} from '#/components/utils/account-card.tsx'
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

export const Route = createFileRoute('/account/u/$accountId/manage')({
  component: ManagePage,
})

function ManagePage() {
  return (
    <div className="flex flex-col gap-4">
      <EmailVerificationRow />

      {/* @NOTE ItemGroup gives the rows role="list" and a consistent gap, and
        ItemSeparator marks the section breaks. Both were previously faked with
        a flex wrapper and invisible <hr className="border-none"> spacers, which
        left the gaps looking arbitrary. */}
      <ItemGroup>
        <EmailUpdateRow />
        <HandleUpdateRow />
        <PasswordUpdateRow />
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
    <Item
      variant="outline"
      className={cn(accountRowClassName, 'hover:bg-muted/30')}
    >
      <ItemMedia className={cn(accountRowDiscClassName, 'text-warning')}>
        <ShieldAlertIcon aria-hidden className="size-6" />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full text-base leading-snug">
          <span className="block min-w-0 font-medium">
            <Trans>Your email address needs to be verified.</Trans>
          </span>
        </ItemTitle>
      </ItemContent>
      <ItemActions>
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
          <Button variant="secondary" className="h-9">
            <Trans context="verify email">Verify now</Trans>
          </Button>
        </VerifyEmailDialog>
      </ItemActions>
    </Item>
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
  Omit<ComponentProps<typeof Item>, 'render'>,
  {
    icon: LucideIcon
    value?: ReactNode
    /** Destructive rows keep the danger signal without a full red fill. */
    variant?: 'default' | 'destructive'
  }
>

/**
 * A settings row, built on the shadcn `item` primitive — the canonical pattern
 * for this kind of list.
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
      variant="outline"
      render={<button type="button" />}
      className={cn(
        accountRowClassName,
        destructive && 'text-destructive hover:bg-destructive/10',
        className,
      )}
    >
      <ItemMedia
        className={cn(
          accountRowMediaClassName,
          accountRowDiscClassName,
          destructive && 'text-destructive',
        )}
      >
        <Icon aria-hidden className="size-6" />
      </ItemMedia>

      {/* @NOTE `min-w-0` is load-bearing: an email address has no break
        opportunity, so without it the row overflows and `Item`'s wrap drops the
        chevron onto a line of its own. */}
      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle className="w-full text-lg leading-tight">
          <span className="block min-w-0 truncate font-semibold">
            {children}
          </span>
        </ItemTitle>
        {value != null && (
          <ItemDescription className="text-base leading-tight">
            <span
              // A plain string value is the only one we can put in a tooltip
              // ourselves; `Handle` carries its own `title`.
              title={typeof value === 'string' ? value : undefined}
              className="block truncate"
            >
              {value}
            </span>
          </ItemDescription>
        )}
      </ItemContent>

      <ItemActions>
        <ChevronRightIcon
          aria-hidden
          className="text-muted-foreground size-5 shrink-0"
        />
      </ItemActions>
    </Item>
  )
}
