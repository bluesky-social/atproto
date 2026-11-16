import { Secp256k1Keypair } from '@atproto/crypto'
import { TestPds, TestPlc } from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
import { rotateKeys } from '../src/scripts/rotate-keys.js'

describe('kem keys for new accounts', () => {
  let plc: TestPlc
  let pds: TestPds

  beforeAll(async () => {
    plc = await TestPlc.create({})
    pds = await TestPds.create({ didPlcUrl: plc.url })
  })

  afterAll(async () => {
    await pds?.close()
    await plc?.close()
  })

  const publishedKem = async (did: string) => {
    const { verificationMethods } = await pds.ctx.plcClient.getDocumentData(did)
    return verificationMethods.atproto_kem
  }

  const makeAccount = async (name: string) => {
    const res = await pds.getAgent().com.atproto.server.createAccount({
      email: `${name}@test.com`,
      handle: `${name}.test`,
      password: 'hunter2',
    })
    return res.data
  }

  it("publishes the kem key in a new account's genesis op", async () => {
    const { did } = await makeAccount('genesis')
    const kem = await pds.ctx.actorStore.kemKeypair(did as DidString)
    expect(kem).toBeDefined()
    expect(await publishedKem(did)).toBe(kem?.did())
    const log = await pds.ctx.plcClient.getOperationLog(did)
    expect(log).toHaveLength(1)
  })

  it('publishes the kem key for an OAuth sign-up', async () => {
    const store = (pds.ctx.oauthProvider as any).accountManager.store
    const account = await store.createAccount({
      locale: 'en',
      handle: 'oauthkem.test',
      email: 'oauthkem@test.com',
      password: 'hunter2hunter2',
    })
    const kem = await pds.ctx.actorStore.kemKeypair(account.did)
    expect(kem).toBeDefined()
    expect(await publishedKem(account.did)).toBe(kem?.did())
  })

  it('recommends the kem key in did credentials', async () => {
    const { did, accessJwt } = await makeAccount('recommend')
    const kem = await pds.ctx.actorStore.kemKeypair(did as DidString)
    const res = await pds
      .getAgent()
      .com.atproto.identity.getRecommendedDidCredentials(undefined, {
        headers: { authorization: `Bearer ${accessJwt}` },
      })
    expect(res.data.verificationMethods).toMatchObject({
      atproto: (await pds.ctx.actorStore.keypair(did as DidString)).did(),
      atproto_kem: kem?.did(),
    })
  })

  it('rotate-keys preserves the kem key', async () => {
    const { did } = await makeAccount('rotate')
    const kem = await pds.ctx.actorStore.kemKeypair(did as DidString)
    // Simulate a lost signing key: publish a different signing key.
    const stray = await Secp256k1Keypair.create()
    await pds.ctx.plcClient.updateAtprotoKey(
      did,
      pds.ctx.plcRotationKey,
      stray.did(),
    )
    const before = await pds.ctx.plcClient.getDocumentData(did)
    expect(before.verificationMethods.atproto).toBe(stray.did())

    await rotateKeys(
      {
        sequencer: pds.ctx.sequencer,
        actorStore: pds.ctx.actorStore,
        plcClient: pds.ctx.plcClient,
        plcRotationKey: pds.ctx.plcRotationKey,
      },
      [did],
    )

    const after = await pds.ctx.plcClient.getDocumentData(did)
    expect(after.verificationMethods.atproto).toBe(
      (await pds.ctx.actorStore.keypair(did as DidString)).did(),
    )
    expect(after.verificationMethods.atproto_kem).toBe(kem?.did())
  })
})
