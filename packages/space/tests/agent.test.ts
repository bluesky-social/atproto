import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { DidDocument } from '@atproto/common-web'
import { P256Keypair } from '@atproto/crypto'
import { Client } from '@atproto/lex-client'
import type { Cid } from '@atproto/lex-data'
import { lexStringify } from '@atproto/lex-json'
import { l } from '@atproto/lex-schema'
import type { DidString, SpaceRefString } from '@atproto/syntax'
import {
  COMMIT_MAC_TYPE,
  MAC_HEADER,
  MAC_TYPE_BY_METHOD,
  type MacType,
  RECORD_MAC_TYPE,
  RepoCommit,
  type SerializedRecord,
  type SpaceCommit,
  SpaceCredentialAgent,
  SpaceKemError,
  SpaceMacError,
  SpaceRepoVerificationError,
  WANT_MAC_HEADER,
  computeCommitMac,
  computeRecordMac,
  createSpaceCredential,
  decapsulate,
  formatMacHeader,
  parseWantMacHeader,
  serializeRecord,
  verifyCredentialSig,
  writeRepoStar,
} from '../src/index.js'

const SPACE_DID: DidString = 'did:example:space'
const SPACE: SpaceRefString = `at://${SPACE_DID}/space/com.example.group/default`
const AUTHOR: DidString = 'did:example:author'
const COLLECTION = 'com.example.post'
const PDS_ORIGIN = 'https://pds.example.com'

// A minimal `com.atproto.space.getRecord`, since this package has no generated lexicons.
const getRecord = l.query(
  'com.atproto.space.getRecord',
  l.params({
    space: l.string({ format: 'space-ref' }),
    repo: l.string({ format: 'did' }),
    collection: l.string({ format: 'nsid' }),
    rkey: l.string({ format: 'record-key' }),
  }),
  l.jsonPayload({
    uri: l.string({ format: 'at-uri' }),
    cid: l.string({ format: 'cid' }),
    value: l.lexMap(),
  }),
)

const xrpcPath = (nsid: string, params: Record<string, string>): `/${string}` =>
  `/xrpc/${nsid}?${new URLSearchParams(params)}`

const getRecordPath = xrpcPath('com.atproto.space.getRecord', {
  space: SPACE,
  repo: AUTHOR,
  collection: COLLECTION,
  rkey: 'a',
})

const collect = async <T>(iter: AsyncIterable<T>): Promise<T[]> => {
  const items: T[] = []
  for await (const item of iter) items.push(item)
  return items
}

