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
 * A selectable account row, built on `Item` — the shadcn primitive for a
 * choice list. It previously hand-rolled the border, padding, hover and
 * focus-ring utilities, which had already drifted from the near-identical
 * "Another account" row beside it.
 *
 * @NOTE Two markup details are load-bearing for the pds e2e suite, not
 * cosmetic:
 *
 * - `render={<button/>}` keeps this a real `<button>`. `Item` is a `<div>` by
 *   default, and the tests click these rows.
 * - the identifier stays inside a `<span>` (`AccountIdentifier` renders one),
 *   because the suite selects the handle with
 *   `clickOnText('alice.test', 'span')`. `ItemDescription` is a `<p>`, so the
 *   span must survive nested inside it.
 */
export function AccountCard({
  account,
  append = <ChevronRightIcon aria-hidden className="size-4 shrink-0" />,
  className,
  ...props
}: AccountCardProps) {
  return (
    <Item
      {...props}
      variant="outline"
      render={<button type="button" />}
      className={cn(
        'hover:bg-accent hover:text-accent-foreground w-full text-left',
        className,
      )}
    >
      <ItemMedia>
        <AccountAvatar account={account} />
      </ItemMedia>

      <ItemContent className="min-w-0">
        {account.name && (
          <ItemTitle>
            <AccountName account={account} className="truncate font-medium" />
          </ItemTitle>
        )}
        <ItemDescription>
          <AccountIdentifier account={account} className="block truncate" />
        </ItemDescription>
      </ItemContent>

      <ItemActions>{append}</ItemActions>
    </Item>
  )
}
