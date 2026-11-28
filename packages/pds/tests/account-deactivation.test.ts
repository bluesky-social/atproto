import { afterAll, assert, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AtpAgent } from '@atproto/api'
import { P256Keypair, Secp256k1Keypair } from '@atproto/crypto'
import {
  type ImageRef,
  type SeedClient,
  TestNetworkNoAppView,
  assetPath,
  basicSeed,
} from '@atproto/dev-env'
import type { DidDocument } from '@atproto/identity'
import type { DidString } from '@atproto/syntax'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { com } from '../src/lexicons/index.js'

describe('account deactivation', () => {
  let network: TestNetworkNoAppView

  let sc: SeedClient
  let agent: AtpAgent

  let alice: DidString
  let aliceAvatar: ImageRef

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account_deactivation',
    })

    sc = network.getSeedClient()
    agent = network.pds.getAgent()

    await basicSeed(sc)
    alice = sc.dids.alice

    aliceAvatar = await sc.uploadFile(
      alice,
      assetPath('key-portrait-small.jpg'),
      'image/jpeg',
    )
    await sc.updateProfile(alice, {
      avatar: aliceAvatar.image,
    })

    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  it('deactivates account', async () => {
    await agent.com.atproto.server.deactivateAccount(
      {},
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )
  })

  it('returns deactivated status', async () => {
    const res = await agent.com.atproto.sync.getRepoStatus({ did: alice })
    expect(res.data).toEqual({
      did: alice,
      active: false,
      status: 'deactivated',
    })

    const adminRes = await agent.com.atproto.admin.getAccountInfo(
      {
        did: alice,
      },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(typeof adminRes.data.deactivatedAt).toBeDefined()
  })

  it('no longer serves repo data', async () => {
    await expect(
      agent.com.atproto.sync.getRepo({ did: alice }),
    ).rejects.toThrow(/Repo has been deactivated/)
    await expect(
      agent.com.atproto.sync.getLatestCommit({ did: alice }),
    ).rejects.toThrow(/Repo has been deactivated/)
    await expect(
      agent.com.atproto.sync.listBlobs({ did: alice }),
    ).rejects.toThrow(/Repo has been deactivated/)
    const recordUri = sc.posts[alice][0].ref.uri
    await expect(
      agent.com.atproto.sync.getRecord({
        did: alice,
        collection: recordUri.collection,
        rkey: recordUri.rkey,
      }),
    ).rejects.toThrow(/Repo has been deactivated/)
    await expect(
      agent.com.atproto.repo.getRecord({
        repo: alice,
        collection: recordUri.collection,
        rkey: recordUri.rkey,
      }),
    ).rejects.toThrow()
    await expect(
      agent.com.atproto.repo.describeRepo({
        repo: alice,
      }),
    ).rejects.toThrow(/Repo has been deactivated/)

    await expect(
      agent.com.atproto.sync.getBlob({
        did: alice,
        cid: aliceAvatar.image.ref.toString(),
      }),
    ).rejects.toThrow(/Repo has been deactivated/)
    const listedRepos = await agent.com.atproto.sync.listRepos()
    const listedAlice = listedRepos.data.repos.find((r) => r.did === alice)
    expect(listedAlice?.active).toBe(false)
    expect(listedAlice?.status).toBe('deactivated')
  })

  it('no longer resolves handle', async () => {
    await expect(
      agent.com.atproto.identity.resolveHandle({
        handle: sc.accounts[alice].handle,
      }),
    ).rejects.toThrow()
  })

  it('still allows login and returns status', async () => {
    const res = await agent.com.atproto.server.createSession({
      identifier: alice,
      password: sc.accounts[alice].password,
    })
    expect(res.data.status).toEqual('deactivated')
  })

  it('returns status on getSession', async () => {
    const res = await agent.com.atproto.server.getSession(undefined, {
      headers: sc.getHeaders(alice),
    })
    expect(res.data.status).toEqual('deactivated')
  })

  it('does not allow writes', async () => {
    const createAttempt = agent.com.atproto.repo.createRecord(
      {
        repo: alice,
        collection: 'app.bsky.feed.post',
        record: {
          text: 'blah',
          createdAt: new Date().toISOString(),
        },
      },
      {
        encoding: 'application/json',
        headers: sc.getHeaders(alice),
      },
    )
    const uri = sc.posts[alice][0].ref.uri
    await expect(createAttempt).rejects.toThrow('Account is deactivated')

    const putAttempt = agent.com.atproto.repo.putRecord(
      {
        repo: alice,
        collection: uri.collection,
        rkey: uri.rkey,
        record: {
          text: 'blah',
          createdAt: new Date().toISOString(),
        },
      },
      {
        encoding: 'application/json',
        headers: sc.getHeaders(alice),
      },
    )
    await expect(putAttempt).rejects.toThrow('Account is deactivated')

    const deleteAttempt = agent.com.atproto.repo.deleteRecord(
      {
        repo: alice,
        collection: uri.collection,
        rkey: uri.rkey,
      },
      {
        encoding: 'application/json',
        headers: sc.getHeaders(alice),
      },
    )
    await expect(deleteAttempt).rejects.toThrow('Account is deactivated')
  })

  it('reactivates', async () => {
    await agent.com.atproto.server.activateAccount(undefined, {
      headers: sc.getHeaders(alice),
    })

    await agent.com.atproto.sync.getRepo({ did: alice })

    const statusRes = await agent.com.atproto.sync.getRepoStatus({ did: alice })
    expect(statusRes.data.active).toBe(true)
    expect(statusRes.data.status).toBeUndefined()

    const adminRes = await agent.com.atproto.admin.getAccountInfo(
      {
        did: alice,
      },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(adminRes.data.deactivatedAt).toBeUndefined()
  })
})

