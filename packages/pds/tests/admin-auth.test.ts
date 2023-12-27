import { TestNetworkNoAppView, SeedClient } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import usersSeed from './seeds/users'
import { RepoRef } from '../src/lexicon/types/com/atproto/admin/defs'

describe('admin auth', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  let repoSubject: RepoRef

  const modServiceDid = 'did:example:mod'
  const altModDid = 'did:example:alt'
  let modServiceKey: Secp256k1Keypair
  let pdsDid: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'pds_admin_auth',
      pds: {
        modServiceDid,
      },
    })

    pdsDid = network.pds.ctx.cfg.service.did

    modServiceKey = await Secp256k1Keypair.create()
    const origResolve = network.pds.ctx.idResolver.did.resolveAtprotoKey
    network.pds.ctx.idResolver.did.resolveAtprotoKey = async (
      did: string,
      forceRefresh?: boolean,
    ) => {
      if (did === modServiceDid || did === altModDid) {
        return modServiceKey.did()
      }
      return origResolve(did, forceRefresh)
    }

    agent = network.pds.getClient()
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
    const headers = await createServiceAuthHeaders({
      iss: modServiceDid,
      aud: pdsDid,
      keypair: modServiceKey,
    })
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: repoSubject,
        takedown: { applied: true, ref: 'test-repo' },
      },
      {
        ...headers,
        encoding: 'application/json',
      },
    )

    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      {
        did: repoSubject.did,
      },
      headers,
    )
    expect(res.data.subject.did).toBe(repoSubject.did)
    expect(res.data.takedown?.applied).toBe(true)
  })

  it('does not allow requests from another did', async () => {
    const headers = await createServiceAuthHeaders({
      iss: altModDid,
      aud: pdsDid,
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
    await expect(attempt).rejects.toThrow('Untrusted issuer for admin actions')
  })

  it('does not allow requests with a bad signature', async () => {
    const badKey = await Secp256k1Keypair.create()
    const headers = await createServiceAuthHeaders({
      iss: modServiceDid,
      aud: pdsDid,
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
