import assert from 'node:assert'
import * as plc from '@did-plc/lib'
import { jest } from '@jest/globals'
import type { AtpAgent } from '@atproto/api'
import { check } from '@atproto/common'
import { Secp256k1Keypair } from '@atproto/crypto'
import {
  type Account,
  type SeedClient,
  TestNetworkNoAppView,
  basicSeed,
} from '@atproto/dev-env'
import type { AppContext } from '../src/index.js'

describe('plc operations', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let agent: AtpAgent
  let sc: SeedClient

  let alice: Account

  let sampleKey: string
  let sendMailMock: jest.SpiedFunction<
    AppContext['mailer']['transporter']['sendMail']
  >

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'plc_operations',
    })
    ctx = network.pds.ctx

    sc = network.getSeedClient()
    agent = network.pds.getAgent()

    await basicSeed(sc)
    alice = sc.accounts[sc.dids.alice]
    await network.processAll()

    sampleKey = (await Secp256k1Keypair.create()).did()
    sendMailMock = jest
      .spyOn(ctx.mailer.transporter, 'sendMail')
      .mockImplementation(async () => {})
  })

  beforeEach(() => {
    // Catch-all: never actually send, but keep recording calls for assertions.
    sendMailMock.mockClear()
  })

  afterAll(async () => {
    await network?.close()
  })

  const signOp = async (did: string, op: Partial<plc.Operation>) => {
    const lastOp = await ctx.plcClient.getLastOp(did)
    if (check.is(lastOp, plc.def.tombstone)) {
      throw new Error('Did is tombstoned')
    }
    return plc.createUpdateOp(lastOp, ctx.plcRotationKey, (lastOp) => ({
      ...lastOp,
      rotationKeys: op.rotationKeys ?? lastOp.rotationKeys,
      alsoKnownAs: op.alsoKnownAs ?? lastOp.alsoKnownAs,
      verificationMethods: op.verificationMethods ?? lastOp.verificationMethods,
      services: op.services ?? lastOp.services,
    }))
  }

  const expectFailedOp = async (
    did: string,
    op: Partial<plc.Operation>,
    expectedErr?: string,
  ) => {
    const operation = await signOp(did, op)
    const attempt = agent.com.atproto.identity.submitPlcOperation(
      { operation },
      {
        encoding: 'application/json',
        headers: sc.getHeaders(alice.did),
      },
    )
    await expect(attempt).rejects.toThrow(expectedErr)
  }

  it("prevents submitting an operation that removes the server's rotation key", async () => {
    await expectFailedOp(
      alice.did,
      { rotationKeys: [sampleKey] },
      "Rotation keys do not include server's rotation key",
    )
  })

  it('prevents submitting an operation that incorrectly sets the signing key', async () => {
    await expectFailedOp(
      alice.did,
      {
        verificationMethods: {
          atproto: sampleKey,
        },
      },
      'Incorrect signing key',
    )
  })

  it('prevents submitting an operation that incorrectly sets the handle', async () => {
    await expectFailedOp(
      alice.did,
      {
        alsoKnownAs: ['at://new-alice.test'],
      },
      'Incorrect handle in alsoKnownAs',
    )
  })

  it('prevents submitting an operation that incorrectly sets the pds endpoint', async () => {
    await expectFailedOp(
      alice.did,
      {
        services: {
          atproto_pds: {
            type: 'AtprotoPersonalDataServer',
            endpoint: 'https://example.com',
          },
        },
      },
      'Incorrect endpoint on atproto_pds service',
    )
  })

  it('prevents submitting an operation that incorrectly sets the pds service type', async () => {
    await expectFailedOp(
      alice.did,
      {
        services: {
          atproto_pds: {
            type: 'NotAPersonalDataServer',
            endpoint: ctx.cfg.service.publicUrl,
          },
        },
      },
      'Incorrect type on atproto_pds service',
    )
  })

  it('does not allow signing plc operation without a token', async () => {
    const attempt = agent.com.atproto.identity.signPlcOperation(
      {
        rotationKeys: [sampleKey],
      },
      { encoding: 'application/json', headers: sc.getHeaders(alice.did) },
    )
    await expect(attempt).rejects.toThrow(
      'email confirmation token required to sign PLC operations',
    )
  })

  let token: string

  it('requests a plc signature', async () => {
    using sendPlcOperationMock = jest.spyOn(ctx.mailer, 'sendPlcOperation')

    await agent.api.com.atproto.identity.requestPlcOperationSignature(
      undefined,
      {
        headers: sc.getHeaders(alice.did),
      },
    )
    expect(sendPlcOperationMock).toHaveBeenCalledTimes(1)
    expect(sendMailMock).toHaveBeenCalledTimes(1)
    const [params] = sendPlcOperationMock.mock.lastCall!
    expect(params).toEqual({
      token: expect.any(String),
    })

    const [mail] = sendMailMock.mock.lastCall!
    expect(mail.to).toEqual(alice.email)
    expect(mail.subject).toBe('PLC Update Operation Requested')
    expect(mail.html).toContain('PLC update requested')

    token = params.token
  })

  it('does not sign a plc operation with a bad token', async () => {
    const attempt = agent.api.com.atproto.identity.signPlcOperation(
      {
        token: '123456',
        rotationKeys: [sampleKey],
      },
      { encoding: 'application/json', headers: sc.getHeaders(alice.did) },
    )
    await expect(attempt).rejects.toThrow('Token is invalid')
  })

  let operation: any

  it('signs a plc operation with a valid token', async () => {
    const res = await agent.api.com.atproto.identity.signPlcOperation(
      {
        token,
        rotationKeys: [sampleKey, ctx.plcRotationKey.did()],
      },
      { encoding: 'application/json', headers: sc.getHeaders(alice.did) },
    )
    const currData = await ctx.plcClient.getDocumentData(alice.did)
    expect(res.data.operation['alsoKnownAs']).toEqual(currData.alsoKnownAs)
    expect(res.data.operation['verificationMethods']).toEqual(
      currData.verificationMethods,
    )
    expect(res.data.operation['services']).toEqual(currData.services)
    expect(res.data.operation['rotationKeys']).toEqual([
      sampleKey,
      ctx.plcRotationKey.did(),
    ])
    operation = res.data.operation
  })

  it('submits a valid operation', async () => {
    await agent.com.atproto.identity.submitPlcOperation(
      { operation },
      {
        encoding: 'application/json',
        headers: sc.getHeaders(alice.did),
      },
    )
    const didData = await ctx.plcClient.getDocumentData(alice.did)
    expect(didData.rotationKeys).toEqual([sampleKey, ctx.plcRotationKey.did()])
  })

  it('emits an identity event after a valid operation', async () => {
    const lastEvt = await ctx.sequencer.db.db
      .selectFrom('repo_seq')
      .selectAll()
      .orderBy('repo_seq.seq', 'desc')
      .limit(1)
      .executeTakeFirst()
    assert(lastEvt)
    expect(lastEvt.did).toBe(alice.did)
    expect(lastEvt.eventType).toBe('identity')
  })
})
