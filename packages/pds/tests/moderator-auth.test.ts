import assert from 'node:assert'
import * as plc from '@did-plc/lib'
import { AtpAgent } from '@atproto/api'
import { Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { ids } from '../src/lexicon/lexicons'
import { RepoRef, isRepoRef } from '../src/lexicon/types/com/atproto/admin/defs'
import { $Typed } from '../src/lexicon/util'
import usersSeed from './seeds/users'

describe('moderator auth', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  let repoSubject: $Typed<RepoRef>

  let modServiceDid: string
  let altModDid: string
  let modServiceKey: Secp256k1Keypair
  let pdsDid: string

  const opAndDid = async (handle: string, key: Keypair) => {
    const op = await plc.signOperation(
      {
        type: 'plc_operation',
        alsoKnownAs: [handle],
        verificationMethods: {
          atproto: key.did(),
        },
        rotationKeys: [key.did()],
        services: {},
        prev: null,
      },
      key,
    )
    const did = await plc.didForCreateOp(op)
    return { op, did }
  }

  beforeAll(async () => {
    // kinda goofy but we need to know the dids before creating the testnet for the PDS's config
    modServiceKey = await Secp256k1Keypair.create()
    const modServiceInfo = await opAndDid('mod.test', modServiceKey)
    const altModInfo = await opAndDid('alt-mod.test', modServiceKey)
    modServiceDid = modServiceInfo.did
    altModDid = altModInfo.did

    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'pds_moderator_auth',
      pds: {
        modServiceDid: modServiceInfo.did,
        modServiceUrl: 'https://mod.invalid',
      },
    })

    pdsDid = network.pds.ctx.cfg.service.did

    const plcClient = network.plc.getClient()
    await plcClient.sendOperation(modServiceInfo.did, modServiceInfo.op)
    await plcClient.sendOperation(altModInfo.did, altModInfo.op)

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
    const updateHeaders = await createServiceAuthHeaders({
      iss: modServiceDid,
      aud: pdsDid,
      lxm: ids.ComAtprotoAdminUpdateSubjectStatus,
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
      aud: pdsDid,
      lxm: ids.ComAtprotoAdminGetSubjectStatus,
      keypair: modServiceKey,
    })
    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      {
        did: repoSubject.did,
      },
      getHeaders,
    )
    assert(isRepoRef(res.data.subject))
    expect(res.data.subject.did).toBe(repoSubject.did)
    expect(res.data.takedown?.applied).toBe(true)
  })

  it('does not allow requests from another did', async () => {
    const headers = await createServiceAuthHeaders({
      iss: altModDid,
      aud: pdsDid,
      lxm: ids.ComAtprotoAdminUpdateSubjectStatus,
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

  it('does not allow requests with a bad signature', async () => {
    const badKey = await Secp256k1Keypair.create()
    const headers = await createServiceAuthHeaders({
      iss: modServiceDid,
      aud: pdsDid,
      lxm: ids.ComAtprotoAdminUpdateSubjectStatus,
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
      lxm: ids.ComAtprotoAdminUpdateSubjectStatus,
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
