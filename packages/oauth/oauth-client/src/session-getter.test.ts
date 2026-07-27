import { assert, describe, expect, it, vi } from 'vitest'
import type { Key } from '@atproto/jwk'
import type { AtprotoDid } from './oauth-server-agent.ts'
import type { OAuthServerFactory } from './oauth-server-factory.js'
import type { Runtime } from './runtime.js'
import {
  type Session,
  SessionGetter,
  type SessionStore,
} from './session-getter.js'

const SUB = 'did:plc:example' satisfies AtprotoDid

function makeSession(): Session {
  return {
    dpopKey: {} as Key,
    authMethod: { method: 'none' },
    tokenSet: {
      iss: 'https://as.example.com',
      sub: SUB,
      aud: 'https://rs.example.com',
      scope: 'atproto',
      refresh_token: 'refresh-tok',
      access_token: 'access-tok',
      token_type: 'DPoP',
    },
  }
}

/** Minimal fakes — setStored only touches serverFactory.fromIssuer + the store. */
function makeGetter(opts: {
  store: SessionStore
  revoke?: (token: string) => Promise<void>
  onSessionUpdated?: (sub: AtprotoDid, session: Session) => void
  onSessionDeleted?: (sub: AtprotoDid, cause: unknown) => void
}) {
  const revoke = opts.revoke ?? (async () => {})
  const serverFactory = {
    fromIssuer: vi.fn(async () => ({ revoke })),
  } as unknown as OAuthServerFactory
  const runtime = {} as unknown as Runtime

  const getter = new SessionGetter(opts.store, serverFactory, runtime, {
    onSessionUpdated: opts.onSessionUpdated,
    onSessionDeleted: opts.onSessionDeleted,
  })
  return { getter, serverFactory, revoke }
}

describe(SessionGetter, () => {
  describe('setStored', () => {
    it('rejects a session whose tokenSet.sub does not match the key', async () => {
      const store: SessionStore = {
        get: async () => undefined,
        set: vi.fn(async () => {}),
        del: vi.fn(async () => {}),
      }
      const { getter } = makeGetter({ store })

      await expect(
        getter.setStored('did:plc:other', makeSession()),
      ).rejects.toThrow('Token set does not match the expected sub')
      expect(store.set).not.toHaveBeenCalled()
    })

    it('persists the session and fires onSessionUpdated on success', async () => {
      const store: SessionStore = {
        get: async () => undefined,
        set: vi.fn(async () => {}),
        del: vi.fn(async () => {}),
      }
      const onSessionUpdated = vi.fn()
      const { getter } = makeGetter({ store, onSessionUpdated })
      const session = makeSession()

      await getter.setStored(SUB, session)

      expect(store.set).toHaveBeenCalledWith(SUB, session)
      expect(onSessionUpdated).toHaveBeenCalledWith(SUB, session)
    })

    it('on persist failure: revokes, deletes, and throws an AggregateError bundling the store error', async () => {
      const setErr = new Error('store.set failed')
      const store: SessionStore = {
        get: async () => undefined,
        set: vi.fn(async () => {
          throw setErr
        }),
        del: vi.fn(async () => {}),
      }
      const revoke = vi.fn(async () => {})
      const onSessionUpdated = vi.fn()
      const onSessionDeleted = vi.fn()
      const { getter } = makeGetter({
        store,
        revoke,
        onSessionUpdated,
        onSessionDeleted,
      })
      const session = makeSession()

      await expect(getter.setStored(SUB, session)).rejects.toSatisfy((err) => {
        assert(err instanceof AggregateError)
        // The original store error is preserved in the aggregate.
        expect(err.errors).toContain(setErr)
        return true
      })

      // The refresh token is revoked (preferred over access token).
      expect(revoke).toHaveBeenCalledWith(session.tokenSet.refresh_token)
      // The session is deleted from the store, with the store error as cause.
      expect(store.del).toHaveBeenCalledWith(SUB)
      // onSessionDeleted fires (via delStored) with the original store error.
      expect(onSessionDeleted).toHaveBeenCalledWith(SUB, setErr)
      // onSessionUpdated must NOT fire on a failed persist.
      expect(onSessionUpdated).not.toHaveBeenCalled()
    })

    it('bundles the revoke failure and the delete failure alongside the store error', async () => {
      const setErr = new Error('store.set failed')
      const delErr = new Error('store.del failed')
      const revokeErr = new Error('revoke failed')
      const store: SessionStore = {
        get: async () => undefined,
        set: vi.fn(async () => {
          throw setErr
        }),
        del: vi.fn(async () => {
          throw delErr
        }),
      }
      const revoke = vi.fn(async () => {
        throw revokeErr
      })
      const { getter } = makeGetter({ store, revoke })

      await expect(getter.setStored(SUB, makeSession())).rejects.toSatisfy(
        (err) => {
          expect(err).toBeInstanceOf(AggregateError)
          const { errors } = err as AggregateError
          // All three failures are captured, original store error first.
          expect(errors[0]).toBe(setErr)
          expect(errors).toContain(revokeErr)
          expect(errors).toContain(delErr)
          return true
        },
      )
    })
  })
})
