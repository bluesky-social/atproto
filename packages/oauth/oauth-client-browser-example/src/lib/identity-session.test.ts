import { describe, expect, it } from 'vitest'
import type { AtprotoDid } from '@atproto/did'
import {
  IDENTITY_SESSION_KEY,
  IDENTITY_SESSION_LIFETIME_MS,
  type IdentitySession,
  clearIdentitySession,
  isAuthnOnlyScope,
  readIdentitySession,
  writeIdentitySession,
} from './identity-session.ts'

const DID = 'did:plc:abcdefghijklmnopqrstuvwx' as AtprotoDid
const VERIFIED_AT = 1_700_000_000_000

const session: IdentitySession = {
  did: DID,
  handle: 'alice.test',
  authTime: 1_699_999_000,
  verifiedAt: VERIFIED_AT,
}

function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  }
}

describe('identity session', () => {
  it('round-trips a session', () => {
    const storage = fakeStorage()
    writeIdentitySession(session, storage)
    expect(readIdentitySession(storage, VERIFIED_AT + 1)).toEqual(session)
  })

  it('round-trips a session without handle and authTime', () => {
    const storage = fakeStorage()
    const minimal = { did: DID, verifiedAt: VERIFIED_AT }
    writeIdentitySession(minimal, storage)
    expect(readIdentitySession(storage, VERIFIED_AT)).toEqual(minimal)
  })

  it('expires 2 weeks after verifiedAt', () => {
    const storage = fakeStorage()
    writeIdentitySession(session, storage)
    const edge = VERIFIED_AT + IDENTITY_SESSION_LIFETIME_MS
    expect(readIdentitySession(storage, edge)).toEqual(session)
    expect(readIdentitySession(storage, edge + 1)).toBeNull()
  })

  it('clear removes it', () => {
    const storage = fakeStorage()
    writeIdentitySession(session, storage)
    clearIdentitySession(storage)
    expect(readIdentitySession(storage, VERIFIED_AT)).toBeNull()
  })

  it.each([
    ['corrupt JSON', '{nope'],
    ['wrong shape', JSON.stringify({ did: DID })],
    ['non-atproto did', JSON.stringify({ ...session, did: 'did:example:1' })],
    ['non-string handle', JSON.stringify({ ...session, handle: 5 })],
  ])('returns null for %s', (_name, raw) => {
    const storage = fakeStorage()
    storage.setItem(IDENTITY_SESSION_KEY, raw)
    expect(readIdentitySession(storage, VERIFIED_AT)).toBeNull()
  })

  it('returns null and does not throw when storage throws', () => {
    const boom = () => {
      throw new Error('storage unavailable')
    }
    const storage = {
      ...fakeStorage(),
      getItem: boom,
      setItem: boom,
      removeItem: boom,
    } as Storage
    expect(() => writeIdentitySession(session, storage)).not.toThrow()
    expect(() => clearIdentitySession(storage)).not.toThrow()
    expect(readIdentitySession(storage, VERIFIED_AT)).toBeNull()
  })
})

describe('isAuthnOnlyScope', () => {
  it.each([['atproto'], [' atproto ']])('is true for %j', (scope) => {
    expect(isAuthnOnlyScope(scope)).toBe(true)
  })

  it.each([['atproto account:email'], [''], ['transition:generic']])(
    'is false for %j',
    (scope) => {
      expect(isAuthnOnlyScope(scope)).toBe(false)
    },
  )
})
