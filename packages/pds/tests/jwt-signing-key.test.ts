import { KeyObject } from 'node:crypto'
import getPort from 'get-port'
import * as jose from 'jose'
import * as ui8 from 'uint8arrays'
import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'
import { TestPds, TestPlc, mockNetworkUtilities } from '@atproto/dev-env'
import { createPublicKeyObject } from '../dist/auth-verifier'

const getPublicHex = (key: Secp256k1Keypair) => {
  return key.publicKeyStr('hex')
}

const getPrivateHex = async (key: Secp256k1Keypair) => {
  return ui8.toString(await key.export(), 'hex')
}

describe('jwt-signing-key asymmetrical keys', () => {
  const serviceDid = 'did:example:pds'
  let plc: TestPlc
  let pds: TestPds
  let jwtPublicKey: KeyObject
  let pdsAgent: AtpAgent

  beforeAll(async () => {
    const jwtSigningKey = await Secp256k1Keypair.create({ exportable: true })
    const plcRotationKey = await Secp256k1Keypair.create({ exportable: true })
    const port = await getPort()

    jwtPublicKey = createPublicKeyObject(getPublicHex(jwtSigningKey))

    plc = await TestPlc.create({})
    pds = await TestPds.create({
      port: port,
      jwtSecret: undefined,
      jwtSigningKeyK256PrivateKeyHex: await getPrivateHex(jwtSigningKey),
      plcRotationKeyK256PrivateKeyHex: await getPrivateHex(plcRotationKey),
      adminPassword: 'admin-pass',
      didPlcUrl: plc.url,
      serviceDid,
      inviteRequired: false,
    })

    mockNetworkUtilities(pds)

    pdsAgent = pds.getClient()
  })

  afterAll(async () => {
    await plc.close()
    await pds.close()
  })

  it('creates account with a valid accessToken using asymmetrical JWT key', async () => {
    const res = await pdsAgent.com.atproto.server.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'test123',
    })
    const alice = res.data.did
    const accessToken = res.data.accessJwt

    const account = await pds.ctx.accountManager.getAccount(alice)
    expect(account).not.toBeNull()
    expect(account?.did).toEqual(alice)
    expect(account?.handle).toEqual('alice.test')

    const validateJwt = async (jwt) => {
      return await jose.jwtVerify(jwt, jwtPublicKey, {
        typ: undefined,
      })
    }

    expect(validateJwt(accessToken.replace('a', 'b'))).rejects.toThrow()

    expect(validateJwt(accessToken)).resolves.toMatchObject({
      protectedHeader: { typ: 'at+jwt', alg: 'ES256K' },
    })

    expect(validateJwt(accessToken)).resolves.toHaveProperty(
      'payload.scope',
      'com.atproto.access',
    )

    expect(validateJwt(accessToken)).resolves.toHaveProperty(
      'payload.aud',
      serviceDid,
    )

    expect(validateJwt(accessToken)).resolves.toHaveProperty(
      'payload.sub',
      alice,
    )
  })
})
