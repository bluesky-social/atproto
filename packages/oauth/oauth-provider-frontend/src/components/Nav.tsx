import React from 'react'

import { AccountSelector } from '#/components/AccountSelector'
import { useCurrentAccount } from '#/data/useCurrentAccount'
import { useCustomizationData } from '#/data/useCustomizationData'

export function Nav() {
  const { currentAccount } = useCurrentAccount()
  const { logo } = useCustomizationData()

  return (
    <>
      <nav className="fixed inset-x-0 top-0 bg-contrast-0 dark:bg-contrast-25 border-b border-contrast-100 px-4 md:px-6 flex items-center justify-between h-15">
        {logo ? (
          <div
            style={{ width: 120 }}
            dangerouslySetInnerHTML={{ __html: logo }}
          />
        ) : (
          <div />
        )}

        {currentAccount && <AccountSelector />}
      </nav>
      <div className="h-15" />
    </>
  )
}
