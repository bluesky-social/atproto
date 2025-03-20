import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { GlobeAltIcon } from '@heroicons/react/24/outline'

// import {Palette} from '#/components/util/Palette'
import { Button } from '#/components/Button'
import { Dropdown } from '#/components/Dropdown'
import { localesDisplay } from '#/locales/localesDisplay'
import { Session } from '#/api'
import { useLocale } from '#/locales'

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

export const Route = createFileRoute('/sessions')({
  component: Sessions,
})

export function Sessions() {
  const { locale, setLocale } = useLocale()
  return (
    <main className="bg-contrast-25 min-h-screen">
      <div className="px-4 md:px-6 pt-16">
        <div
          className="mx-auto w-full pt space-y-12"
          style={{ maxWidth: 600, minHeight: '100vh' }}
        >
          <nav className="flex items-center justify-between space-x-4">
            <div>
              <h1 className="text-sm font-bold">
                <Trans>Account home</Trans>
              </h1>
              <div className="flex items-center space-x-1">
                <GlobeAltIcon width={16} />
                <p className="text-text-light text-sm italic">bsky.social</p>
              </div>
            </div>
          </nav>

          <div className="space-y-3">
            <h2 className="text-text-default font-bold text-2xl">Sessions</h2>

            {sessions.map((session) => (
              <div className="p-4 border border-contrast-100 rounded-lg flex items-start justify-between space-x-4">
                <div className="flex items-center space-x-2 truncate">
                  <img
                    src={session.account.picture}
                    className="w-12 h-12 rounded-full"
                  />
                  <div className="truncate">
                    <h3 className="font-bold truncate">
                      {session.account.name}
                    </h3>
                    <p className="text-text-light text-sm truncate">
                      {session.account.preferred_username}
                      {' • '}
                      {session.account.email}
                    </p>
                  </div>
                </div>
                <Button>
                  <Trans>Revoke</Trans>
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6">
          <div className="mx-auto w-full space-y-4" style={{ maxWidth: 600 }}>
            <div className="flex justify-between items-center">
              <div
                className="p-4 bg-contrast-50 rounded-lg"
                style={{ width: 120 }}
              />
              <Dropdown
                items={Object.entries(localesDisplay).map(([code, l]) => ({
                  label: `${l.flag} ${l.name}`,
                  value: code,
                }))}
                value={locale}
                onSelect={setLocale}
              />
            </div>

            <div className="flex justify-between items-center">
              <a href="#" className="text-sm">
                Privacy Policy
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
