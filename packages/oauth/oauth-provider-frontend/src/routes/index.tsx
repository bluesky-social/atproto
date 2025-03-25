import React from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useLingui } from '@lingui/react'
import { msg } from '@lingui/core/macro'

import { useAccountsQuery } from '#/data/useAccountsQuery'
import { Loader } from '#/components/Loader'
import * as Admonition from '#/components/Admonition'

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
    <>{accounts.length ? null : <Navigate to="/sign-in" />}</>
  )
}
