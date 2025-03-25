import React from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import clsx from 'clsx'
import { ChevronRightIcon } from '@heroicons/react/24/outline'

import { Account } from '#/api'
import { useAccountsQuery } from '#/data/useAccountsQuery'
import { Loader } from '#/components/Loader'
import * as Admonition from '#/components/Admonition'
import { ContentCard } from '#/components/ContentCard'
import { Link, InlineLink } from '#/components/Link'
import { Avatar } from '#/components/Avatar'
import { getAccountName } from '#/util/getAccountName'
import { sanitizeHandle } from '#/util/sanitizeHandle'

export const Route = createFileRoute('/_unauthenticated/')({
  component: Index,
})

function Index() {
  const { _ } = useLingui()
  const { data: accounts, isLoading, error } = useAccountsQuery()

  return isLoading ? (
    <div className="flex items-center justify-center">
      <Loader size="lg" />
    </div>
  ) : error || !accounts ? (
    <Admonition.Default
      variant="error"
      title={_(msg`Something went wrong`)}
      text={_(
        msg`We weren't able to load your accounts. Please refresh the page to try again.`,
      )}
    />
  ) : (
    <>
      {accounts.length ? (
        <SelectorScreen accounts={accounts} />
      ) : (
        <Navigate to="/sign-in" />
      )}
    </>
  )
}

export function SelectorScreen({ accounts }: { accounts: Account[] }) {
  const { _ } = useLingui()

  return (
    <>
      <ContentCard>
        <div className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-text-default text-xl font-bold">
              <Trans>Accounts</Trans>
            </h1>
            <p className="text-text-light">
              <Trans>Select the account you would like to manage.</Trans>
            </p>
          </div>

          <div className="space-y-2">
            {accounts.map((a) => (
              <Link
                key={a.account.sub}
                to="/$did"
                params={{
                  did: a.account.sub,
                }}
                className={clsx([
                  'flex items-center space-x-3 px-3 py-3 rounded-lg',
                  'bg-contrast-25 dark:bg-contrast-50',
                  'hover:bg-contrast-50 dark:hover:bg-contrast-100',
                ])}
                label={_(msg`View and manage account for ${getAccountName(a)}`)}
              >
                <Avatar
                  size={40}
                  src={a.account.picture}
                  displayName={a.account.name}
                />
                <div className="space-y-0 flex-1">
                  <h2 className="text-text-default font-semibold leading-snug">
                    {a.account.name}
                  </h2>
                  <p className="text-sm text-text-light">
                    {sanitizeHandle(a.account.preferred_username) ||
                      a.account.sub}
                  </p>
                </div>
                <ChevronRightIcon width={20} className="text-text-light" />
              </Link>
            ))}

            <InlineLink
              to="/sign-in"
              className="text-sm text-center text-text-light inline-block w-full pt-2"
            >
              <Trans>Sign in with another account</Trans>
            </InlineLink>
          </div>
        </div>
      </ContentCard>
    </>
  )
}
