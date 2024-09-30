import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'
import { SeedClient, TestNetworkNoAppView, basicSeed } from '@atproto/dev-env'
import * as plc from '@did-plc/lib'
import assert from 'assert'
import { once } from 'events'
import Mail from 'nodemailer/lib/mailer'
import { EventEmitter } from 'stream'
import { AppContext } from '../src'
import { check } from '@atproto/common'

describe('plc operations', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let agent: AtpAgent
  let sc: SeedClient

  const mailCatcher = new EventEmitter()
  let _origSendMail

  let alice: string

  let sampleKey: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'plc_operations',
    })
    // @ts-expect-error Error due to circular dependency with the dev-env package
    ctx = network.pds.ctx
    const mailer = ctx.mailer

    sc = network.getSeedClient()
    agent = network.pds.getClient()

    await basicSeed(sc)
    alice = sc.dids.alice
    await network.processAll()

    sampleKey = (await Secp256k1Keypair.create()).did()

    // Catch emails for use in tests
    _origSendMail = mailer.transporter.sendMail
    mailer.transporter.sendMail = async (opts) => {
      const result = await _origSendMail.call(mailer.transporter, opts)
      mailCatcher.emit('mail', opts)
      return result
    }
  })

  afterAll(async () => {
    await network.close()
  })

  const getMailFrom = async (promise): Promise<Mail.Options> => {
    const result = await Promise.all([once(mailCatcher, 'mail'), promise])
    return result[0][0]
  }

  const getTokenFromMail = (mail: Mail.Options) =>
    mail.html?.toString().match(/>([a-z0-9]{5}-[a-z0-9]{5})</i)?.[1]

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
        headers: sc.getHeaders(alice),
      },
    )
    await expect(attempt).rejects.toThrow(expectedErr)
  }

  it("prevents submitting an operation that removes the server's rotation key", async () => {
    await expectFailedOp(
      alice,
      { rotationKeys: [sampleKey] },
      "Rotation keys do not include server's rotation key",
    )
  })

  it('prevents submitting an operation that incorrectly sets the signing key', async () => {
    await expectFailedOp(
      alice,
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
      alice,
      {
        alsoKnownAs: ['at://new-alice.test'],
      },
      'Incorrect handle in alsoKnownAs',
    )
  })

  it('prevents submitting an operation that incorrectly sets the pds endpoint', async () => {
    await expectFailedOp(
      alice,
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
      alice,
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
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )
    await expect(attempt).rejects.toThrow(
      'email confirmation token required to sign PLC operations',
    )
  })

  let token: string

  it('requests a plc signature', async () => {
    const mail = await getMailFrom(
      agent.api.com.atproto.identity.requestPlcOperationSignature(undefined, {
        headers: sc.getHeaders(alice),
      }),
    )

    expect(mail.to).toEqual(sc.accounts[alice].email)
    expect(mail.html).toContain('PLC update requested')

    const gotToken = getTokenFromMail(mail)
    assert(gotToken)
    token = gotToken
  })

  it('does not sign a plc operation with a bad token', async () => {
    const attempt = agent.api.com.atproto.identity.signPlcOperation(
      {
        token: '123456',
        rotationKeys: [sampleKey],
      },
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
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
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )
    const currData = await ctx.plcClient.getDocumentData(alice)
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
        headers: sc.getHeaders(alice),
      },
    )
    const didData = await ctx.plcClient.getDocumentData(alice)
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
    expect(lastEvt.did).toBe(alice)
    expect(lastEvt.eventType).toBe('identity')
  })
})
