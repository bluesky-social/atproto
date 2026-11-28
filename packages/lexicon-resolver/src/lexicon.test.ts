import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LexMap } from '@atproto/lex-data'
import { NSID } from '@atproto/syntax'
import { type StubAccount, StubPds } from './_stub-pds.test.js'
import {
  type AtprotoLexiconResolver,
  buildLexiconResolver,
  resolveLexiconDidAuthority,
} from './lexicon.js'
import { com } from './lexicons/index.js'

const { dnsRecords } = vi.hoisted(() => ({
  dnsRecords: new Map<string, string[][]>([
    ['_lexicon.simple.test', [['did=did:example:simpleDid']]],
    [
      '_lexicon.noisy.test',
      [
        ['blah blah blah'],
        ['did:example:fakeDid'],
        ['atproto=did:example:fakeDid'],
        ['did=did:example:noisyDid'],
        [
          'chunk long domain aspdfoiuwerpoaisdfupasodfiuaspdfoiuasdpfoiausdfpaosidfuaspodifuaspdfoiuasdpfoiasudfpasodifuaspdofiuaspdfoiuasd',
          'apsodfiuweproiasudfpoasidfu',
        ],
      ],
    ],
    [
      '_lexicon.bad.test',
      [
        ['blah blah blah'],
        ['did:example:fakeDid'],
        ['atproto=did:example:fakeDid'],
        [
          'chunk long domain aspdfoiuwerpoaisdfupasodfiuaspdfoiuasdpfoiausdfpaosidfuaspodifuaspdfoiuasdpfoiasudfpasodifuaspdofiuaspdfoiuasd',
          'apsodfiuweproiasudfpoasidfu',
        ],
      ],
    ],
    [
      '_lexicon.multi.test',
      [['did=did:example:firstDid'], ['did=did:example:secondDid']],
    ],
    ['_lexicon.invalid.test', [['did=not:a:did']]],
  ]),
}))

vi.mock('node:dns/promises', () => {
  const mock = {
    resolveTxt: async (hostname: string) => {
      const records = dnsRecords.get(hostname)
      if (records) return records
      throw Object.assign(new Error(`queryTxt ENOTFOUND ${hostname}`), {
        code: 'ENOTFOUND',
      })
    },
  }
  return { default: mock, ...mock }
})

