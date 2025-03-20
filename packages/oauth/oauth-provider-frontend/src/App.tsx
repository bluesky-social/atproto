import React from 'react'
// import { Trans } from '@lingui/react/macro'

// import {Palette} from '#/components/util/Palette'
import { AccountSelector } from '#/components/AccountSelector'

export function App() {
  return (
    <main className="bg-contrast-0 min-h-screen">
      <nav className="fixed top-0 right-0 p-4 md:p-6">
        <AccountSelector />
      </nav>
    </main>
  )
}
