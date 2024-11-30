import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, usersSeed } from '@atproto/dev-env'
import { createServiceJwt } from '@atproto/xrpc-server'
import { Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { ids } from '../src/lexicon/lexicons'

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
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await usersSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  afterAll(async () => {
    await network.close()
  })

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
