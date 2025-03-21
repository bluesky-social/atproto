import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'

import { Button } from '#/components/Button'
import { Session } from '#/api'
import { useSession } from '#/state/session'

const sessions: Session[] = [
  {
    account: {
      sub: '',
      aud: '',
      email: 'eric@blueskyweb.xyz',
      email_verified: true,
      name: 'Eric',
      preferred_username: '@esb.lol',
      picture:
        'https://cdn.bsky.app/img/avatar/plain/did:plc:3jpt2mvvsumj2r7eqk4gzzjz/bafkreiaexnb3bkzbaxktm5q3l3txyweflh3smcruigesvroqjrqxec4zv4@jpeg',
    },
    selected: false, // what
    loginRequired: false, // what
    consentRequired: false, // what
  },
]

export const Route = createFileRoute('/_authenticated/sessions')({
  component: Sessions,
})

export function Sessions() {
  const { setSession } = useSession()
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

      {sessions.map((session) => (
        <div className="p-4 border border-contrast-100 rounded-lg flex items-start justify-between space-x-4">
          <div className="flex items-center space-x-2 truncate">
            <img
              src={session.account.picture}
              className="w-12 h-12 rounded-full"
            />
            <div className="truncate">
              <h3 className="font-bold truncate">{session.account.name}</h3>
              <p className="text-text-light text-sm truncate">
                {session.account.preferred_username}
                {' • '}
                {session.account.email}
              </p>
            </div>
          </div>
          <Button onClick={() => setSession(null)}>
            <Trans>Revoke</Trans>
          </Button>
        </div>
      ))}

      <div className="mt-8 border-t border-contrast-100 pt-4 flex justify-end items-center space-x-4">
        <p className="text-text-light italic text-sm">
          <Trans>Log out of all applications</Trans>
        </p>
        <Button onClick={() => setSession(null)}>
          <Trans>Revoke all</Trans>
        </Button>
      </div>
    </>
  )
}
