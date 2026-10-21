import { describe, expect, it } from 'vitest'
import { randomBytes } from '@atproto/crypto'
import { parseCid } from '@atproto/lex-data'
import {
  type Commit,
  SpaceMacError,
  computeCommitMac,
  computeRecordMac,
  formatMacHeader,
  formatWantMacHeader,
  parseMacHeader,
  parseWantMacHeader,
  verifyCommitMac,
  verifyRecordMac,
} from '../src/index.js'

// cids of `{ text: 'hello' }` and `{ text: 'world' }`
const CID_A = parseCid(
  'bafyreidefdycgbfy3oglcb6ism3eqhyp5llsrpzxjsuac2gsy4mtrtx244',
)
const CID_B = parseCid(
  'bafyreidpw4cbv6gr4ukh33z23pvvrpr3wi4gnpmi4doamlsl3sa4rgri2a',
)

const SPACE = 'at://did:example:space/space/app.bsky.group/test'
const URI = `at://did:example:alice/space/app.bsky.group/test/app.bsky.feed.post/1`

const commit: Commit = {
  ver: 1,
  space: SPACE,
  repo: 'did:example:alice',
  rev: '3kbcq3p7ad400',
  data: new Uint8Array(32).fill(1),
}

describe('commit MAC', () => {
  const sharedSecret = randomBytes(32)

  it('verifies under the same shared secret', () => {
    const mac = computeCommitMac(sharedSecret, commit)
    expect(mac).toHaveLength(32)
    expect(verifyCommitMac(sharedSecret, commit, mac)).toBe(true)
    expect(verifyCommitMac(randomBytes(32), commit, mac)).toBe(false)
  })

  it('is unambiguous across field boundaries', () => {
    // Without length prefixes these two would MAC identically.
    const a: Commit = { ...commit, repo: 'did:example:alice', rev: '3kbc' }
    const b: Commit = { ...commit, repo: 'did:example:alice3', rev: 'kbc' }
    expect(computeCommitMac(sharedSecret, a)).not.toEqual(
      computeCommitMac(sharedSecret, b),
    )
  })

  it('covers the data digest', () => {
    const mac = computeCommitMac(sharedSecret, commit)
    const tampered = { ...commit, data: new Uint8Array(32).fill(2) }
    expect(verifyCommitMac(sharedSecret, tampered, mac)).toBe(false)
  })
})

describe('record MAC', () => {
  const sharedSecret = randomBytes(32)

  it('verifies under the same shared secret', () => {
    const mac = computeRecordMac(sharedSecret, URI, CID_A)
    expect(verifyRecordMac(sharedSecret, URI, CID_A, mac)).toBe(true)
    expect(verifyRecordMac(randomBytes(32), URI, CID_A, mac)).toBe(false)
  })

  it('covers the uri and the cid', () => {
    const mac = computeRecordMac(sharedSecret, URI, CID_A)
    expect(verifyRecordMac(sharedSecret, `${URI}2`, CID_A, mac)).toBe(false)
    expect(verifyRecordMac(sharedSecret, URI, CID_B, mac)).toBe(false)
  })

  it('is domain-separated from a commit MAC', () => {
    // The same shared secret never MACs two kinds of message identically.
    expect(computeRecordMac(sharedSecret, URI, CID_A)).not.toEqual(
      computeCommitMac(sharedSecret, commit),
    )
  })
})

describe('MAC headers', () => {
  it('formats the request header', () => {
    expect(
      formatWantMacHeader('atproto-space-repo', 'did:key:zDnaExample'),
    ).toBe('type="atproto-space-repo", ver=1, key_share="did:key:zDnaExample"')
  })

  it('formats the response header', () => {
    const mac = Uint8Array.from({ length: 32 }, (_, i) => i)
    expect(formatMacHeader('atproto-space-repo', mac)).toBe(
      'type="atproto-space-repo", ver=1, mac=:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=:',
    )
  })

  it('round-trips both headers', () => {
    const want = formatWantMacHeader('atproto-space-record', 'did:key:zDnaX')
    expect(parseWantMacHeader(want, 'atproto-space-record')).toBe(
      'did:key:zDnaX',
    )
    const mac = randomBytes(32)
    const header = formatMacHeader('atproto-space-record', mac)
    expect(parseMacHeader(header, 'atproto-space-record')).toEqual(mac)
  })

  it('rejects a missing or malformed header', () => {
    expect(() => parseWantMacHeader(undefined, 'atproto-space-repo')).toThrow(
      SpaceMacError,
    )
    expect(() => parseWantMacHeader('???', 'atproto-space-repo')).toThrow(
      SpaceMacError,
    )
    expect(() =>
      parseWantMacHeader(
        'type="atproto-space-repo", ver=1',
        'atproto-space-repo',
      ),
    ).toThrow(/key_share/)
    expect(() =>
      parseMacHeader(
        'type="atproto-space-repo", ver=1, mac="abc"',
        'atproto-space-repo',
      ),
    ).toThrow(/mac/)
  })

  it('rejects an unexpected type or version', () => {
    const want = formatWantMacHeader('atproto-space-repo', 'did:key:zDnaX')
    expect(() => parseWantMacHeader(want, 'atproto-space-record')).toThrow(
      /unsupported MAC type/,
    )
    expect(() =>
      parseWantMacHeader(
        'type="atproto-space-repo", ver=2, key_share="did:key:zDnaX"',
        'atproto-space-repo',
      ),
    ).toThrow(/unsupported MAC version/)
  })
})
