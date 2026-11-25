import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { randomBytes } from '@atproto/crypto'
import { parseCid } from '@atproto/lex-data'
import type { AtUriString, DidString } from '@atproto/syntax'
import {
  COMMIT_MAC_PROFILE,
  RECORD_MAC_PROFILE,
  type VerifyMacParams,
  createCommitMacHeaders,
  createRecordMacHeaders,
  formatMacRequest,
  parseMacRequest,
  verifyCommitMac,
  verifyRecordMac,
} from './mac.js'
import type { SpaceCommit } from './types.js'

// Only ever parsed: these tests choose the shared secret rather than derive it.
const KEY_SHARE: DidString = 'did:key:zDnaExample'

// cids of `{ text: 'hello' }` and `{ text: 'world' }`
const CID_A = parseCid(
  'bafyreidefdycgbfy3oglcb6ism3eqhyp5llsrpzxjsuac2gsy4mtrtx244',
)
const CID_B = parseCid(
  'bafyreidpw4cbv6gr4ukh33z23pvvrpr3wi4gnpmi4doamlsl3sa4rgri2a',
)

const SPACE = 'at:space/did:example:space/app.bsky.group/test'
const URI: AtUriString = `${SPACE}/did:example:alice/app.bsky.feed.post/1`
const COMMIT_REQUEST = formatMacRequest(COMMIT_MAC_PROFILE, KEY_SHARE)
const COMMIT_PARAMS = COMMIT_REQUEST.slice('mac='.length)

const commit: SpaceCommit = {
  ver: 1,
  space: SPACE,
  repo: 'did:example:alice',
  rev: '3kbcq3p7ad400',
  data: new Uint8Array(32).fill(1),
}

const sharedSecret = randomBytes(32)

const hmac = (base: string) =>
  createHmac('sha256', sharedSecret).update(base).digest('base64')

// What the syncer verifies a response with.
const verifyParams = (headers: Record<string, string>): VerifyMacParams => ({
  keyShare: KEY_SHARE,
  sharedSecret,
  headers: new Headers(headers),
})

// The host's response for `commit`, MACed under `hostSecret`.
const commitMac = (hostSecret = sharedSecret) => {
  const request = parseMacRequest(COMMIT_REQUEST, COMMIT_MAC_PROFILE)!
  const { headers } = createCommitMacHeaders(commit, {
    ...request,
    sharedSecret: hostSecret,
  })
  return verifyParams(headers)
}

const recordMac = () => {
  const request = parseMacRequest(
    formatMacRequest(RECORD_MAC_PROFILE, KEY_SHARE),
    RECORD_MAC_PROFILE,
  )!
  const { headers } = createRecordMacHeaders(URI, CID_A, {
    ...request,
    sharedSecret,
  })
  return verifyParams(headers)
}

// A commit MAC under the given signature parameters, as a host other than this
// package might send it.
const commitMacWith = (params: string) => {
  const mac = commitMac()
  const covered = mac.headers.get('atproto-space-commit')
  mac.headers.set('signature-input', `mac=${params}`)
  mac.headers.set(
    'signature',
    `mac=:${hmac(`"atproto-space-commit";sf: ${covered}\n"@signature-params": ${params}`)}:`,
  )
  return mac
}

describe(formatMacRequest, () => {
  it('formats the Accept-Signature header for each profile', () => {
    expect(COMMIT_REQUEST).toBe(
      'mac=("atproto-space-commit";sf);keyid="did:key:zDnaExample";tag="atproto-space-commit"',
    )
    expect(formatMacRequest(RECORD_MAC_PROFILE, KEY_SHARE)).toBe(
      'mac=("atproto-space-record";sf);keyid="did:key:zDnaExample";tag="atproto-space-record"',
    )
  })
})

