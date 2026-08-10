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

export default function Page() {
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

function SectionList(): ReactNode {
  const { _ } = useLingui()
  const { pathname } = useRouterState().location
  const links = useAccountShellLinks().filter(
    (toOptions) => toOptions.to !== pathname,
  )
  if (!links.length) return null

  return (
    <ItemGroup className="gap-0">
      {links.map(({ title, description, Icon, ...toOptions }, index) => (
        <Fragment key={toOptions.to}>
          {index > 0 && <ItemSeparator />}
          <Item
            render={<Link {...toOptions} />}
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
        to="/account/u/$accountId"
        params={{ accountId: account.handle || account.did }}
        className="text-foreground underline underline-offset-4"
      >
        <Trans>What does this mean?</Trans>
      </Link>
    </p>
  )
}
