import type { IdentitySession } from '../lib/identity-session.ts'
import { Button } from './Button.tsx'
import { Layout } from './Layout.tsx'

export function IdentitySessionView({
  session,
  signOut,
}: {
  session: IdentitySession
  signOut: () => void
}) {
  return (
    <Layout>
      <h1 className="text-2xl font-bold">Signed in with FedCM</h1>
      <p>{session.handle ? `@${session.handle}` : session.did}</p>
      <p>DID: {session.did}</p>
      {session.authTime != null && (
        <p>
          Authenticated: {new Date(session.authTime * 1000).toLocaleString()}
        </p>
      )}
      <div>
        <Button type="button" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </Layout>
  )
}
