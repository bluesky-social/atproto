import { ChevronRightIcon } from 'lucide-react'
import type { JSX, ReactNode } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import { AccountAvatar } from '#/components/identity/account-avatar.tsx'
import { AccountIdentifier } from '#/components/identity/account-identifier.tsx'
import { AccountName } from '#/components/identity/account-name.tsx'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'

export type AccountCardProps = Override<
  JSX.IntrinsicElements['button'],
  {
    account: Account
    append?: ReactNode
  }
>

/**
 * A selectable account row.
 *
 * @NOTE Rendered as a real `<button>` wrapping the name and identifier spans:
 * the pds e2e suite clicks the handle via `clickOnText('alice.test', 'span')`,
 * which requires the text to sit in a `<span>` inside something clickable.
 */
export function AccountCard({
  account,
  append = <ChevronRightIcon aria-hidden className="size-4 shrink-0" />,
  className,
  ...props
}: AccountCardProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'border-input bg-background flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left',
        'hover:bg-accent hover:text-accent-foreground transition-colors',
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
        className,
      )}
    >
      <AccountAvatar account={account} />

      <span className="min-w-0 flex-1">
        {account.name && (
          <AccountName
            account={account}
            className="block truncate font-medium"
          />
        )}
        <AccountIdentifier
          account={account}
          className="text-muted-foreground block truncate text-sm"
        />
      </span>

      {append}
    </button>
  )
}
