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
import { useCustomizationData } from '#/data/useCustomizationData'
import { Link } from '#/components/Link'
import { Avatar } from '#/components/Avatar'
import { getAccountName } from '#/util/getAccountName'
import { sanitizeHandle } from '#/util/sanitizeHandle'

export const Route = createFileRoute('/')({
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
  const { logo } = useCustomizationData()

  return (
    <>
      {logo ? (
        <div className="flex justify-center">
          <div
            className="pb-8"
            style={{ width: 120 }}
            dangerouslySetInnerHTML={{ __html: logo }}
          />
        </div>
      ) : null}

      <ContentCard>
        <div className="space-y-2">
          <h1 className="text-text-light text-md font-semibold leading-snug">
            <Trans>Select an account</Trans>
          </h1>

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
          </div>
        </div>
      </ContentCard>
    </>
  )
}
