import { ChevronRightIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import { AccountAvatar } from '#/components/identity/account-avatar.tsx'
import { AccountIdentifier } from '#/components/identity/account-identifier.tsx'
import { AccountName } from '#/components/identity/account-name.tsx'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item.tsx'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'

export type AccountCardProps = Override<
  Omit<ComponentProps<typeof Item>, 'render' | 'variant'>,
  {
    account: Account
    append?: ReactNode
  }
>

/**
 * One row in a list of accounts or account destinations — the same height,
 * padding and surface wherever such a list appears. Pass `render` to make it a
 * button or a link, as `Item` does.
 */
export function AccountRow({
  className,
  ...props
}: ComponentProps<typeof Item>) {
  return (
    <Item
      variant="outline"
      {...props}
      className={cn(
        'bg-muted/30 hover:bg-accent hover:text-accent-foreground w-full gap-4 px-4 py-3 text-left',
        className,
      )}
    />
  )
}

export type AccountRowMediaProps = Override<
  ComponentProps<typeof ItemMedia>,
  {
    /**
     * Draws the disc that stands in for an avatar, sized to match one, for a
     * row led by an icon instead of a picture.
     */
    disc?: boolean
  }
>

/**
 * A row's leading slot.
 *
 * @NOTE `ItemMedia` nudges itself to the top when a description is present;
 * the large avatar (or disc) here reads better vertically centred.
 */
export function AccountRowMedia({
  disc,
  className,
  ...props
}: AccountRowMediaProps) {
  return (
    <ItemMedia
      {...props}
      className={cn(
        'group-has-data-[slot=item-description]/item:translate-y-0 group-has-data-[slot=item-description]/item:self-center',
        disc && 'bg-muted text-muted-foreground size-12 rounded-full border',
        className,
      )}
    />
  )
}

/**
 * A selectable account row, built on `Item` — the shadcn primitive for a
 * choice list.
 *
 * @NOTE `render={<button/>}` makes the whole row keyboard focusable, which
 * `Item`'s default `<div>` is not.
 */
export function AccountCard({
  account,
  append = (
    <ChevronRightIcon
      aria-hidden
      className="text-muted-foreground size-5 shrink-0"
    />
  ),
  className,
  ...props
}: AccountCardProps) {
  return (
    <AccountRow
      {...props}
      render={<button type="button" />}
      className={className}
    >
      <AccountRowMedia>
        <AccountAvatar account={account} size="xl" />
      </AccountRowMedia>

      <ItemContent className="min-w-0 gap-0.5">
        {account.name && (
          <ItemTitle className="w-full text-lg leading-tight">
            <AccountName
              account={account}
              className="block min-w-0 truncate font-semibold"
            />
          </ItemTitle>
        )}
        <ItemDescription className="text-base leading-tight">
          <AccountIdentifier account={account} className="block truncate" />
        </ItemDescription>
      </ItemContent>

      <ItemActions>{append}</ItemActions>
    </AccountRow>
  )
}
