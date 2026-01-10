import type {
  DidDocument,
  InternalStateData,
  OAuthAuthorizationServerMetadata,
  OAuthProtectedResourceMetadata,
  ResolvedHandle,
  Session,
} from '@atproto/oauth-client'
import { ExpoKey } from './expo-key'
import { MMKVSimpleStoreTTL } from './mmkv-simple-store-ttl'

const MMKV_ID = 'expo-atproto-oauth-client'

export class AuthorizationServerMetadataCache extends MMKVSimpleStoreTTL<OAuthAuthorizationServerMetadata> {
  constructor() {
    super({
      id: `${MMKV_ID}.authorizationServerMetadata`,
      expiresAt: oneMinuteFromNow,
      decode: JSON.parse,
      encode: JSON.stringify,
    })
  }
}

export class ProtectedResourceMetadataCache extends MMKVSimpleStoreTTL<OAuthProtectedResourceMetadata> {
  constructor() {
    super({
      id: `${MMKV_ID}.protectedResourceMetadata`,
      expiresAt: oneMinuteFromNow,
      decode: JSON.parse,
      encode: JSON.stringify,
    })
  }
}

export class DpopNonceCache extends MMKVSimpleStoreTTL<string> {
  constructor() {
    super({
      id: `${MMKV_ID}.dpopNonce`,
      expiresAt: tenMinutesFromNow,
      decode: identity,
      encode: identity,
    })
  }
}

export class DidCache extends MMKVSimpleStoreTTL<DidDocument> {
  constructor() {
    super({
      id: `${MMKV_ID}.did`,
      expiresAt: oneMinuteFromNow,
      decode: JSON.parse,
      encode: JSON.stringify,
    })
  }
}

export class HandleCache extends MMKVSimpleStoreTTL<ResolvedHandle> {
  constructor() {
    super({
      id: `${MMKV_ID}.handle`,
      expiresAt: oneMinuteFromNow,
      decode: JSON.parse,
      encode: JSON.stringify,
    })
  }
}

export class StateStore extends MMKVSimpleStoreTTL<InternalStateData> {
  constructor() {
    super({
      id: `${MMKV_ID}.state`,
      expiresAt: tenMinutesFromNow,
      decode: (value) => {
        const parsed = JSON.parse(value)
        return { ...parsed, dpopKey: new ExpoKey(parsed.dpopKey) }
      },
      encode: (value) => {
        return JSON.stringify({ ...value, dpopKey: value.dpopKey.jwk })
      },
    })
  }
}

export class SessionStore extends MMKVSimpleStoreTTL<Session> {
  constructor() {
    super({
      id: `${MMKV_ID}.session`,
      expiresAt: ({ tokenSet }) => {
        if (tokenSet.refresh_token) return null
        if (tokenSet.expires_at) return new Date(tokenSet.expires_at).valueOf()
        return null
      },
      decode: (value) => {
        const parsed = JSON.parse(value)
        return { ...parsed, dpopKey: new ExpoKey(parsed.dpopKey) }
      },
      encode: (value) => {
        return JSON.stringify({ ...value, dpopKey: value.dpopKey.jwk })
      },
    })
  }
}

function identity<T>(x: T): T {
  return x
}

function tenMinutesFromNow() {
  return Date.now() + 10 * 60e3
}

function oneMinuteFromNow() {
  return Date.now() + 60e3
}
