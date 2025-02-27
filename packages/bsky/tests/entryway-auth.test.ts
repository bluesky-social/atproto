import assert from 'node:assert'
import * as nodeCrypto from 'node:crypto'
import * as jose from 'jose'
import KeyEncoder from 'key-encoder'
import * as ui8 from 'uint8arrays'
import { AtUri, AtpAgent } from '@atproto/api'
import { MINUTE } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'

const keyEncoder = new KeyEncoder('secp256k1')

const derivePrivKey = async (
  keypair: crypto.ExportableKeypair,
): Promise<nodeCrypto.KeyObject> => {
  const privKeyRaw = await keypair.export()
  const privKeyEncoded = keyEncoder.encodePrivate(
    ui8.toString(privKeyRaw, 'hex'),
    'raw',
    'pem',
  )
  return nodeCrypto.createPrivateKey(privKeyEncoded)
}

// @NOTE temporary measure, see note on entrywaySession in bsky/src/auth-verifier.ts
describe('entryway auth', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let alice: string
  let jwtPrivKey: nodeCrypto.KeyObject

  beforeAll(async () => {
    const keypair = await crypto.Secp256k1Keypair.create({ exportable: true })
    jwtPrivKey = await derivePrivKey(keypair)
    const entrywayJwtPublicKeyHex = ui8.toString(
      keypair.publicKeyBytes(),
      'hex',
    )

    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_entryway_auth',
      bsky: {
        entrywayJwtPublicKeyHex,
      },
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
  })

  it('works', async () => {
    const signer = new jose.SignJWT({ scope: 'com.atproto.access' })
      .setSubject(alice)
      .setIssuedAt()
      .setExpirationTime('60mins')
      .setAudience('did:web:fake.server.bsky.network')
      .setProtectedHeader({
        typ: 'at+jwt', // https://www.rfc-editor.org/rfc/rfc9068.html
        alg: 'ES256K',
      })
    const token = await signer.sign(jwtPrivKey)
    const res = await agent.app.bsky.actor.getProfile(
      { actor: sc.dids.bob },
      { headers: { authorization: `Bearer ${token}` } },
    )
    expect(res.data.did).toEqual(sc.dids.bob)
    // ensure this request is personalized for alice
    const followingUri = res.data.viewer?.following
    assert(followingUri)
    const parsed = new AtUri(followingUri)
    expect(parsed.hostname).toEqual(alice)
  })

  it('does not work on bad scopes', async () => {
    const signer = new jose.SignJWT({ scope: 'com.atproto.refresh' })
      .setSubject(alice)
      .setIssuedAt()
      .setExpirationTime('60mins')
      .setAudience('did:web:fake.server.bsky.network')
      .setProtectedHeader({
        typ: 'at+jwt', // https://www.rfc-editor.org/rfc/rfc9068.html
        alg: 'ES256K',
      })
    const token = await signer.sign(jwtPrivKey)
    const attempt = agent.app.bsky.actor.getProfile(
      { actor: sc.dids.bob },
      { headers: { authorization: `Bearer ${token}` } },
    )
    await expect(attempt).rejects.toThrow('Bad token scope')
  })

  it('does not work on expired tokens', async () => {
    const time = Math.floor((Date.now() - 5 * MINUTE) / 1000)
    const signer = new jose.SignJWT({ scope: 'com.atproto.access' })
      .setSubject(alice)
      .setIssuedAt()
      .setExpirationTime(time)
      .setAudience('did:web:fake.server.bsky.network')
      .setProtectedHeader({
        typ: 'at+jwt', // https://www.rfc-editor.org/rfc/rfc9068.html
        alg: 'ES256K',
      })
    const token = await signer.sign(jwtPrivKey)
    const attempt = agent.app.bsky.actor.getProfile(
      { actor: sc.dids.bob },
      { headers: { authorization: `Bearer ${token}` } },
    )
    await expect(attempt).rejects.toThrow('Token has expired')
  })

  it('does not work on bad auds', async () => {
    const signer = new jose.SignJWT({ scope: 'com.atproto.access' })
      .setSubject(alice)
      .setIssuedAt()
      .setExpirationTime('60mins')
      .setAudience('did:web:my.personal.pds.com')
      .setProtectedHeader({
        typ: 'at+jwt', // https://www.rfc-editor.org/rfc/rfc9068.html
        alg: 'ES256K',
      })
    const token = await signer.sign(jwtPrivKey)
    const attempt = agent.app.bsky.actor.getProfile(
      { actor: sc.dids.bob },
      { headers: { authorization: `Bearer ${token}` } },
    )
    await expect(attempt).rejects.toThrow('Bad token aud')
  })

  it('does not work with bad signatures', async () => {
    const fakeKey = await crypto.Secp256k1Keypair.create({ exportable: true })
    const fakeJwtKey = await derivePrivKey(fakeKey)
    const signer = new jose.SignJWT({ scope: 'com.atproto.access' })
      .setSubject(alice)
      .setIssuedAt()
      .setExpirationTime('60mins')
      .setAudience('did:web:my.personal.pds.com')
      .setProtectedHeader({
        typ: 'at+jwt', // https://www.rfc-editor.org/rfc/rfc9068.html
        alg: 'ES256K',
      })
    const token = await signer.sign(fakeJwtKey)
    const attempt = agent.app.bsky.actor.getProfile(
      { actor: sc.dids.bob },
      { headers: { authorization: `Bearer ${token}` } },
    )
    await expect(attempt).rejects.toThrow('Token could not be verified')
  })

  it('does not work on flexible aud routes', async () => {
    const signer = new jose.SignJWT({ scope: 'com.atproto.access' })
      .setSubject(alice)
      .setIssuedAt()
      .setExpirationTime('60mins')
      .setAudience('did:web:fake.server.bsky.network')
      .setProtectedHeader({
        typ: 'at+jwt', // https://www.rfc-editor.org/rfc/rfc9068.html
        alg: 'ES256K',
      })
    const token = await signer.sign(jwtPrivKey)
    const feedUri = AtUri.make(alice, 'app.bsky.feed.generator', 'fake-feed')
    const attempt = agent.app.bsky.feed.getFeed(
      { feed: feedUri.toString() },
      { headers: { authorization: `Bearer ${token}` } },
    )
    await expect(attempt).rejects.toThrow('Malformed token')
  })
})
