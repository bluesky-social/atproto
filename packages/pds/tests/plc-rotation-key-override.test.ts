import assert from 'node:assert'
import { randomBytes } from 'node:crypto'
import * as ui8 from 'uint8arrays'
import { Secp256k1Keypair } from '@atproto/crypto'
import { TestPds, TestPlc } from '@atproto/dev-env'
import {
  DEVICE_ID_BYTES_LENGTH,
  DEVICE_ID_PREFIX,
} from '@atproto/oauth-provider/constants'
import type { DidString } from '@atproto/syntax'

describe('plcRotationKey override', () => {
  let plc: TestPlc
  let pds: TestPds
  let secretsKey: Secp256k1Keypair
  let overrideKey: Secp256k1Keypair
  let alice: DidString

  beforeAll(async () => {
    secretsKey = await Secp256k1Keypair.create({ exportable: true })
    overrideKey = await Secp256k1Keypair.create()
    plc = await TestPlc.create({})
    pds = await TestPds.create(
      {
        didPlcUrl: plc.url,
        plcRotationKeyK256PrivateKeyHex: ui8.toString(
          await secretsKey.export(),
          'hex',
        ),
      },
      { plcRotationKey: overrideKey },
    )
  })

  afterAll(async () => {
    await pds?.close()
    await plc?.close()
  })

  const expectOverrideKey = async (did: string) => {
    const { rotationKeys } = await pds.ctx.plcClient.getDocumentData(did)
    expect(rotationKeys).toContain(overrideKey.did())
    expect(rotationKeys).not.toContain(secretsKey.did())
  }

  it('uses the override for XRPC account creation', async () => {
    const res = await pds.getAgent().com.atproto.server.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'hunter2',
    })
    alice = res.data.did as DidString
    await expectOverrideKey(alice)
  })

  it('uses the override for handle updates', async () => {
    // PLC rejects the update unless it is signed by one of the rotationKeys
    await pds.ctx.accountManager.updateHandle(alice, 'alice2.test')
    const data = await pds.ctx.plcClient.getDocumentData(alice)
    expect(data.alsoKnownAs).toEqual(['at://alice2.test'])
  })

  it('uses the override for OAuth account creation', async () => {
    const provider = pds.ctx.oauthProvider
    assert(provider)
    const account = await provider.accountManager.createAccount(
      `${DEVICE_ID_PREFIX}${randomBytes(DEVICE_ID_BYTES_LENGTH).toString('hex')}`,
      { ipAddress: '127.0.0.1', port: 0 },
      {
        locale: 'en',
        handle: 'bob.test',
        email: 'bob@test.com',
        password: 'hunter2hunter2',
      },
    )
    await expectOverrideKey(account.did)
  })
})