describe(buildLexiconResolver, () => {
  let pds: StubPds
  let alice: StubAccount
  let bob: StubAccount
  let carol: StubAccount
  let resolveLexicon: AtprotoLexiconResolver

  beforeEach(async () => {
    pds = new StubPds()
    alice = await pds.createAccount('alice')
    bob = await pds.createAccount('bob')
    carol = await pds.createAccount('carol')
    dnsRecords.set('_lexicon.alice.example', [[`did=${alice.did}`]])
    resolveLexicon = buildLexiconResolver({
      rpc: { fetch: pds.fetch },
      idResolver: pds.idResolver,
    })
  })

  const createLexicon = (
    account: StubAccount,
    rkey: string,
    lexicon: LexMap,
  ) => {
    const record = { $type: com.atproto.lexicon.schema.$type, ...lexicon }
    return pds.createRecord(
      account,
      com.atproto.lexicon.schema.$nsid,
      rkey,
      record,
    )
  }

  it('resolves Lexicon.', async () => {
    const lex = await createLexicon(alice, 'example.alice.name1', {
      id: 'example.alice.name1',
      lexicon: 1,
      defs: {},
    })
    const result = await resolveLexicon('example.alice.name1')
    expect(result.commit.did).toEqual(alice.did)
    expect(result.cid.toString()).toEqual(lex.cid.toString())
    expect(result.uri.toString()).toEqual(lex.uri.toString())
    expect(result.nsid.toString()).toEqual('example.alice.name1')
    expect(result.lexicon).toEqual({
      $type: com.atproto.lexicon.schema.$type,
      id: 'example.alice.name1',
      lexicon: 1,
      defs: {},
    })
  })

  it('fails on mismatched id.', async () => {
    await createLexicon(alice, 'example.alice.mismatch', {
      id: 'example.test1.mismatch.bad',
      lexicon: 1,
      defs: {},
    })
    await expect(resolveLexicon('example.alice.mismatch')).rejects.toThrow(
      'Lexicon schema record id (example.test1.mismatch.bad) does not match NSID (example.alice.mismatch)',
    )
  })

  it('fails on missing DNS entry.', async () => {
    await createLexicon(bob, 'example.bob.name', {
      id: 'example.bob.name',
      lexicon: 1,
      defs: {},
    })
    await expect(resolveLexicon('example.bob.name')).rejects.toThrow(
      'Could not resolve a DID authority for NSID (example.bob.name)',
    )
  })

  it('fails on missing record.', async () => {
    await expect(resolveLexicon('example.alice.missing')).rejects.toThrow(
      'Could not resolve Lexicon schema record',
    )
  })

  it('fails on bad verification.', async () => {
    await createLexicon(alice, 'example.alice.badsig', {
      id: 'example.alice.badsig',
      lexicon: 1,
      defs: {},
    })
    // switch alice's key away from the one her repo is signed with
    pds.updateIdentity(alice.did, (data) => ({
      ...data,
      verificationMethods: { atproto: bob.keypair.did() },
    }))
    await expect(resolveLexicon('example.alice.badsig')).rejects.toThrow(
      expect.objectContaining({
        name: 'LexiconResolutionError',
        message:
          'Could not resolve Lexicon schema record (example.alice.badsig)',
        cause: expect.objectContaining({
          name: 'RecordResolutionError',
          message: expect.stringContaining('Invalid signature on commit'),
        }),
      }),
    )
  })

  it('fails on invalid Lexicon document.', async () => {
    await createLexicon(alice, 'example.alice.baddoc', {
      id: 'example.alice.baddoc',
      lexicon: 999,
      defs: {},
    })
    await expect(resolveLexicon('example.alice.baddoc')).rejects.toThrow(
      expect.objectContaining({
        name: 'LexiconResolutionError',
        message: 'Invalid Lexicon document (example.alice.baddoc)',
        cause: expect.objectContaining({
          name: 'LexValidationError',
        }),
      }),
    )
  })

  it('resolves Lexicon based on override authority.', async () => {
    await createLexicon(alice, 'example.alice.override', {
      id: 'example.alice.override',
      lexicon: 1,
      defs: { alice: { type: 'string' } },
    })
    const carolLex = await createLexicon(carol, 'example.alice.override', {
      id: 'example.alice.override',
      lexicon: 1,
      defs: { carol: { type: 'string' } },
    })
    const result = await resolveLexicon('example.alice.override', {
      didAuthority: carol.did,
    })
    expect(result.commit.did).toEqual(carol.did)
    expect(result.cid.toString()).toEqual(carolLex.cid.toString())
    expect(result.uri.toString()).toEqual(carolLex.uri.toString())
    expect(result.nsid.toString()).toEqual('example.alice.override')
    expect(result.lexicon).toEqual({
      $type: com.atproto.lexicon.schema.$type,
      id: 'example.alice.override',
      lexicon: 1,
      defs: { carol: { type: 'string' } },
    })
  })
})

describe(resolveLexiconDidAuthority, () => {
  it('handles a simple DNS resolution', async () => {
    const did = await resolveLexiconDidAuthority('test.simple.name')
    expect(did).toBe('did:example:simpleDid')
  })

  it('handles a noisy DNS resolution', async () => {
    const did = await resolveLexiconDidAuthority('test.noisy.name')
    expect(did).toBe('did:example:noisyDid')
  })

  it('handles a bad DNS resolution', async () => {
    const did = await resolveLexiconDidAuthority('test.bad.name')
    expect(did).toBeUndefined()
  })

  it('ignores multiple dids under same domain', async () => {
    const did = await resolveLexiconDidAuthority('test.multi.name')
    expect(did).toBeUndefined()
  })

  it('fails on invalid NSID', async () => {
    // @ts-expect-error testing invalid input
    await expect(resolveLexiconDidAuthority('not an nsid')).rejects.toThrow(
      'Disallowed characters in NSID',
    )
  })

  it('fails on invalid DID result', async () => {
    const did = await resolveLexiconDidAuthority('test.invalid.name')
    expect(did).toBeUndefined()
  })

  it('accepts NSID object', async () => {
    const did = await resolveLexiconDidAuthority(NSID.parse('test.simple.name'))
    expect(did).toBe('did:example:simpleDid')
  })
})
