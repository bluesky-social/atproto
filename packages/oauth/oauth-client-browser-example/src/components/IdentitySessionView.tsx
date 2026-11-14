import { ArrowSquareOutIcon, CopyIcon, UserIcon } from '@phosphor-icons/react'
import { PDS_OPERATOR_URL } from '../constants.ts'
import type { IdentitySession } from '../lib/identity-session.ts'
import { useIsDarkMode } from '../lib/use-is-dark-mode.ts'
import { ButtonDropdown } from './ButtonDropdown.tsx'
import { Layout } from './Layout.tsx'

// Same look as the OAuth-authorized Home page, minus the API-backed sections.
export function IdentitySessionView({
  session,
  signOut,
}: {
  session: IdentitySession
  signOut: () => void
}) {
  const isDarkMode = useIsDarkMode()
  const handle = session.handle ? `@${session.handle}` : undefined

  return (
    <Layout
      nav={
        <ButtonDropdown
          transparent
          aria-label="User menu"
          menu={[
            {
              label: (
                <b className="flex-1">
                  <UserIcon
                    weight="bold"
                    aria-hidden
                    className="mr-2 inline-block size-4 rounded-full"
                  />
                  {handle ?? session.did}
                </b>
              ),
              items: [
                {
                  label: (
                    <>
                      <span className="flex-1 truncate">{session.did}</span>
                      <CopyIcon weight="bold" className="size-4" />
                    </>
                  ),
                  onClick: () => {
                    navigator.clipboard.writeText(session.did)
                  },
                },
              ],
            },
            {
              items: [
                {
                  label: (
                    <>
                      <span className="flex-1 truncate">Account manager</span>
                      <ArrowSquareOutIcon weight="bold" className="size-4" />
                    </>
                  ),
                  onClick: () => {
                    window.open(`${PDS_OPERATOR_URL}/account`, '_blank')
                  },
                },
                { label: 'Sign out', onClick: signOut },
              ],
            },
          ]}
        >
          {handle ?? session.did}
        </ButtonDropdown>
      }
    >
      <div className="rounded-md bg-white p-4 text-slate-900 shadow-md dark:bg-slate-900 dark:text-slate-100">
        <h1 className="text-lg font-bold">Signed in with FedCM</h1>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Authenticated by a verified FedCM ID token. No OAuth session, so no
          API access.
        </p>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          <dt className="font-semibold">Handle</dt>
          <dd>{handle ?? 'unverified'}</dd>
          <dt className="font-semibold">DID</dt>
          <dd className="break-all">{session.did}</dd>
          {session.authTime != null && (
            <>
              <dt className="font-semibold">Authenticated</dt>
              <dd>{new Date(session.authTime * 1000).toLocaleString()}</dd>
            </>
          )}
          <dt className="font-semibold">Verified</dt>
          <dd>{new Date(session.verifiedAt).toLocaleString()}</dd>
        </dl>
        <h2 className="mt-4">Identity session</h2>
        <code className="block overflow-auto whitespace-pre-wrap">
          <pre
            className={`rounded-md border p-2 ${
              isDarkMode ? 'bg-slate-900' : 'bg-slate-100'
            }`}
          >
            {JSON.stringify(session, null, 2)}
          </pre>
        </code>
      </div>
    </Layout>
  )
}
