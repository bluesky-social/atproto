import { createHmac } from 'node:crypto'
import { describe, expect, it, test } from 'vitest'
import { randomBytes } from '@atproto/crypto'
import { parseCid } from '@atproto/lex-data'
import type { AtUriString } from '@atproto/syntax'
import {
  COMMIT_MAC_PROFILE,
  RECORD_MAC_PROFILE,
  type SpaceCommit,
  SpaceMacError,
  createCommitMacHeaders,
  formatMacRequest,
  parseMacRequest,
  verifyCommitMac,
  verifyRecordMac,
} from '../src/index.js'
import { KEY_SHARE, commitMacParams, recordMacParams } from './_util.js'

// cids of `{ text: 'hello' }` and `{ text: 'world' }`
const CID_A = parseCid(
  'bafyreidefdycgbfy3oglcb6ism3eqhyp5llsrpzxjsuac2gsy4mtrtx244',
)
const CID_B = parseCid(
  'bafyreidpw4cbv6gr4ukh33z23pvvrpr3wi4gnpmi4doamlsl3sa4rgri2a',
)

const SPACE = 'at://did:example:space/space/app.bsky.group/test'
const URI: AtUriString = `${SPACE}/did:example:alice/app.bsky.feed.post/1`

const commit: SpaceCommit = {
  ver: 1,
  space: SPACE,
  repo: 'did:example:alice',
  rev: '3kbcq3p7ad400',
  data: new Uint8Array(32).fill(1),
}

describe('MAC requests', () => {
  it('formats the Accept-Signature header', () => {
    expect(formatMacRequest(COMMIT_MAC_PROFILE, KEY_SHARE)).toBe(
      'mac=("atproto-space-commit";sf);keyid="did:key:zDnaExample";tag="atproto-space-repo"',
    )
    expect(formatMacRequest(RECORD_MAC_PROFILE, KEY_SHARE)).toBe(
      'mac=("atproto-space-record";sf);keyid="did:key:zDnaExample";tag="atproto-space-record"',
    )
  })

  it('round-trips a request', () => {
    const header = formatMacRequest(COMMIT_MAC_PROFILE, KEY_SHARE)
    expect(parseMacRequest(header, COMMIT_MAC_PROFILE)).toMatchObject({
      label: 'mac',
      keyShare: KEY_SHARE,
    })
  })

  it('finds the request by its tag, under any label', () => {
    const header = `other=("content-digest");tag="other", m=("atproto-space-commit";sf);keyid="${KEY_SHARE}";tag="atproto-space-repo"`
    expect(parseMacRequest(header, COMMIT_MAC_PROFILE)).toMatchObject({
      label: 'm',
      keyShare: KEY_SHARE,
    })
  })

  it('accepts an hmac-sha256 alg, and no other', () => {
    const header = formatMacRequest(COMMIT_MAC_PROFILE, KEY_SHARE)
    expect(() =>
      parseMacRequest(`${header};alg="hmac-sha256"`, COMMIT_MAC_PROFILE),
    ).not.toThrow()
    expect(() =>
      parseMacRequest(`${header};alg="ecdsa-p256-sha256"`, COMMIT_MAC_PROFILE),
    ).toThrow(/algorithm/)
  })

  it('finds no request when none has the profile tag', () => {
    expect(parseMacRequest(undefined, COMMIT_MAC_PROFILE)).toBeUndefined()
    // Requests with other tags are ignored, including another profile's.
    const header = `other=("content-digest");tag="other", ${formatMacRequest(RECORD_MAC_PROFILE, KEY_SHARE)}`
    expect(parseMacRequest(header, COMMIT_MAC_PROFILE)).toBeUndefined()
  })

  it('rejects a malformed header', () => {
    expect(() => parseMacRequest('???', COMMIT_MAC_PROFILE)).toThrow(
      SpaceMacError,
    )
  })

  it('rejects more than one request with the profile tag', () => {
    const request = `("atproto-space-commit";sf);keyid="${KEY_SHARE}";tag="atproto-space-repo"`
    expect(() =>
      parseMacRequest(`a=${request}, b=${request}`, COMMIT_MAC_PROFILE),
    ).toThrow(/more than one MAC requested/)
  })

  test.each(['created', 'expires', 'nonce="abc"'])(
    'rejects a %s parameter, which the host does not fulfill',
    (param) => {
      const header = formatMacRequest(COMMIT_MAC_PROFILE, KEY_SHARE)
      expect(() =>
        parseMacRequest(`${header};${param}`, COMMIT_MAC_PROFILE),
      ).toThrow(/unsupported MAC parameter/)
    },
  )

  test.each([
    ['another header', '("atproto-space-record";sf)'],
    ['the header without sf', '("atproto-space-commit")'],
    ['an additional header', '("atproto-space-commit";sf "authorization")'],
  ])('rejects a request covering %s', (_name, components) => {
    const header = `mac=${components};keyid="${KEY_SHARE}";tag="atproto-space-repo"`
    expect(() => parseMacRequest(header, COMMIT_MAC_PROFILE)).toThrow(
      /must cover exactly/,
    )
  })

  test.each([
    ['missing', ''],
    ['not a DID', ';keyid="not-a-did"'],
  ])('rejects a keyid that is %s', (_name, keyid) => {
    const header = `mac=("atproto-space-commit";sf)${keyid};tag="atproto-space-repo"`
    expect(() => parseMacRequest(header, COMMIT_MAC_PROFILE)).toThrow(/keyid/)
  })
})

