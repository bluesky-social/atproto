import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type AtpAgent, ids } from '@atproto/api'
import { type Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { type SeedClient, TestNetwork, usersSeed } from '@atproto/dev-env'
import { createServiceJwt } from '@atproto/xrpc-server'

describe('auth', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_auth',
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await usersSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

  // @TODO invalidations do not originate from appview frontends: requires identity event on the repo stream.
  it.skip('handles signing key change for service auth.', async () => {
    const issuer = sc.dids.alice
    const attemptWithKey = async (keypair: Keypair) => {
      const jwt = await createServiceJwt({
        iss: issuer,
        aud: network.bsky.ctx.cfg.serverDid,
        lxm: ids.AppBskyActorGetProfile,
        keypair,
      })
      return agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.carol },
        { headers: { authorization: `Bearer ${jwt}` } },
      )
    }
    const origSigningKey = await network.pds.ctx.actorStore.keypair(issuer)
    const newSigningKey = await Secp256k1Keypair.create({ exportable: true })
    // confirm original signing key works
    await expect(attemptWithKey(origSigningKey)).resolves.toBeDefined()
    // confirm next signing key doesn't work yet
    await expect(attemptWithKey(newSigningKey)).rejects.toThrow(
      'jwt signature does not match jwt issuer',
    )
    // update to new signing key
    await network.plc
      .getClient()
      .updateAtprotoKey(
        issuer,
        network.pds.ctx.plcRotationKey,
        newSigningKey.did(),
      )
    // old signing key still works due to did doc cache
    await expect(attemptWithKey(origSigningKey)).resolves.toBeDefined()
    // new signing key works
    await expect(attemptWithKey(newSigningKey)).resolves.toBeDefined()
    // old signing key no longer works after cache is updated
    await expect(attemptWithKey(origSigningKey)).rejects.toThrow(
      'jwt signature does not match jwt issuer',
    )
  })

  it('uses the DID as the caller of a did#atproto_labeler service JWT', async () => {
    const labeler = network.bsky.ctx.cfg.modServiceDid
    await sc.follow(sc.dids.bob, labeler)
    await network.processAll()

    const jwt = await createServiceJwt({
      iss: `${labeler}#atproto_labeler`,
      aud: network.bsky.ctx.cfg.serverDid,
      lxm: ids.AppBskyNotificationGetUnreadCount,
      keypair: network.ozone.ctx.signingKey,
    })
    const { data } = await agent.api.app.bsky.notification.getUnreadCount(
      {},
      { headers: { authorization: `Bearer ${jwt}` } },
    )
    expect(data.count).toBe(1)
  })

  it('rejects a did#atproto_labeler service JWT without lxm', async () => {
    const labeler = network.bsky.ctx.cfg.modServiceDid
    const jwt = await createServiceJwt({
      iss: `${labeler}#atproto_labeler`,
      aud: network.bsky.ctx.cfg.serverDid,
      lxm: null,
      keypair: network.ozone.ctx.signingKey,
    })
    await expect(
      agent.api.app.bsky.notification.getUnreadCount(
        {},
        { headers: { authorization: `Bearer ${jwt}` } },
      ),
    ).rejects.toThrow('missing jwt lexicon method ("lxm")')
  })

  it('uses the DID as the caller of a did#atproto service JWT', async () => {
    await sc.follow(sc.dids.alice, sc.dids.bob)
    await network.processAll()

    const jwt = await createServiceJwt({
      iss: `${alice}#atproto`,
      aud: network.bsky.ctx.cfg.serverDid,
      lxm: ids.AppBskyActorGetProfile,
      keypair: await network.pds.ctx.actorStore.keypair(alice),
    })
    const { data } = await agent.api.app.bsky.actor.getProfile(
      { actor: bob },
      { headers: { authorization: `Bearer ${jwt}` } },
    )
    expect(data.viewer?.following).toBeDefined()
  })

  it('rejects a service JWT with an unsupported service id', async () => {
    const jwt = await createServiceJwt({
      iss: `${alice}#atproto_other`,
      aud: network.bsky.ctx.cfg.serverDid,
      lxm: ids.AppBskyActorGetProfile,
      keypair: await network.pds.ctx.actorStore.keypair(alice),
    })
    await expect(
      agent.api.app.bsky.actor.getProfile(
        { actor: bob },
        { headers: { authorization: `Bearer ${jwt}` } },
      ),
    ).rejects.toThrow('unsupported jwt iss service id: #atproto_other')
  })

  it('throws if the user key is incorrect', async () => {
    const bobKeypair = await network.pds.ctx.actorStore.keypair(bob)

    const jwt = await createServiceJwt({
      iss: alice,
      aud: network.bsky.ctx.cfg.serverDid,
      lxm: ids.AppBskyFeedGetTimeline,
      keypair: bobKeypair,
    })

    await expect(
      agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.carol },
        {
          headers: { authorization: `Bearer ${jwt}` },
        },
      ),
    ).rejects.toThrow()
  })
})
