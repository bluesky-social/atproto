import assert from 'node:assert'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppBskyFeedDefs, AtpAgent, ids } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { NOTIFICATION_REASON } from '../../src/api/app/bsky/notification/constants.js'
import { GetTagsForSubjectsResponse, Tag } from '../../src/proto/bsky_pb.js'

describe.each(['labels', 'tags', 'mixed'])('bsky needs-review %s', (mode) => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let tags: Tag[] = []

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: `bsky_views_needs_review_${mode}`,
    })
    network.bsky.ctx.hydrator.label.dataplane = {
      ...network.bsky.ctx.dataplane,
      getTagsForSubjects: async (req) =>
        new GetTagsForSubjectsResponse({
          tags: tags.filter((tag) => req.subjects?.includes(tag.subject)),
        }),
    }
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)

    await sc.createAccount('geoff', {
      email: 'geoff@test.com',
      handle: 'geoff.test',
      password: 'geoff',
    })

    await sc.reply(
      sc.dids.geoff,
      sc.posts[sc.dids.alice][0].ref,
      sc.posts[sc.dids.alice][0].ref,
      'my name geoff',
    )

    await sc.post(
      sc.dids.geoff,
      'her name alice',
      undefined,
      undefined,
      sc.posts[sc.dids.alice][0].ref,
    )

    await sc.follow(sc.dids.bob, sc.dids.geoff)

    AtpAgent.configure({ appLabelers: [network.ozone.ctx.cfg.service.did] })
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

  describe('account-level', () => {
    beforeAll(async () => {
      await addNeedsReview([sc.dids.geoff])
    })

    afterAll(async () => {
      tags = []
      await network.bsky.db.db
        .deleteFrom('label')
        .where('src', '=', network.ozone.ctx.cfg.service.did)
        .execute()
    })

    checkOtherViews()

    it('applies to thread replies.', async () => {
      const {
        data: { thread },
      } = await agent.app.bsky.feed.getPostThread({
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      })
      assert(AppBskyFeedDefs.isThreadViewPost(thread))
      expect(
        thread.replies?.some((reply) => {
          return (
            AppBskyFeedDefs.isThreadViewPost(reply) &&
            reply.post.author.did === sc.dids.geoff
          )
        }),
      ).toBe(false)
    })

    it('applies to quote lists.', async () => {
      const {
        data: { posts },
      } = await agent.app.bsky.feed.getQuotes({
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      })
      expect(
        posts.some((post) => {
          return post.author.did === sc.dids.geoff
        }),
      ).toBe(false)
    })

    it('applies to reply, quote, and mention notifications.', async () => {
      const {
        data: { notifications },
      } = await agent.app.bsky.notification.listNotifications(
        {},
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyNotificationListNotifications,
          ),
        },
      )
      expect(
        notifications.some((notif) => {
          return (
            notif.reason === NOTIFICATION_REASON.REPLY &&
            notif.author.did === sc.dids.geoff
          )
        }),
      ).toBe(false)
      expect(
        notifications.some((notif) => {
          return (
            notif.reason === NOTIFICATION_REASON.QUOTE &&
            notif.author.did === sc.dids.geoff
          )
        }),
      ).toBe(false)
      expect(
        notifications.some((notif) => {
          return (
            notif.reason === NOTIFICATION_REASON.MENTION &&
            notif.author.did === sc.dids.geoff
          )
        }),
      ).toBe(false)
    })

    it('does not apply to self.', async () => {
      const {
        data: { thread },
      } = await agent.app.bsky.feed.getPostThread(
        {
          uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        },
        {
          headers: await network.serviceHeaders(
            sc.dids.geoff,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )
      assert(AppBskyFeedDefs.isThreadViewPost(thread))
      expect(
        thread.replies?.some((reply) => {
          return (
            AppBskyFeedDefs.isThreadViewPost(reply) &&
            reply.post.author.did === sc.dids.geoff
          )
        }),
      ).toBe(true)
    })

    it('does not apply to followers.', async () => {
      const {
        data: { thread },
      } = await agent.app.bsky.feed.getPostThread(
        {
          uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        },
        {
          headers: await network.serviceHeaders(
            sc.dids.bob, // follows geoff
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )
      assert(AppBskyFeedDefs.isThreadViewPost(thread))
      expect(
        thread.replies?.some((reply) => {
          return (
            AppBskyFeedDefs.isThreadViewPost(reply) &&
            reply.post.author.did === sc.dids.geoff
          )
        }),
      ).toBe(true)
    })
  })

  describe('record-level', () => {
    beforeAll(async () => {
      const geoffPostUris = [
        ...sc.posts[sc.dids.geoff],
        ...sc.replies[sc.dids.geoff],
      ].map((post) => post.ref.uriStr)
      await addNeedsReview(geoffPostUris)
    })

    checkOtherViews()

    it('applies to thread replies.', async () => {
      const {
        data: { thread },
      } = await agent.app.bsky.feed.getPostThread({
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      })
      assert(AppBskyFeedDefs.isThreadViewPost(thread))
      expect(
        thread.replies?.some((reply) => {
          return (
            AppBskyFeedDefs.isThreadViewPost(reply) &&
            reply.post.author.did === sc.dids.geoff
          )
        }),
      ).toBe(false)
    })

    it('applies to quote lists.', async () => {
      const {
        data: { posts },
      } = await agent.app.bsky.feed.getQuotes({
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      })
      expect(
        posts.some((post) => {
          return post.author.did === sc.dids.geoff
        }),
      ).toBe(false)
    })

    it('applies to reply, quote, and mention notifications.', async () => {
      const {
        data: { notifications },
      } = await agent.app.bsky.notification.listNotifications(
        {},
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyNotificationListNotifications,
          ),
        },
      )
      expect(
        notifications.some((notif) => {
          return (
            notif.reason === NOTIFICATION_REASON.REPLY &&
            notif.author.did === sc.dids.geoff
          )
        }),
      ).toBe(false)
      expect(
        notifications.some((notif) => {
          return (
            notif.reason === NOTIFICATION_REASON.QUOTE &&
            notif.author.did === sc.dids.geoff
          )
        }),
      ).toBe(false)
      expect(
        notifications.some((notif) => {
          return (
            notif.reason === NOTIFICATION_REASON.MENTION &&
            notif.author.did === sc.dids.geoff
          )
        }),
      ).toBe(false)
    })

    it('does not apply to self.', async () => {
      const {
        data: { thread },
      } = await agent.app.bsky.feed.getPostThread(
        {
          uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        },
        {
          headers: await network.serviceHeaders(
            sc.dids.geoff,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )
      assert(AppBskyFeedDefs.isThreadViewPost(thread))
      expect(
        thread.replies?.some((reply) => {
          return (
            AppBskyFeedDefs.isThreadViewPost(reply) &&
            reply.post.author.did === sc.dids.geoff
          )
        }),
      ).toBe(true)
    })

    it('does not apply to followers.', async () => {
      const {
        data: { thread },
      } = await agent.app.bsky.feed.getPostThread(
        {
          uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        },
        {
          headers: await network.serviceHeaders(
            sc.dids.bob, // follows geoff
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )
      assert(AppBskyFeedDefs.isThreadViewPost(thread))
      expect(
        thread.replies?.some((reply) => {
          return (
            AppBskyFeedDefs.isThreadViewPost(reply) &&
            reply.post.author.did === sc.dids.geoff
          )
        }),
      ).toBe(true)
    })
  })

  function checkOtherViews() {
    it('applies to thread v2 replies', async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2({
        anchor: sc.posts[sc.dids.alice][0].ref.uriStr,
      })
      expect(
        data.thread.some(
          ({ value }) =>
            'post' in value &&
            (value.post as AppBskyFeedDefs.PostView).author.did ===
              sc.dids.geoff,
        ),
      ).toBe(false)
    })

    it('applies to grouped notifications', async () => {
      const { data } =
        await agent.app.bsky.notification.getGroupedNotifications(
          {},
          {
            headers: await network.serviceHeaders(
              sc.dids.alice,
              ids.AppBskyNotificationGetGroupedNotifications,
            ),
          },
        )
      expect(
        data.groups.some(
          ({ kind }) =>
            'items' in kind &&
            Array.isArray(kind.items) &&
            kind.items.some(
              (item) => 'actor' in item && item.actor === sc.dids.geoff,
            ),
        ),
      ).toBe(false)
    })
  }

  async function addNeedsReview(subjects: string[]) {
    if (mode !== 'labels') {
      tags.push(
        ...subjects.map(
          (subject) =>
            new Tag({
              subject,
              issuer: 'did:example:moderator',
              value: 'needs-review',
              event: { source: network.ozone.ctx.cfg.service.did, eventId: 1n },
            }),
        ),
      )
    }
    if (mode !== 'tags') {
      await network.bsky.db.db
        .insertInto('label')
        .values(
          subjects.map((uri) => ({
            src: network.ozone.ctx.cfg.service.did,
            uri,
            cid: '',
            val: 'needs-review',
            exp: null,
            neg: false,
            cts: new Date().toISOString(),
          })),
        )
        .execute()
    }
  }
})