describe('commit MAC', () => {
  const sharedSecret = randomBytes(32)

  it('covers an Atproto-Space-Commit header under the requested parameters', () => {
    const request = parseMacRequest(
      `sig1=("atproto-space-commit";sf);keyid="${KEY_SHARE}";tag="atproto-space-repo"`,
      COMMIT_MAC_PROFILE,
    )!
    const headers = createCommitMacHeaders(request, sharedSecret, commit)

    const covered = `ver=1, repo="did:example:alice", space="${SPACE}", rev="3kbcq3p7ad400", data=:AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=:`
    const params = `("atproto-space-commit";sf);keyid="${KEY_SHARE}";tag="atproto-space-repo"`
    expect(headers['atproto-space-commit']).toBe(covered)
    expect(headers['signature-input']).toBe(`sig1=${params}`)

    // An RFC 9421 hmac-sha256 signature over the covered header.
    const base = `"atproto-space-commit";sf: ${covered}\n"@signature-params": ${params}`
    const mac = createHmac('sha256', sharedSecret).update(base).digest()
    expect(headers['signature']).toBe(`sig1=:${mac.toString('base64')}:`)
  })

  it('verifies under the same shared secret', () => {
    expect(() =>
      verifyCommitMac(commit, commitMacParams(commit, sharedSecret)),
    ).not.toThrow()
    const other = commitMacParams(commit, sharedSecret, randomBytes(32))
    expect(() => verifyCommitMac(commit, other)).toThrow(/MAC does not match/)
  })

  it.each<[string, Partial<SpaceCommit>]>([
    ['ver', { ver: 2 }],
    ['repo', { repo: 'did:example:bob' }],
    ['space', { space: `${SPACE}2` }],
    ['rev', { rev: '3kbcq3p7ad401' }],
    ['data', { data: new Uint8Array(32).fill(2) }],
  ])('rejects a commit with another %s', (_field, override) => {
    const mac = commitMacParams(commit, sharedSecret)
    expect(() => verifyCommitMac({ ...commit, ...override }, mac)).toThrow(
      /commit does not match its MAC/,
    )
  })

  it('rejects a tampered header', () => {
    const mac = commitMacParams(commit, sharedSecret)
    const header = mac.headers.get('atproto-space-commit')!
    mac.headers.set(
      'atproto-space-commit',
      header.replace('3kbcq3p7ad400', '3kbcq3p7ad401'),
    )
    expect(() =>
      verifyCommitMac({ ...commit, rev: '3kbcq3p7ad401' }, mac),
    ).toThrow(/MAC does not match/)
  })

  it('covers the header as a structured field', () => {
    // Whitespace isn't significant, since the header is re-serialized.
    const mac = commitMacParams(commit, sharedSecret)
    const header = mac.headers.get('atproto-space-commit')!
    mac.headers.set('atproto-space-commit', header.replaceAll(', ', ',   '))
    expect(() => verifyCommitMac(commit, mac)).not.toThrow()
  })

  it('finds the MAC by its tag, under any label', () => {
    const mac = commitMacParams(commit, sharedSecret)
    for (const name of ['signature-input', 'signature']) {
      mac.headers.set(name, mac.headers.get(name)!.replace(/^mac=/, 'other='))
    }
    expect(() => verifyCommitMac(commit, mac)).not.toThrow()
  })

  it('rejects more than one MAC with the profile tag', () => {
    const mac = commitMacParams(commit, sharedSecret)
    for (const name of ['signature-input', 'signature']) {
      const value = mac.headers.get(name)!
      mac.headers.set(name, `${value}, ${value.replace(/^mac=/, 'other=')}`)
    }
    expect(() => verifyCommitMac(commit, mac)).toThrow(/more than one/)
  })

  // A MAC over the commit header with the given signature parameters, standing
  // in for a host that answers differently than this package does.
  const macWithParams = (params: string) => {
    const mac = commitMacParams(commit, sharedSecret)
    const covered = mac.headers.get('atproto-space-commit')!
    const base = `"atproto-space-commit";sf: ${covered}\n"@signature-params": ${params}`
    const hmac = createHmac('sha256', sharedSecret).update(base).digest()
    mac.headers.set('signature-input', `mac=${params}`)
    mac.headers.set('signature', `mac=:${hmac.toString('base64')}:`)
    return mac
  }

  test.each([
    [
      'parameters added and reordered',
      `("atproto-space-commit";sf);tag="atproto-space-repo";created=1700000000;keyid="${KEY_SHARE}"`,
    ],
    ['no keyid', '("atproto-space-commit";sf);tag="atproto-space-repo"'],
    [
      'an hmac-sha256 alg',
      `("atproto-space-commit";sf);keyid="${KEY_SHARE}";tag="atproto-space-repo";alg="hmac-sha256"`,
    ],
  ])('accepts a MAC with %s', (_name, params) => {
    expect(() => verifyCommitMac(commit, macWithParams(params))).not.toThrow()
  })

  test.each([
    [
      'another keyid',
      '("atproto-space-commit";sf);keyid="did:key:zDnaOther";tag="atproto-space-repo"',
      /keyid does not match/,
    ],
    [
      'another alg',
      `("atproto-space-commit";sf);keyid="${KEY_SHARE}";tag="atproto-space-repo";alg="hmac-sha512"`,
      /algorithm/,
    ],
    [
      'another tag',
      `("atproto-space-commit";sf);keyid="${KEY_SHARE}";tag="other"`,
      /missing or malformed signature with tag/,
    ],
    [
      'the header not flagged sf',
      `("atproto-space-commit");keyid="${KEY_SHARE}";tag="atproto-space-repo"`,
      /must cover exactly/,
    ],
  ])('rejects a MAC with %s', (_name, params, error) => {
    expect(() => verifyCommitMac(commit, macWithParams(params))).toThrow(error)
  })

  test.each(['atproto-space-commit', 'signature-input', 'signature'])(
    'rejects a response without a %s header',
    (name) => {
      const mac = commitMacParams(commit, sharedSecret)
      mac.headers.delete(name)
      expect(() => verifyCommitMac(commit, mac)).toThrow(SpaceMacError)
    },
  )
})