describe('SpaceCredentialAgent', () => {
  let authorKem: P256Keypair
  let syncerKey: P256Keypair
  let credential: string
  let records: (SerializedRecord & { cid: Cid })[]
  let commit: SpaceCommit

  // How the fake repo host answers the next request.
  let mode: 'ok' | 'bad-mac' | 'no-mac' | 'error' | 'other-record' | 'no-commit'
  let seen: Request[]

  // A repo host for AUTHOR that MACs what it returns, as a real one does.
  const fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input, init)
    seen.push(request)
    if (mode === 'error') {
      return Response.json(
        { error: 'RepoNotFound', message: 'no repo' },
        { status: 400 },
      )
    }

    const url = new URL(request.url)
    const nsid = url.pathname.replace('/xrpc/', '')
    const macType = MAC_TYPE_BY_METHOD[nsid]
    const sharedSecret = macType
      ? decapsulate(
          authorKem,
          parseWantMacHeader(
            request.headers.get(WANT_MAC_HEADER) ?? undefined,
            macType,
          ),
        )
      : undefined

    const macHeaders = (mac: Uint8Array): HeadersInit => {
      if (mode === 'no-mac') return {}
      const sent = mode === 'bad-mac' ? new Uint8Array(32) : mac
      return { [MAC_HEADER]: formatMacHeader(macType, sent) }
    }

    switch (nsid) {
      case 'com.atproto.space.getRecord': {
        const record = records[0]
        const rkey =
          mode === 'other-record' ? 'b' : url.searchParams.get('rkey')
        const uri = `${SPACE}/${AUTHOR}/${COLLECTION}/${rkey}`
        return new Response(
          lexStringify({
            uri,
            cid: record.cid.toString(),
            value: { text: 'first' },
          }),
          {
            headers: {
              'content-type': 'application/json',
              ...macHeaders(computeRecordMac(sharedSecret!, uri, record.cid)),
            },
          },
        )
      }
      case 'com.atproto.space.getLatestCommit':
        return new Response(lexStringify({ commit }), {
          headers: {
            'content-type': 'application/json',
            ...macHeaders(computeCommitMac(sharedSecret!, commit)),
          },
        })
      case 'com.atproto.space.getRepo': {
        const chunks = await collect(writeRepoStar(commit, records))
        return new Response(Buffer.concat(chunks), {
          headers: {
            'content-type': 'application/octet-stream',
            ...macHeaders(computeCommitMac(sharedSecret!, commit)),
          },
        })
      }
      case 'com.atproto.space.listRepoOps':
        // A page short of the head of the oplog carries no commit, and no MAC.
        if (mode === 'no-commit') {
          return Response.json({ ops: [], cursor: 'next' })
        }
        return new Response(lexStringify({ ops: [], commit }), {
          headers: {
            'content-type': 'application/json',
            ...macHeaders(computeCommitMac(sharedSecret!, commit)),
          },
        })
      default:
        return Response.json({ cids: [], repos: [] })
    }
  }

  const resolveDidDoc = async (did: DidString): Promise<DidDocument> => ({
    id: did,
    verificationMethod: [
      {
        id: '#atproto_kem',
        type: 'Multikey',
        controller: did,
        publicKeyMultibase: authorKem.did().slice('did:key:'.length),
      },
    ],
    service: [
      {
        id: '#atproto_pds',
        type: 'AtprotoPersonalDataServer',
        serviceEndpoint: PDS_ORIGIN,
      },
    ],
  })

  const newAgent = () =>
    new SpaceCredentialAgent({
      credential,
      keypair: syncerKey,
      resolveDidDoc,
      fetch,
    })

  beforeAll(async () => {
    authorKem = await P256Keypair.create()
    syncerKey = await P256Keypair.create()
    credential = await createSpaceCredential({
      iss: SPACE_DID,
      sub: SPACE,
      keyId: syncerKey.did() as DidString,
      keypair: await P256Keypair.create(),
    })
    records = await Promise.all([
      serializeRecord(COLLECTION, 'a', { text: 'first' }),
      serializeRecord(COLLECTION, 'b', { text: 'second' }),
    ])
    commit = RepoCommit.fromRecords(records).toCommit({
      space: SPACE,
      repo: AUTHOR,
      rev: '3kbcq3p7ad42b',
    })
  })

  beforeEach(() => {
    mode = 'ok'
    seen = []
  })

  it('serves as a lex-client agent, verifying the record it returns', async () => {
    const client = new Client(newAgent())
    const res = await client.call(getRecord, {
      space: SPACE,
      repo: AUTHOR,
      collection: COLLECTION,
      rkey: 'a',
    })
    expect(res.value).toEqual({ text: 'first' })

    const [request] = seen
    expect(new URL(request.url).origin).toBe(PDS_ORIGIN)
    expect([...request.headers.keys()]).toEqual(
      expect.arrayContaining([
        'authorization',
        'signature',
        'signature-input',
        'atproto-space-audience',
        WANT_MAC_HEADER,
      ]),
    )
    expect(request.headers.get('atproto-space-audience')).toBe(AUTHOR)
    await expect(
      verifyCredentialSig(
        Object.fromEntries(request.headers),
        syncerKey.did() as DidString,
      ),
    ).resolves.toBeUndefined()
  })

  it('rejects a response whose MAC does not match', async () => {
    mode = 'bad-mac'
    await expect(
      newAgent().fetchHandler(getRecordPath, { method: 'GET' }),
    ).rejects.toThrow(SpaceMacError)
  })

  it('rejects a successful response that carries no MAC', async () => {
    mode = 'no-mac'
    await expect(
      newAgent().fetchHandler(getRecordPath, { method: 'GET' }),
    ).rejects.toThrow(SpaceMacError)
  })

  it('passes an error response through unverified', async () => {
    mode = 'error'
    const res = await newAgent().fetchHandler(getRecordPath, { method: 'GET' })
    expect(res.status).toBe(400)
  })

  it('verifies a commit', async () => {
    const path = xrpcPath('com.atproto.space.getLatestCommit', {
      space: SPACE,
      repo: AUTHOR,
    })
    const res = await newAgent().fetchHandler(path, { method: 'GET' })
    expect(res.status).toBe(200)

    mode = 'bad-mac'
    await expect(
      newAgent().fetchHandler(path, { method: 'GET' }),
    ).rejects.toThrow(SpaceMacError)

    mode = 'no-mac'
    await expect(
      newAgent().fetchHandler(path, { method: 'GET' }),
    ).rejects.toThrow(SpaceMacError)
  })

  describe('an oplog page', () => {
    const path = xrpcPath('com.atproto.space.listRepoOps', {
      space: SPACE,
      repo: AUTHOR,
    })

    it('has its commit verified when it reaches the head', async () => {
      const res = await newAgent().fetchHandler(path, { method: 'GET' })
      expect(res.status).toBe(200)

      mode = 'no-mac'
      await expect(
        newAgent().fetchHandler(path, { method: 'GET' }),
      ).rejects.toThrow(SpaceMacError)
    })

    it('carries no commit to verify short of the head', async () => {
      mode = 'no-commit'
      const res = await newAgent().fetchHandler(path, { method: 'GET' })
      expect(res.status).toBe(200)
    })
  })

  it('rejects a record other than the one requested', async () => {
    mode = 'other-record'
    await expect(
      newAgent().fetchHandler(getRecordPath, { method: 'GET' }),
    ).rejects.toThrow(SpaceRepoVerificationError)
  })

  it('refuses a repo host with no KEM key', async () => {
    const agent = new SpaceCredentialAgent({
      credential,
      keypair: syncerKey,
      resolveDidDoc: async (did) => ({
        ...(await resolveDidDoc(did)),
        verificationMethod: [],
      }),
      fetch,
    })
    await expect(
      agent.fetchHandler(getRecordPath, { method: 'GET' }),
    ).rejects.toThrow(SpaceKemError)
    expect(seen).toHaveLength(0)
  })

  it('fails closed on a MAC method it has no verifier for', async () => {
    // Stands in for a method added to the table without a verifier.
    const nsid = 'com.example.space.unverified'
    const table = MAC_TYPE_BY_METHOD as Record<string, MacType>
    table[nsid] = COMMIT_MAC_TYPE
    try {
      const path = xrpcPath(nsid, { space: SPACE, repo: AUTHOR })
      await expect(
        newAgent().fetchHandler(path, { method: 'GET' }),
      ).rejects.toThrow(SpaceMacError)
    } finally {
      delete table[nsid]
    }
  })

  it('requests no MAC from a method that returns none', async () => {
    const path = xrpcPath('com.atproto.space.listBlobs', {
      space: SPACE,
      repo: AUTHOR,
    })
    const res = await newAgent().fetchHandler(path, { method: 'GET' })
    expect(res.status).toBe(200)
    expect(seen[0].headers.has(WANT_MAC_HEADER)).toBe(false)
  })

  it('addresses a space-level request to the space authority', async () => {
    const path = xrpcPath('com.atproto.space.listRepos', { space: SPACE })
    await newAgent().fetchHandler(path, { method: 'GET' })
    expect(seen[0].headers.get('atproto-space-audience')).toBe(SPACE_DID)
  })

  it('refuses getRepo through fetchHandler', async () => {
    const path = xrpcPath('com.atproto.space.getRepo', {
      space: SPACE,
      repo: AUTHOR,
    })
    await expect(
      newAgent().fetchHandler(path, { method: 'GET' }),
    ).rejects.toThrow(/getRepo\(\)/)
  })

  it('streams a verified repo from getRepo()', async () => {
    const repo = await newAgent().getRepo({ space: SPACE, repo: AUTHOR })
    expect(repo.commit.rev).toBe(commit.rev)
    expect(await collect(repo.records)).toHaveLength(2)

    mode = 'bad-mac'
    await expect(
      newAgent().getRepo({ space: SPACE, repo: AUTHOR }),
    ).rejects.toThrow(SpaceMacError)
  })

  it('reports the host error from getRepo()', async () => {
    mode = 'error'
    await expect(
      newAgent().getRepo({ space: SPACE, repo: AUTHOR }),
    ).rejects.toMatchObject({
      name: 'SpaceResponseError',
      status: 400,
      code: 'RepoNotFound',
      message: 'no repo',
    })
  })

  it('uses the same MAC types as the repo host', () => {
    expect(MAC_TYPE_BY_METHOD).toEqual({
      'com.atproto.space.getLatestCommit': COMMIT_MAC_TYPE,
      'com.atproto.space.getRepo': COMMIT_MAC_TYPE,
      'com.atproto.space.listRepoOps': COMMIT_MAC_TYPE,
      'com.atproto.space.getRecord': RECORD_MAC_TYPE,
    })
  })
})
