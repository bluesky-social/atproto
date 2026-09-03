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
 * Row utilities shared with the "Another account" row in `SignInPicker`, so
 * the two stay the same height, padding and surface.
 */
export const accountRowClassName =
  'bg-muted/30 hover:bg-accent hover:text-accent-foreground w-full gap-4 px-4 py-3 text-left'

/** Keeps a row's media vertically centred when the row has a description. */
export const accountRowMediaClassName =
  'group-has-data-[slot=item-description]/item:translate-y-0 group-has-data-[slot=item-description]/item:self-center'

/** A disc the size of the avatar, for rows led by an icon instead of a picture. */
export const accountRowDiscClassName =
  'bg-muted text-muted-foreground size-12 rounded-full border'

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
    <Item
      {...props}
      variant="outline"
      render={<button type="button" />}
      className={cn(accountRowClassName, className)}
    >
      {/* @NOTE `ItemMedia` nudges itself to the top when a description is
        present; the large avatar here reads better vertically centred. */}
      <ItemMedia className={accountRowMediaClassName}>
        <AccountAvatar account={account} size="xl" />
      </ItemMedia>

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
    </Item>
  )
}
