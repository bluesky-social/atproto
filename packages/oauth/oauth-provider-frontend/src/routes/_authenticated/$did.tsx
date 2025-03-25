import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'

import { Button } from '#/components/Button'
import { useSessionsQuery, ApplicationSession } from '#/data/useSessionsQuery'
import { useRevokeSessionsMutation } from '#/data/useRevokeSessionsMutation'
import { InlineLink } from '#/components/Link'

export const Route = createFileRoute('/_authenticated/$did')({
  component: Sessions,
})

export function Sessions() {
  const { did } = Route.useParams()
  const {
    data: sessions,
    error,
    isLoading,
  } = useSessionsQuery({
    did,
  })
  const { mutateAsync: revokeSessions } = useRevokeSessionsMutation()
  const revokeAll = async () => {
    try {
      await revokeSessions({ tokens: sessions!.map((s) => s.token) })
    } catch (e) {}
  }
  return (
    <>
      <ul className="flex items-center space-x-2 text-text-light">
        <li><InlineLink to='/' className='text-text-light underline'>Accounts</InlineLink></li>
        <li className="text-text-default">/</li>
        <li>Home</li>
      </ul>

      <h1 className="text-text-default font-bold text-3xl pt-8 pb-4">
        Application sessions
      </h1>

      {isLoading ? null : error || !sessions ? null : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <SessionCard session={session} />
          ))}
        </div>
      )}

      <div className="mt-8 border-t border-contrast-100 pt-4 flex justify-end items-center space-x-4">
        <p className="text-text-light italic text-sm">
          <Trans>Log out of all applications</Trans>
        </p>
        <div>
          <Button onClick={revokeAll}>
            <Trans>Revoke all</Trans>
          </Button>
        </div>
      </div>
    </>
  )
}

function SessionCard({ session }: { session: ApplicationSession }) {
  const { mutateAsync: revokeSessions } = useRevokeSessionsMutation()

  const revoke = async () => {
    try {
      await revokeSessions({ tokens: [session.token] })
    } catch (e) {}
  }

  return (
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
          <p>
            {session.application.name} {session.application.url}
          </p>
        </div>
      </div>
      <div>
        <Button onClick={revoke}>
          <Trans>Revoke</Trans>
        </Button>
      </div>
    </div>
  )
}
