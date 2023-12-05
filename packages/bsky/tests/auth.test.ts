import AtpAgent from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import usersSeed from './seeds/users'
import { createServiceJwt } from '@atproto/xrpc-server'
import { Keypair, Secp256k1Keypair } from '@atproto/crypto'

describe('auth', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_auth',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await usersSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('handles signing key change for service auth.', async () => {
    const issuer = sc.dids.alice
    const attemptWithKey = async (keypair: Keypair) => {
      const jwt = await createServiceJwt({
        iss: issuer,
        aud: network.bsky.ctx.cfg.serverDid,
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
})
