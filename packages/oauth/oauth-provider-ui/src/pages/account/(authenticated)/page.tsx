import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import type { JSX } from 'react/jsx-runtime'
import { CustomizationName } from '#/components/customization-name.tsx'
import { AccountSummary } from '#/components/identity/account-summary.tsx'
import { useAccountShellLinks } from '#/components/layouts/account-shell.tsx'
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

export function Page(): ReactNode {
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
 * `description` its route already declares (see `DEFAULT_PAGES`), which the
 * sidebar does not show.
 */
function SectionList(): ReactNode {
  const { _ } = useLingui()
  const { pathname } = useRouterState().location
  const links = useAccountShellLinks()

  // Drop hidden entries and the current page — on the landing page that is the
  // "Home" entry, which would otherwise link to itself.
  const entries = links.filter(({ hidden, to }) => !hidden && to !== pathname)

  if (!entries.length) return null

  return (
    <ItemGroup className="gap-0">
      {entries.map(({ to, title, description, icon: Icon }, index) => (
        <Fragment key={to}>
          {index > 0 && <ItemSeparator />}
          <Item render={<Link to={to} />} className="hover:bg-muted rounded-lg">
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
  return (
    <p {...props}>
      <Trans>
        Your Atmosphere account is hosted by <CustomizationName />.
      </Trans>{' '}
      {/* @NOTE Styled as an inline link the way `ItemDescription` and
        `AlertDescription` style theirs: it inherits the paragraph's muted
        colour and carries a persistent underline. Previously it was
        `text-foreground` with no underline until hover, which made it the
        darkest text in a muted paragraph — reading as emphasis rather than as
        a link, and outranking the host name beside it. */}
      <Link
        to="/account/about"
        className="hover:text-primary underline underline-offset-4"
      >
        <Trans>What does this mean?</Trans>
      </Link>
    </p>
  )
}
