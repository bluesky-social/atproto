import { SeedClient, TestNetworkNoAppView, usersSeed } from '@atproto/dev-env'
import { NSID } from '@atproto/syntax'
import {
  AtprotoLexiconResolver,
  buildLexiconResolver,
  resolveLexiconDidAuthority,
} from '../src/index.js'

const dnsEntries: [entry: string, ...result: string[][]][] = []

jest.mock('node:dns/promises', () => {
  return {
    resolveTxt: (entry: string) => {
      const found = dnsEntries.find(([e]) => e === entry)
      if (found) return found.slice(1)
      return []
    },
  }
})

describe('Lexicon resolution', () => {
  let network: TestNetworkNoAppView
  let sc: SeedClient
  let resolveLexicon: AtprotoLexiconResolver

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'lex_lexicon_resolution',
    })
    sc = network.getSeedClient()
    await usersSeed(sc)
    dnsEntries.push(['_lexicon.alice.example', [`did=${sc.dids.alice}`]])
    resolveLexicon = buildLexiconResolver({
      rpc: { fetch },
      idResolver: network.pds.ctx.idResolver,
    })
  })

  afterAll(async () => {
    jest.unmock('node:dns/promises')
    await network.close()
  })

  it('resolves Lexicon.', async () => {
    const client = network.pds.getClient()
    const lex = await client.com.atproto.lexicon.schema.create(
      { repo: sc.dids.alice, rkey: 'example.alice.name1' },
      { id: 'example.alice.name1', lexicon: 1, defs: {} },
      sc.getHeaders(sc.dids.alice),
    )
    const result = await resolveLexicon('example.alice.name1', {
      forceRefresh: true,
    })
    expect(result.commit.did).toEqual(sc.dids.alice)
    expect(result.cid.toString()).toEqual(lex.cid)
    expect(result.uri.toString()).toEqual(lex.uri)
    expect(result.nsid.toString()).toEqual('example.alice.name1')
    expect(result.lexicon).toEqual({
      $type: 'com.atproto.lexicon.schema',
      id: 'example.alice.name1',
      lexicon: 1,
      defs: {},
    })
  })

  it('fails on mismatched id.', async () => {
    const client = network.pds.getClient()
    await client.com.atproto.lexicon.schema.create(
      { repo: sc.dids.alice, rkey: 'example.alice.mismatch' },
      { id: 'example.test1.mismatch.bad', lexicon: 1, defs: {} },
      sc.getHeaders(sc.dids.alice),
    )
    await expect(
      resolveLexicon('example.alice.mismatch', {
        forceRefresh: true,
      }),
    ).rejects.toThrow(
      'Lexicon schema record id (example.test1.mismatch.bad) does not match NSID (example.alice.mismatch)',
    )
  })

  it('fails on missing DNS entry.', async () => {
    const client = network.pds.getClient()
    await client.com.atproto.lexicon.schema.create(
      { repo: sc.dids.bob, rkey: 'example.bob.name' },
      { id: 'example.bob.name', lexicon: 1, defs: {} },
      sc.getHeaders(sc.dids.bob),
    )
    await expect(
      resolveLexicon('example.bob.name', {
        forceRefresh: true,
      }),
    ).rejects.toThrow(
      'Could not resolve a DID authority for NSID (example.bob.name)',
    )
  })

  it('fails on missing record.', async () => {
    await expect(
      resolveLexicon('example.alice.missing', {
        forceRefresh: true,
      }),
    ).rejects.toThrow('Could not resolve Lexicon schema record')
  })

  it('fails on bad verification.', async () => {
    const client = network.pds.getClient()
    const alicekey = await network.pds.ctx.actorStore.keypair(sc.dids.alice)
    const bobkey = await network.pds.ctx.actorStore.keypair(sc.dids.bob)
    await client.com.atproto.lexicon.schema.create(
      { repo: sc.dids.alice, rkey: 'example.alice.badsig' },
      { id: 'example.alice.badsig', lexicon: 1, defs: {} },
      sc.getHeaders(sc.dids.alice),
    )
    // switch alice's key away from the one used by her pds
    await network.pds.ctx.plcClient.updateAtprotoKey(
      sc.dids.alice,
      network.pds.ctx.plcRotationKey,
      bobkey.did(),
    )
    await expect(
      resolveLexicon('example.alice.badsig', {
        forceRefresh: true,
      }),
    ).rejects.toThrow(
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
    // reset alice's key
    await network.pds.ctx.plcClient.updateAtprotoKey(
      sc.dids.alice,
      network.pds.ctx.plcRotationKey,
      alicekey.did(),
    )
  })

  it('fails on invalid Lexicon document.', async () => {
    const client = network.pds.getClient()
    await client.com.atproto.lexicon.schema.create(
      { repo: sc.dids.alice, rkey: 'example.alice.baddoc' },
      { id: 'example.alice.baddoc', lexicon: 999, defs: {} },
      sc.getHeaders(sc.dids.alice),
    )
    await expect(
      resolveLexicon('example.alice.baddoc', {
        forceRefresh: true,
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        name: 'LexiconResolutionError',
        message: 'Invalid Lexicon document (example.alice.baddoc)',
        cause: expect.objectContaining({
          name: 'ZodError',
        }),
      }),
    )
  })

  it('resolves Lexicon based on override authority.', async () => {
    const client = network.pds.getClient()
    await client.com.atproto.lexicon.schema.create(
      { repo: sc.dids.alice, rkey: 'example.alice.override' },
      {
        id: 'example.alice.override',
        lexicon: 1,
        defs: { alice: { type: 'string' } },
      },
      sc.getHeaders(sc.dids.alice),
    )
    const carolLex = await client.com.atproto.lexicon.schema.create(
      { repo: sc.dids.carol, rkey: 'example.alice.override' },
      {
        id: 'example.alice.override',
        lexicon: 1,
        defs: { carol: { type: 'string' } },
      },
      sc.getHeaders(sc.dids.carol),
    )
    const result = await resolveLexicon('example.alice.override', {
      didAuthority: sc.dids.carol,
      forceRefresh: true,
    })
    expect(result.commit.did).toEqual(sc.dids.carol)
    expect(result.cid.toString()).toEqual(carolLex.cid)
    expect(result.uri.toString()).toEqual(carolLex.uri)
    expect(result.nsid.toString()).toEqual('example.alice.override')
    expect(result.lexicon).toEqual({
      $type: 'com.atproto.lexicon.schema',
      id: 'example.alice.override',
      lexicon: 1,
      defs: { carol: { type: 'string' } },
    })
  })

  describe('DID authority', () => {
    it('handles a simple DNS resolution', async () => {
      dnsEntries.push(['_lexicon.simple.test', ['did=did:example:simpleDid']])
      const did = await resolveLexiconDidAuthority('test.simple.name')
      expect(did).toBe('did:example:simpleDid')
    })

    it('handles a noisy DNS resolution', async () => {
      dnsEntries.push([
        '_lexicon.noisy.test',
        ['blah blah blah'],
        ['did:example:fakeDid'],
        ['atproto=did:example:fakeDid'],
        ['did=did:example:noisyDid'],
        [
          'chunk long domain aspdfoiuwerpoaisdfupasodfiuaspdfoiuasdpfoiausdfpaosidfuaspodifuaspdfoiuasdpfoiasudfpasodifuaspdofiuaspdfoiuasd',
          'apsodfiuweproiasudfpoasidfu',
        ],
      ])
      const did = await resolveLexiconDidAuthority('test.noisy.name')
      expect(did).toBe('did:example:noisyDid')
    })

    it('handles a bad DNS resolution', async () => {
      dnsEntries.push([
        '_lexicon.bad.test',
        ['blah blah blah'],
        ['did:example:fakeDid'],
        ['atproto=did:example:fakeDid'],
        [
          'chunk long domain aspdfoiuwerpoaisdfupasodfiuaspdfoiuasdpfoiausdfpaosidfuaspodifuaspdfoiuasdpfoiasudfpasodifuaspdofiuaspdfoiuasd',
          'apsodfiuweproiasudfpoasidfu',
        ],
      ])
      const did = await resolveLexiconDidAuthority('test.bad.name')
      expect(did).toBeUndefined()
    })

    it('throws on multiple dids under same domain', async () => {
      dnsEntries.push([
        '_lexicon.bad.test',
        ['did=did:example:firstDid'],
        ['did=did:example:secondDid'],
      ])
      const did = await resolveLexiconDidAuthority('test.multi.name')
      expect(did).toBeUndefined()
    })

    it('fails on invalid NSID', async () => {
      await expect(resolveLexiconDidAuthority('not an nsid')).rejects.toThrow(
        'Disallowed characters in NSID',
      )
    })

    it('fails on invalid DID result', async () => {
      dnsEntries.push(['_lexicon.invalid.test', ['did=not:a:did']])
      const did = await resolveLexiconDidAuthority('test.invalid.name')
      expect(did).toBeUndefined()
    })

    it('accepts NSID object', async () => {
      const did = await resolveLexiconDidAuthority(
        NSID.parse('test.simple.name'),
      )
      expect(did).toBe('did:example:simpleDid')
    })
  })
})
