import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { DisconnectError, Subscription } from '@atproto/xrpc-server'
import { ids, lexicons } from '../src/lexicon/lexicons'
import { Label } from '../src/lexicon/types/com/atproto/label/defs'
import {
  OutputSchema as LabelMessage,
  isLabels,
} from '../src/lexicon/types/com/atproto/label/subscribeLabels'

describe('ozone query labels', () => {
  let network: TestNetwork
  let agent: AtpAgent

  let labels: Label[]

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_query_labels',
    })

    agent = network.ozone.getClient()

    labels = [
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
    await modService.createLabels(labels)
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

  describe('subscribeLabels', () => {
    it('streams all labels from initial cursor.', async () => {
      const ac = new AbortController()
      let doneTimer: NodeJS.Timeout
      const resetDoneTimer = () => {
        clearTimeout(doneTimer)
        doneTimer = setTimeout(() => ac.abort(new DisconnectError()), 100)
      }
      const sub = new Subscription({
        signal: ac.signal,
        service: agent.service.origin.replace('http://', 'ws://'),
        method: ids.ComAtprotoLabelSubscribeLabels,
        getParams() {
          return { cursor: 0 }
        },
        validate(obj) {
          return lexicons.assertValidXrpcMessage<LabelMessage>(
            ids.ComAtprotoLabelSubscribeLabels,
            obj,
          )
        },
      })
      const streamedLabels: Label[] = []
      for await (const message of sub) {
        resetDoneTimer()
        if (isLabels(message)) {
          streamedLabels.push(...message.labels)
        }
      }
      expect(streamedLabels).toEqual(labels)
    })
  })
})
