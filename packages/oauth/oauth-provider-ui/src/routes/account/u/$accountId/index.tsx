import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
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
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '#/components/ui/item.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'

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
    <ItemGroup className="gap-0">
      {links.map(({ title, description, Icon, to, params }, index) => (
        <Fragment key={to}>
          {index > 0 && <ItemSeparator />}
          <Item
            render={<Link to={to} params={params} />}
            className="hover:bg-muted rounded-lg"
          >
            {Icon && (
              <ItemMedia variant="icon">
                <Icon aria-hidden />
              </ItemMedia>
            )}
            <ItemContent>
              <ItemTitle>
                <span>{typeof title === 'object' ? _(title) : title}</span>
              </ItemTitle>
              {description && (
                <ItemDescription>
                  {typeof description === 'object'
                    ? _(description)
                    : description}
                </ItemDescription>
              )}
            </ItemContent>
            <ItemActions>
              <ChevronRightIcon
                aria-hidden
                className="size-4 shrink-0 opacity-60"
              />
            </ItemActions>
          </Item>
        </Fragment>
      ))}
    </ItemGroup>
  )
}

function HostedByParagraph(props: JSX.IntrinsicElements['p']): ReactNode {
  const { account } = useAuthenticatedSession()
  return (
    <p {...props}>
      <Trans>
        Your Atmosphere account is hosted by <CustomizationName />.
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