describe(parseMacRequest, () => {
  it('round-trips a formatted request', () => {
    expect(parseMacRequest(COMMIT_REQUEST, COMMIT_MAC_PROFILE)).toEqual({
      label: 'mac',
      keyShare: KEY_SHARE,
      signatureParams: COMMIT_PARAMS,
    })
  })

  it('finds the request by its tag under any label', () => {
    const header = `other=("content-digest");tag="other", m=${COMMIT_PARAMS}`
    expect(parseMacRequest(header, COMMIT_MAC_PROFILE)).toEqual({
      label: 'm',
      keyShare: KEY_SHARE,
      signatureParams: COMMIT_PARAMS,
    })
  })

  it('finds no request when none has the profile tag', () => {
    expect(parseMacRequest(undefined, COMMIT_MAC_PROFILE)).toBeUndefined()
    const header = `other=("content-digest");tag="other", ${formatMacRequest(RECORD_MAC_PROFILE, KEY_SHARE)}`
    expect(parseMacRequest(header, COMMIT_MAC_PROFILE)).toBeUndefined()
  })

  it('accepts an explicit hmac-sha256 alg', () => {
    expect(
      parseMacRequest(
        `${COMMIT_REQUEST};alg="hmac-sha256"`,
        COMMIT_MAC_PROFILE,
      ),
    ).toMatchObject({ keyShare: KEY_SHARE })
  })

  it.each([
    {
      note: 'a malformed header',
      header: '???',
      message: /malformed Accept-Signature header/,
    },
    {
      note: 'a multi-valued header',
      header: [COMMIT_REQUEST, COMMIT_REQUEST],
      message: /missing or malformed Accept-Signature header/,
    },
    {
      note: 'more than one request with the profile tag',
      header: `a=${COMMIT_PARAMS}, b=${COMMIT_PARAMS}`,
      message: /more than one MAC requested/,
    },
    {
      note: 'a parameter the host does not fulfill',
      header: `${COMMIT_REQUEST};created=1700000000`,
      message: /unsupported MAC parameter: created/,
    },
    {
      note: 'another alg',
      header: `${COMMIT_REQUEST};alg="ecdsa-p256-sha256"`,
      message: /MAC algorithm must be hmac-sha256/,
    },
    {
      note: 'a request covering another header',
      header: `mac=("atproto-space-record";sf);keyid="${KEY_SHARE}";tag="atproto-space-commit"`,
      message: /must cover exactly/,
    },
    {
      note: 'a request covering the header without sf',
      header: `mac=("atproto-space-commit");keyid="${KEY_SHARE}";tag="atproto-space-commit"`,
      message: /must cover exactly/,
    },
    {
      note: 'a request covering an additional header',
      header: `mac=("atproto-space-commit";sf "authorization");keyid="${KEY_SHARE}";tag="atproto-space-commit"`,
      message: /must cover exactly/,
    },
    {
      note: 'a request without a keyid',
      header: 'mac=("atproto-space-commit";sf);tag="atproto-space-commit"',
      message: /missing or malformed keyid/,
    },
    {
      note: 'a keyid that is not a DID',
      header:
        'mac=("atproto-space-commit";sf);keyid="key-1";tag="atproto-space-commit"',
      message: /missing or malformed keyid/,
    },
  ])('rejects $note', ({ header, message }) => {
    expect(() => parseMacRequest(header, COMMIT_MAC_PROFILE)).toThrow(message)
  })
})

describe(createCommitMacHeaders, () => {
  it('covers an Atproto-Space-Commit header under the requested parameters', () => {
    const request = parseMacRequest(
      `sig1=${COMMIT_PARAMS}`,
      COMMIT_MAC_PROFILE,
    )!
    const { headers } = createCommitMacHeaders(commit, {
      ...request,
      sharedSecret,
    })

    const covered = `ver=1, repo="did:example:alice", space="${SPACE}", rev="3kbcq3p7ad400", data=:AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=:`
    const base = `"atproto-space-commit";sf: ${covered}\n"@signature-params": ${COMMIT_PARAMS}`
    expect(headers).toEqual({
      'atproto-space-commit': covered,
      'signature-input': `sig1=${COMMIT_PARAMS}`,
      signature: `sig1=:${hmac(base)}:`,
    })
  })
})

