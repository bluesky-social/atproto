import React from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'

import { useCurrentAccount } from '#/state/account'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const { currentAccount } = useCurrentAccount()
  return currentAccount ? (
    <Navigate to="/account" />
  ) : (
    <Navigate to="/sign-in" />
  )
}
