import React from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'

import { useSession } from '#/state/session'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const { session } = useSession()

  return session ? <Navigate to="/account" /> : <Navigate to="/sign-in" />
}
