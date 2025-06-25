import { Jwk, Key } from '@atproto/jwk'
import { JoseKey } from '@atproto/jwk-jose'
import { InternalStateData, Session } from '@atproto/oauth-client'
import { SimpleStore } from '@atproto-labs/simple-store'

type ToDpopJwkValue<V extends { dpopKey: Key }> = Omit<V, 'dpopKey'> & {
  dpopJwk: Jwk
}

/**
 * Utility function that allows to simplify the store interface by exposing a
 * JWK (JSON) instead of a Key instance.
 */
export function toDpopKeyStore<
  K extends string,
  V extends { dpopKey: Key; dpopJwk?: never },
>(store: SimpleStore<K, ToDpopJwkValue<V>>): SimpleStore<K, V> {
  return {
    async set(sub: K, { dpopKey, ...data }: V) {
      const dpopJwk = dpopKey.privateJwk
      if (!dpopJwk) throw new Error('Private DPoP JWK is missing.')

      await store.set(sub, { ...data, dpopJwk })
    },

    async get(sub: K) {
      const result = await store.get(sub)
      if (!result) return undefined

      const { dpopJwk, ...data } = result
      const dpopKey = await JoseKey.fromJWK(dpopJwk)
      return { ...data, dpopKey } as unknown as V
    },

    del: store.del.bind(store),
    clear: store.clear?.bind(store),
  }
}

export type NodeSavedState = ToDpopJwkValue<InternalStateData>
export type NodeSavedStateStore = SimpleStore<string, NodeSavedState>

export type NodeSavedSession = ToDpopJwkValue<Session>
export type NodeSavedSessionStore = SimpleStore<string, NodeSavedSession>
