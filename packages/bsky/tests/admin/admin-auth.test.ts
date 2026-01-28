import assert from 'node:assert'
import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'
import { SeedClient, TestNetwork, usersSeed } from '@atproto/dev-env'
import { $Typed } from '@atproto/lex'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { com } from '../../src/lexicons/index.js'

describe('admin auth', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let repoSubject: $Typed<com.atproto.admin.defs.RepoRef>

  const modServiceDid = 'did:example:mod'
  const altModDid = 'did:example:alt'
  let modServiceKey: Secp256k1Keypair
  let bskyDid: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_admin_auth',
      bsky: {
        modServiceDid,
      },
    })

    bskyDid = network.bsky.ctx.cfg.serverDid

    modServiceKey = await Secp256k1Keypair.create()
    const origResolve = network.bsky.dataplane.idResolver.did.resolve
    network.bsky.dataplane.idResolver.did.resolve = async function (
      did: string,
      forceRefresh?: boolean,
    ) {
      if (did === modServiceDid || did === altModDid) {
        return {
          '@context': [
            'https://www.w3.org/ns/did/v1',
            'https://w3id.org/security/multikey/v1',
            'https://w3id.org/security/suites/secp256k1-2019/v1',
          ],
          id: did,
          verificationMethod: [
            {
              id: `${did}#atproto`,
              type: 'Multikey',
              controller: did,
              publicKeyMultibase: modServiceKey.did().replace('did:key:', ''),
            },
          ],
        }
      }
      return origResolve.call(this, did, forceRefresh)
    }

    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await usersSeed(sc)
    await network.processAll()
    repoSubject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.bob,
    }
  })

  afterAll(async () => {
    await network.close()
  })

  it('allows service auth requests from the configured appview did', async () => {
    const updateHeaders = await createServiceAuthHeaders({
      iss: modServiceDid,
      aud: bskyDid,
      lxm: com.atproto.admin.updateSubjectStatus.$lxm,
      keypair: modServiceKey,
    })
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: repoSubject,
        takedown: { applied: true, ref: 'test-repo' },
      },
      {
        ...updateHeaders,
        encoding: 'application/json',
      },
    )

    const getHeaders = await createServiceAuthHeaders({
      iss: modServiceDid,
      aud: bskyDid,
      lxm: com.atproto.admin.getSubjectStatus.$lxm,
      keypair: modServiceKey,
    })
    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      { did: repoSubject.did },
      getHeaders,
    )
    assert(com.atproto.admin.defs.repoRef.$matches(res.data.subject))
    expect(res.data.subject.did).toBe(repoSubject.did)
    expect(res.data.takedown?.applied).toBe(true)
  })

  it('does not allow requests from another did', async () => {
    const headers = await createServiceAuthHeaders({
      iss: altModDid,
      aud: bskyDid,
      lxm: com.atproto.admin.updateSubjectStatus.$lxm,
      keypair: modServiceKey,
    })
    const attempt = agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: repoSubject,
        takedown: { applied: true, ref: 'test-repo' },
      },
      {
        ...headers,
        encoding: 'application/json',
      },
    )
    await expect(attempt).rejects.toThrow('Untrusted issuer')
  })

  it('does not allow requests from an authenticated user', async () => {
    const aliceKey = await network.pds.ctx.actorStore.keypair(sc.dids.alice)
    const headers = await createServiceAuthHeaders({
      iss: sc.dids.alice,
      aud: bskyDid,
      lxm: com.atproto.admin.updateSubjectStatus.$lxm,
      keypair: aliceKey,
    })
    const attempt = agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: repoSubject,
        takedown: { applied: true, ref: 'test-repo' },
      },
      {
        ...headers,
        encoding: 'application/json',
      },
    )
    await expect(attempt).rejects.toThrow('Untrusted issuer')
  })

  it('does not allow requests with a bad signature', async () => {
    const badKey = await Secp256k1Keypair.create()
    const headers = await createServiceAuthHeaders({
      iss: modServiceDid,
      aud: bskyDid,
      lxm: com.atproto.admin.updateSubjectStatus.$lxm,
      keypair: badKey,
    })
    const attempt = agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: repoSubject,
        takedown: { applied: true, ref: 'test-repo' },
      },
      {
        ...headers,
        encoding: 'application/json',
      },
    )
    await expect(attempt).rejects.toThrow(
      'jwt signature does not match jwt issuer',
    )
  })

  it('does not allow requests with a bad aud', async () => {
    // repo subject is bob, so we set alice as the audience
    const headers = await createServiceAuthHeaders({
      iss: modServiceDid,
      aud: sc.dids.alice,
      lxm: com.atproto.admin.updateSubjectStatus.$lxm,
      keypair: modServiceKey,
    })
    const attempt = agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: repoSubject,
        takedown: { applied: true, ref: 'test-repo' },
      },
      {
        ...headers,
        encoding: 'application/json',
      },
    )
    await expect(attempt).rejects.toThrow(
      'jwt audience does not match service did',
    )
  })
})