describe('account reactivation once the spaces migration is complete', () => {
  let network: TestNetworkNoAppView

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      pds: { spacesMigration: 'complete' },
    })
  })

  afterAll(async () => {
    await network?.close()
  })

  it.each(['missing', 'matching', 'mismatched', 'unsupported', 'malformed'])(
    'checks a did:web account with a %s KEM key when reactivating',
    async (keyState) => {
      const did: DidString = `did:web:${keyState}.example.com`
      const handle = `web-${keyState}.test`
      const originalKey = await Secp256k1Keypair.create()
      const doc: DidDocument = {
        id: did,
        alsoKnownAs: [`at://${handle}`],
        verificationMethod: [
          {
            id: '#atproto',
            type: 'Multikey',
            controller: did,
            publicKeyMultibase: originalKey.did().slice('did:key:'.length),
          },
        ],
        service: [
          {
            id: '#atproto_pds',
            type: 'AtprotoPersonalDataServer',
            serviceEndpoint: network.pds.ctx.cfg.service.publicUrl,
          },
        ],
      }
      const resolver = network.pds.ctx.idResolver.did
      const resolve = resolver.resolve.bind(resolver)
      using _resolveMock = vi
        .spyOn(resolver, 'resolve')
        .mockImplementation((requestedDid, ...args) =>
          requestedDid === did
            ? Promise.resolve(doc)
            : resolve(requestedDid, ...args),
        )
      const { headers } = await createServiceAuthHeaders({
        iss: did,
        aud: network.pds.ctx.cfg.service.did,
        lxm: com.atproto.server.createAccount.$lxm,
        keypair: originalKey,
      })
      const webAgent = network.pds.getAgent()
      await webAgent.com.atproto.server.createAccount(
        {
          did,
          handle,
          email: `${keyState}@example.com`,
          password: 'web-password',
        },
        { headers, encoding: 'application/json' },
      )

      const signingKey = await network.pds.ctx.actorStore.keypair(did)
      const kemKey = await network.pds.ctx.actorStore.kemKeypair(did)
      assert(kemKey)
      const verificationMethods: Record<string, string> = {
        atproto: signingKey.did(),
      }
      if (keyState !== 'missing') {
        verificationMethods.atproto_kem =
          keyState === 'mismatched'
            ? (await P256Keypair.create()).did()
            : kemKey.did()
      }
      doc.verificationMethod = Object.entries(verificationMethods).map(
        ([name, key]) => ({
          id: `#${name}`,
          type: 'Multikey',
          controller: did,
          publicKeyMultibase: key.slice('did:key:'.length),
        }),
      )
      const method = doc.verificationMethod?.find(
        ({ id }) => id === '#atproto_kem',
      )
      if (method && keyState === 'unsupported') method.type = 'UnsupportedKey'
      if (method && keyState === 'malformed') method.publicKeyMultibase = ''

      await webAgent.login({ identifier: did, password: 'web-password' })
      const valid = keyState === 'missing' || keyState === 'matching'
      const before = await webAgent.com.atproto.server.checkAccountStatus()
      expect(before.data).toMatchObject({ activated: false, validDid: valid })
      if (valid) {
        await webAgent.com.atproto.server.activateAccount()
        await webAgent.com.atproto.server.deactivateAccount({})
        await webAgent.com.atproto.server.activateAccount()
      } else {
        await expect(
          webAgent.com.atproto.server.activateAccount(),
        ).rejects.toThrow('does not match expected KEM key')
      }
      const after = await webAgent.com.atproto.server.checkAccountStatus()
      expect(after.data).toMatchObject({ activated: valid, validDid: valid })
    },
  )
})