describe('record MAC', () => {
  const sharedSecret = randomBytes(32)

  it('verifies under the same shared secret', () => {
    const mac = recordMacParams(URI, CID_A, sharedSecret)
    expect(mac.headers.get('atproto-space-record')).toBe(
      `uri="${URI}", cid="${CID_A.toString()}"`,
    )
    expect(() => verifyRecordMac(URI, CID_A, mac)).not.toThrow()
    const other = recordMacParams(URI, CID_A, sharedSecret, randomBytes(32))
    expect(() => verifyRecordMac(URI, CID_A, other)).toThrow(
      /MAC does not match/,
    )
  })

  it('covers the uri and the cid', () => {
    const mac = recordMacParams(URI, CID_A, sharedSecret)
    expect(() => verifyRecordMac(`${URI}2`, CID_A, mac)).toThrow(
      /record does not match its MAC/,
    )
    expect(() => verifyRecordMac(URI, CID_B, mac)).toThrow(
      /record does not match its MAC/,
    )
  })

  it('is not accepted as a commit MAC', () => {
    // The same shared secret never MACs two kinds of message interchangeably.
    const mac = recordMacParams(URI, CID_A, sharedSecret)
    expect(() => verifyCommitMac(commit, mac)).toThrow(
      /missing or malformed signature with tag "atproto-space-repo"/,
    )
  })
})
