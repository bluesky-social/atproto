import assert from 'node:assert'
import * as ui8 from 'uint8arrays'
import AtpAgent from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'
import { TestPds, TestPlc, mockNetworkUtilities } from '@atproto/dev-env'

describe('multi-pds auth', () => {
  let plc: TestPlc
  let entryway: TestPds
  let entrywayAgent: AtpAgent
  let pds: TestPds
  let pdsAgent: AtpAgent

  beforeAll(async () => {
    const jwtSigningKey = await Secp256k1Keypair.create({ exportable: true })
    const jwtSigningPriv = ui8.toString(await jwtSigningKey.export(), 'hex')
    const plcRotationKey = await Secp256k1Keypair.create({ exportable: true })
    const plcRotationPriv = ui8.toString(await plcRotationKey.export(), 'hex')
    const recoveryKey = (await Secp256k1Keypair.create()).did()
    plc = await TestPlc.create({})
    entryway = await TestPds.create({
      dbPostgresUrl: process.env.DB_POSTGRES_URL,
      dbPostgresSchema: 'multi_pds_account_entryway',
      didPlcUrl: plc.url,
      recoveryDidKey: recoveryKey,
      jwtSigningKeyK256PrivateKeyHex: jwtSigningPriv,
      plcRotationKeyK256PrivateKeyHex: plcRotationPriv,
    })
    pds = await TestPds.create({
      dbPostgresUrl: process.env.DB_POSTGRES_URL,
      dbPostgresSchema: 'multi_pds_account_pds',
      didPlcUrl: plc.url,
      recoveryDidKey: recoveryKey,
      jwtSigningKeyK256PrivateKeyHex: jwtSigningPriv,
      plcRotationKeyK256PrivateKeyHex: plcRotationPriv,
    })
    await entryway.ctx.db.db
      .insertInto('pds')
      .values({
        did: pds.ctx.cfg.service.did,
        host: new URL(pds.ctx.cfg.service.publicUrl).host,
      })
      .execute()
    mockNetworkUtilities([entryway, pds])
    entrywayAgent = entryway.getClient()
    pdsAgent = pds.getClient()
  })

  afterAll(async () => {
    await plc.close()
    await entryway.close()
    await pds.close()
  })

  it('assigns user to a pds.', async () => {
    const {
      data: { did },
    } = await entrywayAgent.api.com.atproto.server.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'test123',
    })

    // @TODO move these steps into account creation process
    await entryway.ctx.services.repo(entryway.ctx.db).deleteRepo(did)
    await plc
      .getClient()
      .updatePds(did, pds.ctx.plcRotationKey, pds.ctx.cfg.service.publicUrl)
    await plc
      .getClient()
      .updateAtprotoKey(
        did,
        pds.ctx.plcRotationKey,
        pds.ctx.repoSigningKey.did(),
      )

    await pdsAgent.api.com.atproto.server.createAccount({
      did: did,
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'test123',
    })

    const entrywayAccount = await entryway.ctx.services
      .account(entryway.ctx.db)
      .getAccount(did)
    assert(entrywayAccount)

    expect(entrywayAccount.did).toBe(did)
    expect(entrywayAccount.pdsId).not.toBe(null)
    expect(entrywayAccount.pdsDid).toBe(pds.ctx.cfg.service.did)
    expect(entrywayAccount.root).toBe(null)

    const pdsAccount = await pds.ctx.services
      .account(pds.ctx.db)
      .getAccount(did)
    assert(pdsAccount)

    expect(pdsAccount.did).toBe(did)
    expect(pdsAccount.pdsId).toBe(null)
    expect(pdsAccount.pdsDid).toBe(null)
    expect(pdsAccount.root).not.toBe(null)
  })
})
