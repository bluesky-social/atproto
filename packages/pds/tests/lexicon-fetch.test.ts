import { jest } from '@jest/globals'
import { streamToBytes } from '@atproto/common'
import { Secp256k1Keypair } from '@atproto/crypto'
import { LexResolver, type LexResolverHooks } from '@atproto/lex-resolver'
import {
  MemoryBlockstore,
  Repo,
  WriteOpAction,
  getRecords,
} from '@atproto/repo'
import { safeFetchWrap } from '@atproto-labs/fetch-node'
import { createLexiconFetch } from '../src/lexicon-fetch.js'
import * as lexiconSchema from '../src/lexicons/com/atproto/lexicon/schema.js'
import * as getRecord from '../src/lexicons/com/atproto/sync/getRecord.js'

const publicUrl = 'http://127.0.0.1:2583'
const did = 'did:plc:abcdefghijklmnopqrstuvwx'
const nsid = 'com.example.authFull'
const record = {
  $type: lexiconSchema.$nsid,
  lexicon: 1,
  id: nsid,
  defs: {
    main: {
      type: 'permission-set',
      title: 'Example',
      permissions: [
        {
          type: 'permission',
          resource: 'repo',
          collection: ['com.example.post'],
          action: ['create'],
        },
      ],
    },
  },
}
const params = { did, collection: lexiconSchema.$nsid, rkey: nsid }
const recordUrl = `${publicUrl}/xrpc/${getRecord.$lxm}?${new URLSearchParams(params)}`

async function fixture(lexicon = record) {
  const key = await Secp256k1Keypair.create()
  const storage = new MemoryBlockstore()
  const repo = await Repo.create(storage, did, key, [
    {
      action: WriteOpAction.Create,
      collection: lexiconSchema.$nsid,
      rkey: nsid,
      record: lexicon,
    },
  ])
  const proof = await streamToBytes(getRecords(storage, repo.cid, [params]))
  const document = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: did,
    verificationMethod: [
      {
        id: `${did}#atproto`,
        type: 'Multikey',
        controller: did,
        publicKeyMultibase: key.did().slice('did:key:'.length),
      },
    ],
    service: [
      {
        id: '#atproto_pds',
        type: 'AtprotoPersonalDataServer',
        serviceEndpoint: publicUrl,
      },
    ],
  }
  const safeFetch = safeFetchWrap({
    allowIpHost: false,
    allowImplicitRedirect: false,
  })
  const fetch: typeof globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    if (url.origin === 'https://plc.directory') {
      return Promise.resolve(Response.json(document))
    }
    return safeFetch(input, init)
  }
  const getLocalRecord = jest
    .fn<Parameters<typeof createLexiconFetch>[0]['getLocalRecord']>()
    .mockResolvedValue(proof)
  return { fetch, getLocalRecord, document }
}