describe(verifyCommitMac, () => {
  it('verifies under the same shared secret', () => {
    expect(() => verifyCommitMac(commit, commitMac())).not.toThrow()
  })

  it('rejects a MAC under another shared secret', () => {
    expect(() => verifyCommitMac(commit, commitMac(randomBytes(32)))).toThrow(
      /MAC does not match/,
    )
  })

  it.each<{ note: string; field: Partial<SpaceCommit> }>([
    { note: 'ver', field: { ver: 2 } },
    { note: 'repo', field: { repo: 'did:example:bob' } },
    { note: 'space', field: { space: `${SPACE}2` } },
    { note: 'rev', field: { rev: '3kbcq3p7ad401' } },
    { note: 'data', field: { data: new Uint8Array(32).fill(2) } },
  ])('rejects a commit with another $note', ({ field }) => {
    expect(() => verifyCommitMac({ ...commit, ...field }, commitMac())).toThrow(
      /commit does not match its MAC/,
    )
  })

  it('rejects a tampered header', () => {
    const mac = commitMac()
    const header = mac.headers.get('atproto-space-commit')!
    mac.headers.set(
      'atproto-space-commit',
      header.replace('3kbcq3p7ad400', '3kbcq3p7ad401'),
    )
    expect(() =>
      verifyCommitMac({ ...commit, rev: '3kbcq3p7ad401' }, mac),
    ).toThrow(/MAC does not match/)
  })

  it('ignores insignificant whitespace in the covered header', () => {
    const mac = commitMac()
    const header = mac.headers.get('atproto-space-commit')!
    mac.headers.set('atproto-space-commit', header.replaceAll(', ', ',   '))
    expect(() => verifyCommitMac(commit, mac)).not.toThrow()
  })

  it.each([
    {
      note: 'parameters added and reordered',
      params: `("atproto-space-commit";sf);tag="atproto-space-commit";created=1700000000;keyid="${KEY_SHARE}"`,
    },
    {
      note: 'no keyid',
      params: '("atproto-space-commit";sf);tag="atproto-space-commit"',
    },
    {
      note: 'an hmac-sha256 alg',
      params: `${COMMIT_PARAMS};alg="hmac-sha256"`,
    },
  ])('accepts a MAC with $note', ({ params }) => {
    expect(() => verifyCommitMac(commit, commitMacWith(params))).not.toThrow()
  })

  it.each([
    {
      note: 'another keyid',
      params:
        '("atproto-space-commit";sf);keyid="did:key:zDnaOther";tag="atproto-space-commit"',
      message: /keyid does not match/,
    },
    {
      note: 'another alg',
      params: `${COMMIT_PARAMS};alg="hmac-sha512"`,
      message: /signature algorithm must be hmac-sha256/,
    },
    {
      note: 'the header not flagged sf',
      params: `("atproto-space-commit");keyid="${KEY_SHARE}";tag="atproto-space-commit"`,
      message: /must cover exactly/,
    },
  ])('rejects a MAC with $note', ({ params, message }) => {
    expect(() => verifyCommitMac(commit, commitMacWith(params))).toThrow(
      message,
    )
  })

  it.each([
    {
      header: 'atproto-space-commit',
      message: /missing or malformed atproto-space-commit header/,
    },
    {
      header: 'signature',
      message: /missing or malformed signature headers/,
    },
  ])('rejects a response without its $header header', ({ header, message }) => {
    const mac = commitMac()
    mac.headers.delete(header)
    expect(() => verifyCommitMac(commit, mac)).toThrow(message)
  })
})

describe(verifyRecordMac, () => {
  it('verifies an Atproto-Space-Record header naming the uri and cid', () => {
    const mac = recordMac()
    expect(mac.headers.get('atproto-space-record')).toBe(
      `uri="${URI}", cid="${CID_A.toString()}"`,
    )
    expect(() => verifyRecordMac(URI, CID_A, mac)).not.toThrow()
  })

  it.each([
    { note: 'uri', uri: `${URI}2` as AtUriString, cid: CID_A },
    { note: 'cid', uri: URI, cid: CID_B },
  ])('rejects another $note', ({ uri, cid }) => {
    expect(() => verifyRecordMac(uri, cid, recordMac())).toThrow(
      /record does not match its MAC/,
    )
  })

  it('is not accepted as a commit MAC', () => {
    expect(() => verifyCommitMac(commit, recordMac())).toThrow(
      /missing or malformed signature with tag "atproto-space-commit"/,
    )
  })
})
