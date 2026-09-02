import {
  type AtpAgent,
  type ComAtprotoLabelDefs,
  ComAtprotoLabelSubscribeLabels,
  ids,
  lexicons,
} from '@atproto/api'
import { cborEncode } from '@atproto/common'
import { Secp256k1Keypair, verifySignature } from '@atproto/crypto'
import { EXAMPLE_LABELER, TestNetwork } from '@atproto/dev-env'
import { currentDatetimeString } from '@atproto/lex'
import type { AtUriString, DidString } from '@atproto/lex'
import { Subscription } from '@atproto/xrpc-server'
import { ModerationService } from '../src/mod-service/index.js'
import { getSigningKeyId } from '../src/util.js'

describe('ozone query labels', () => {
  let network: TestNetwork
  let agent: AtpAgent

  let labels: ComAtprotoLabelDefs.Label[]

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_query_labels',
    })

    agent = network.ozone.getAgent()

    const toCreate = [
      {
        src: EXAMPLE_LABELER as DidString,
        uri: 'did:example:blah' as DidString,
        val: 'spam',
        cts: currentDatetimeString(),
      },
      {
        src: EXAMPLE_LABELER as DidString,
        uri: 'did:example:blah' as DidString,
        val: 'impersonation',
        cts: currentDatetimeString(),
      },
      {
        src: EXAMPLE_LABELER as DidString,
        uri: 'at://did:example:blah/app.bsky.feed.post/1234abcde' as AtUriString,
        val: 'spam',
        cts: currentDatetimeString(),
      },
      {
        src: EXAMPLE_LABELER as DidString,
        uri: 'at://did:example:blah/app.bsky.feed.post/1234abcfg' as AtUriString,
        val: 'spam',
        cts: currentDatetimeString(),
      },
      {
        src: EXAMPLE_LABELER as DidString,
        uri: 'at://did:example:blah/app.bsky.actor.profile/self' as AtUriString,
        val: 'spam',
        cts: currentDatetimeString(),
      },
      {
        src: EXAMPLE_LABELER as DidString,
        uri: 'did:example:thing' as DidString,
        val: 'spam',
        cts: currentDatetimeString(),
      },
    ]

    const modService = network.ozone.ctx.modService(network.ozone.ctx.db)
    labels = await modService.createLabels(toCreate)
  })

  afterAll(async () => {
    await network?.close()
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
      const encodedLabel = cborEncode(rest)
      const isValid = await verifySignature(signingKey, encodedLabel, sig)
      expect(isValid).toBe(true)
    }
  })

  it('resigns labels if the signingKey changes', async () => {
    // mock changing the signing key for the service
    const ctx = network.ozone.ctx
    const origModServiceFn = ctx.modService

    const modSrvc = ctx.modService(ctx.db)
    const newSigningKey = await Secp256k1Keypair.create()
    const newSigningKeyId = await getSigningKeyId(ctx.db, newSigningKey.did())
    ctx.devOverride({
      // @ts-ignore
      modService: ModerationService.creator(
        newSigningKey,
        newSigningKeyId,
        ctx.cfg,
        // @ts-ignore
        modSrvc.backgroundQueue,
        ctx.idResolver,
        // @ts-ignore
        modSrvc.eventPusher,
        modSrvc.appviewClient,
        ctx.serviceAuthHeaders,
        ctx.strikeService,
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
      const encodedLabel = cborEncode(rest)
      const isValid = await verifySignature(
        newSigningKey.did(),
        encodedLabel,
        sig,
      )
      expect(isValid).toBe(true)
    }

    await network.ozone.processAll()

    const fromDb = await ctx.db.db.selectFrom('label').selectAll().execute()
    expect(fromDb.every((row) => row.signingKeyId === newSigningKeyId)).toBe(
      true,
    )

    ctx.devOverride({
      modService: origModServiceFn,
    })
  })

  describe('subscribeLabels', () => {
    it('streams all labels from initial cursor.', async () => {
      const ac = new AbortController()
      // A sentinel rather than DisconnectError: aborting a subscription now
      // rejects the iterator with whatever reason it was given, so the test needs
      // its own marker to tell a deliberate stop from a real failure.
      // DisconnectError means nothing to a client — it's how a *server* route ends
      // a stream it serves.
      const doneReason = new Error('caught up with the label stream')
      let doneTimer: NodeJS.Timeout
      const resetDoneTimer = () => {
        clearTimeout(doneTimer)
        doneTimer = setTimeout(() => ac.abort(doneReason), 100)
      }
      const sub = new Subscription({
        signal: ac.signal,
        service: agent.service.origin.replace('http://', 'ws://'),
        method: ids.ComAtprotoLabelSubscribeLabels,
        getParams() {
          return { cursor: 0 }
        },
        validate(obj) {
          return lexicons.assertValidXrpcMessage<ComAtprotoLabelSubscribeLabels.Labels>(
            ids.ComAtprotoLabelSubscribeLabels,
            obj,
          )
        },
      })
      const streamedLabels: ComAtprotoLabelDefs.Label[] = []
      try {
        for await (const message of sub) {
          resetDoneTimer()
          if (ComAtprotoLabelSubscribeLabels.isLabels(message)) {
            for (const label of message.labels) {
              // sigs are currently parsed as a Buffer which is a Uint8Array under the hood, but fails our equality test so we cast to Uint8Array
              streamedLabels.push({
                ...label,
                sig: label.sig ? new Uint8Array(label.sig) : undefined,
              })
            }
          }
        }
      } catch (err) {
        // Our own timer-driven stop is the expected way out; anything else is a
        // genuine failure and must not be swallowed.
        if (err !== doneReason) throw err
      }
      expect(streamedLabels).toEqual(labels)
    })
  })
})