describe(createLexiconFetch, () => {
  it('resolves a signed local permission set even when self-fetch is blocked', async () => {
    const { fetch, getLocalRecord } = await fixture()
    const hooks: LexResolverHooks = { onResolveAuthority: () => did }
    await expect(new LexResolver({ fetch, hooks }).get(nsid)).rejects.toThrow(
      'Failed to fetch Record',
    )
    const resolver = new LexResolver({
      hooks,
      fetch: createLexiconFetch({ publicUrl, fetch, getLocalRecord }),
    })
    await expect(resolver.get(nsid)).resolves.toMatchObject({ lexicon: record })
    expect(getLocalRecord).toHaveBeenCalledWith(params)
  })

  it('still verifies local proof signatures against the DID document', async () => {
    const { fetch, getLocalRecord, document } = await fixture()
    const otherKey = await Secp256k1Keypair.create()
    document.verificationMethod[0].publicKeyMultibase = otherKey
      .did()
      .slice('did:key:'.length)
    const resolver = new LexResolver({
      hooks: { onResolveAuthority: () => did },
      fetch: createLexiconFetch({ publicUrl, fetch, getLocalRecord }),
    })
    await expect(resolver.get(nsid)).rejects.toThrow(
      'Failed to verify Lexicon record proof',
    )
  })

  it.each([
    [{ ...record, lexicon: 2 }, 'Invalid Lexicon document'],
    [{ ...record, id: 'com.example.other' }, 'Invalid document id'],
  ] as const)(
    'validates local Lexicon documents: %s',
    async (lexicon, message) => {
      const { fetch, getLocalRecord } = await fixture(lexicon)
      const resolver = new LexResolver({
        hooks: { onResolveAuthority: () => did },
        fetch: createLexiconFetch({ publicUrl, fetch, getLocalRecord }),
      })
      await expect(resolver.get(nsid)).rejects.toThrow(message)
    },
  )

  it('uses the current DID service endpoint instead of a leftover local repo', async () => {
    const { fetch, getLocalRecord, document } = await fixture()
    document.service[0].serviceEndpoint = 'https://moved.example.com'
    const remoteFetch: typeof globalThis.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input)
      if (url.origin === document.service[0].serviceEndpoint) {
        return Promise.reject(new Error('remote PDS'))
      }
      return fetch(input, init)
    }
    const resolver = new LexResolver({
      hooks: { onResolveAuthority: () => did },
      fetch: createLexiconFetch({
        publicUrl,
        fetch: remoteFetch,
        getLocalRecord,
      }),
    })
    await expect(resolver.get(nsid)).rejects.toThrow('Failed to fetch Record')
    expect(getLocalRecord).not.toHaveBeenCalled()
  })

  it.each([
    recordUrl.replace('127.0.0.1:2583', '127.0.0.1:2584'),
    recordUrl.replace('http:', 'https:'),
    recordUrl.replace(lexiconSchema.$nsid, 'com.example.post'),
    recordUrl.replace(getRecord.$lxm, 'com.atproto.repo.getRecord'),
  ])(
    'delegates requests outside the local Lexicon endpoint: %s',
    async (url) => {
      const fetch = jest
        .fn<typeof globalThis.fetch>()
        .mockRejectedValue(new Error('protected fetch'))
      const getLocalRecord =
        jest.fn<Parameters<typeof createLexiconFetch>[0]['getLocalRecord']>()
      await expect(
        createLexiconFetch({ publicUrl, fetch, getLocalRecord })(url),
      ).rejects.toThrow('protected fetch')
      expect(fetch).toHaveBeenCalledWith(url, undefined)
      expect(getLocalRecord).not.toHaveBeenCalled()
    },
  )

  it('does not fall back to HTTP for unavailable local records', async () => {
    const fetch = jest.fn<typeof globalThis.fetch>()
    const getLocalRecord = jest
      .fn<Parameters<typeof createLexiconFetch>[0]['getLocalRecord']>()
      .mockRejectedValue(new Error('Repo not available'))
    await expect(
      createLexiconFetch({ publicUrl, fetch, getLocalRecord })(recordUrl),
    ).rejects.toThrow('Repo not available')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('validates local request parameters before reading a repo', async () => {
    const { fetch, getLocalRecord } = await fixture()
    const invalidUrl = new URL(recordUrl)
    invalidUrl.searchParams.set('did', '../other')
    await expect(
      createLexiconFetch({ publicUrl, fetch, getLocalRecord })(invalidUrl),
    ).rejects.toThrow()
    expect(getLocalRecord).not.toHaveBeenCalled()
  })

  it('honors cancellation before reading a local proof', async () => {
    const { fetch, getLocalRecord } = await fixture()
    const signal = AbortSignal.abort(new Error('cancelled'))
    await expect(
      createLexiconFetch({ publicUrl, fetch, getLocalRecord })(
        new Request(recordUrl, { signal }),
      ),
    ).rejects.toThrow('cancelled')
    expect(getLocalRecord).not.toHaveBeenCalled()
  })
})
