import * as ui8 from 'uint8arrays'
import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { Label } from '../src/lexicon/types/com/atproto/label/defs'
import { Secp256k1Keypair, verifySignature } from '@atproto/crypto'
import { cborEncode } from '@atproto/common'
import { ModerationService } from '../src/mod-service'

describe('ozone query labels', () => {
  let network: TestNetwork
  let agent: AtpAgent

  let labels: Label[]

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_query_labels',
    })

    agent = network.ozone.getClient()

    const toCreate = [
      {
        src: 'did:example:labeler',
        uri: 'did:example:blah',
        val: 'spam',
        neg: false,
        cts: new Date().toISOString(),
      },
      {
        src: 'did:example:labeler',
        uri: 'did:example:blah',
        val: 'impersonation',
        neg: false,
        cts: new Date().toISOString(),
      },
      {
        src: 'did:example:labeler',
        uri: 'at://did:example:blah/app.bsky.feed.post/1234abcde',
        val: 'spam',
        neg: false,
        cts: new Date().toISOString(),
      },
      {
        src: 'did:example:labeler',
        uri: 'at://did:example:blah/app.bsky.feed.post/1234abcfg',
        val: 'spam',
        neg: false,
        cts: new Date().toISOString(),
      },
      {
        src: 'did:example:labeler',
        uri: 'at://did:example:blah/app.bsky.actor.profile/self',
        val: 'spam',
        neg: false,
        cts: new Date().toISOString(),
      },
      {
        src: 'did:example:labeler',
        uri: 'did:example:thing',
        val: 'spam',
        neg: false,
        cts: new Date().toISOString(),
      },
    ]

    const modService = network.ozone.ctx.modService(network.ozone.ctx.db)
    labels = await modService.createLabels(toCreate)
  })

  afterAll(async () => {
    await network.close()
  })

  it('returns all labels', async () => {
    const res = await agent.api.com.atproto.label.queryLabels({
      uriPatterns: ['*'],
    })
    expect(res.data.labels).toEqual(labels)
  })

  it('returns all labels even when an additional pattern is supplied', async () => {
    const res = await agent.api.com.atproto.label.queryLabels({
      uriPatterns: ['*', 'did:example:blah'],
    })
    expect(res.data.labels).toEqual(labels)
  })

  it('returns all labels that match an exact uri pattern', async () => {
    const res = await agent.api.com.atproto.label.queryLabels({
      uriPatterns: ['did:example:blah'],
    })
    expect(res.data.labels).toEqual(labels.slice(0, 2))
  })

  it('returns all labels that match one of multiple exact uris', async () => {
    const res = await agent.api.com.atproto.label.queryLabels({
      uriPatterns: [
        'at://did:example:blah/app.bsky.feed.post/1234abcfg',
        'at://did:example:blah/app.bsky.actor.profile/self',
      ],
    })
    expect(res.data.labels).toEqual(labels.slice(3, 5))
  })

  it('returns all labels that match one of multiple uris, exact & glob', async () => {
    const res = await agent.api.com.atproto.label.queryLabels({
      uriPatterns: ['at://did:example:blah/app.bsky*', 'did:example:blah'],
    })
    expect(res.data.labels).toEqual(labels.slice(0, 5))
  })

  it('paginates', async () => {
    const res1 = await agent.api.com.atproto.label.queryLabels({
      uriPatterns: ['at://did:example:blah/app.bsky*', 'did:example:blah'],
      limit: 3,
    })
    const res2 = await agent.api.com.atproto.label.queryLabels({
      uriPatterns: ['at://did:example:blah/app.bsky*', 'did:example:blah'],
      limit: 3,
      cursor: res1.data.cursor,
    })

    expect([...res1.data.labels, ...res2.data.labels]).toEqual(
      labels.slice(0, 5),
    )
  })

  it('returns validly signed labels', async () => {
    const res = await agent.api.com.atproto.label.queryLabels({
      uriPatterns: ['*'],
    })
    const signingKey = network.ozone.ctx.signingKey.did()
    for (const label of res.data.labels) {
      const { sig, ...rest } = label
      if (!sig) {
        throw new Error('Missing signature')
      }
      const sigBytes = ui8.fromString(sig, 'base64')
      const encodedLabel = cborEncode(rest)
      const isValid = await verifySignature(signingKey, encodedLabel, sigBytes)
      expect(isValid).toBe(true)
    }
  })

  it('resigns labels if the signingKey changes', async () => {
    // mock changing the signing key for the service
    const ctx = network.ozone.ctx
    const origModServiceFn = ctx.modService

    const modSrvc = ctx.modService(ctx.db)
    const newSigningKey = await Secp256k1Keypair.create()
    ctx.devOverride({
      modService: ModerationService.creator(
        newSigningKey,
        modSrvc.backgroundQueue,
        modSrvc.eventPusher,
        modSrvc.appviewAgent,
        modSrvc.appviewAuth,
        modSrvc.serverDid,
      ),
    })

    const res = await agent.api.com.atproto.label.queryLabels({
      uriPatterns: ['*'],
    })
    for (const label of res.data.labels) {
      const { sig, ...rest } = label
      if (!sig) {
        throw new Error('Missing signature')
      }
      const sigBytes = ui8.fromString(sig, 'base64')
      const encodedLabel = cborEncode(rest)
      const isValid = await verifySignature(
        newSigningKey.did(),
        encodedLabel,
        sigBytes,
      )
      expect(isValid).toBe(true)
    }

    await network.ozone.processAll()

    const fromDb = await ctx.db.db.selectFrom('label').selectAll().execute()
    expect(fromDb.every((row) => row.signingKey === newSigningKey.did())).toBe(
      true,
    )

    ctx.devOverride({
      modService: origModServiceFn,
    })
  })
})
