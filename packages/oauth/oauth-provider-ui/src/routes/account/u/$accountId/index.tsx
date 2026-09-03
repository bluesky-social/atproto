import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { JSX } from 'react/jsx-runtime'
import { CustomizationName } from '#/components/customization-name.tsx'
import { AccountSummary } from '#/components/identity/account-summary.tsx'
import {
  useAccountShellLinks,
  useIsCurrentTarget,
} from '#/components/layouts/account-shell.tsx'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item.tsx'
import {
  accountRowClassName,
  accountRowDiscClassName,
  accountRowMediaClassName,
} from '#/components/utils/account-card.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import { cn } from '#/lib/utils.ts'

export const Route = createFileRoute('/account/u/$accountId/')({
  component: AccountHomePage,
})

function AccountHomePage() {
  const { account } = useAuthenticatedSession()

  return (
    <div className="flex flex-col gap-8">
      <AccountSummary account={account}>
        <HostedByParagraph className="text-muted-foreground text-center text-sm" />
      </AccountSummary>

      <SectionList />
    </div>
  )
}

/**
 * The shell's navigation entries, listed as content — each with the translated
 * `description` the shell's sidebar does not show.
 */
function SectionList(): ReactNode {
  const { _ } = useLingui()
  const isCurrent = useIsCurrentTarget()

  // Drop the current page — on the landing page that is the "Home" entry, which
  // would otherwise link to itself.
  const links = useAccountShellLinks().filter((link) => !isCurrent(link))
  if (!links.length) return null

  return (
    <div className="flex flex-col gap-4">
      {links.map(({ title, description, Icon, to, params }) => (
        <Item
          key={to}
          variant="outline"
          render={<Link to={to} params={params} />}
          className={accountRowClassName}
        >
          {Icon && (
            <ItemMedia
              className={cn(accountRowMediaClassName, accountRowDiscClassName)}
            >
              <Icon aria-hidden className="size-6" />
            </ItemMedia>
          )}
          <ItemContent className="min-w-0 gap-0.5">
            <ItemTitle className="w-full text-lg leading-tight">
              <span className="block min-w-0 truncate font-semibold">
                {typeof title === 'object' ? _(title) : title}
              </span>
            </ItemTitle>
            {description && (
              <ItemDescription className="text-base leading-tight">
                {typeof description === 'object' ? _(description) : description}
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
      ))}
    </div>
  )
}

function HostedByParagraph(props: JSX.IntrinsicElements['p']): ReactNode {
  const { account } = useAuthenticatedSession()
  return (
    <p {...props} className={cn('whitespace-pre-line', props.className)}>
      {/* @NOTE The newline is part of the message so the line always breaks
        after "account"; translators place their own break. */}
      <Trans>
        Your Atmosphere account{'\n'}is hosted by <CustomizationName />.
      </Trans>{' '}
      <Link
        to="/account/u/$accountId/about"
        params={{ accountId: account.handle || account.did }}
        className="text-foreground underline underline-offset-4"
      >
        <Trans>What does this mean?</Trans>
      </Link>
    </p>
  )
}
