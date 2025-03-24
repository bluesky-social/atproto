import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'

import { Button } from '#/components/Button'
import { useSession } from '#/state/session'
import { useSessionsQuery } from '#/data/useSessionsQuery'

export const Route = createFileRoute('/_authenticated/sessions')({
  component: Sessions,
})

export function Sessions() {
  const { session, setSession } = useSession()
  const {
    data: sessions,
    error,
    isLoading,
  } = useSessionsQuery({
    did: session!.account.sub,
  })
  return (
    <>
      <ul className="flex items-center space-x-2">
        <li className="text-text-light">Account</li>
        <li>/</li>
        <li>Sessions</li>
      </ul>

      <h1 className="text-text-default font-bold text-3xl pt-8 pb-4">
        Sessions
      </h1>

      {isLoading ? null : error || !sessions ? null : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div className="p-4 border border-contrast-100 rounded-lg flex items-start justify-between space-x-4">
              <div className="flex items-center space-x-2 truncate">
                <img src={session.avatar} className="w-12 h-12 rounded-full" />
                <div className="truncate">
                  <h3 className="font-bold truncate">{session.displayName}</h3>
                  <p className="text-text-light text-sm truncate">
                    {session.username}
                    {' • '}
                    {session.email}
                    {' • '}
                    {session.identifier}
                  </p>
                </div>
              </div>
              <div>
                <Button onClick={() => setSession(null)}>
                  <Trans>Revoke</Trans>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 border-t border-contrast-100 pt-4 flex justify-end items-center space-x-4">
        <p className="text-text-light italic text-sm">
          <Trans>Log out of all applications</Trans>
        </p>
        <div>
          <Button onClick={() => setSession(null)}>
            <Trans>Revoke all</Trans>
          </Button>
        </div>
      </div>
    </>
  )
}
