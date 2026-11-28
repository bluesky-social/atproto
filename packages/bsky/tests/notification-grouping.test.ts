import { createHash } from 'node:crypto'
import { Timestamp } from '@bufbuild/protobuf'
import { afterAll, assert, beforeAll, describe, expect, it, vi } from 'vitest'
import { DAY, MINUTE } from '@atproto/common'
import { type SeedClient, TestNetwork, usersSeed } from '@atproto/dev-env'
import {
  type AtUriString,
  type DatetimeString,
  type DidString,
  type HandleString,
  toDatetimeString,
} from '@atproto/lex'
import { NOTIFICATION_REASON } from '../src/api/app/bsky/notification/constants.js'
import {
  NOW,
  minutesAgo,
  now,
  spotlightTypes,
} from '../src/api/app/bsky/notification/grouping/_fixtures.test.js'
import { app } from '../src/lexicons/index.js'
import {
  GetNotificationsV2Response,
  Notification,
} from '../src/proto/bsky_pb.js'

describe.each(['algoGravity', 'algoLookback'] as const)(
  '%s spotlight endpoint',
  (algorithm) => {
    let network: TestNetwork
    let sc: SeedClient
    let fixtureIndex = 0
    const defs = app.bsky.notification.getGroupedNotifications

    beforeAll(async () => {
      network = await TestNetwork.create({
        dbPostgresSchema: `bsky_spotlight_${algorithm.toLowerCase()}`,
        bsky: { notificationsV2Algorithm: algorithm },
      })
      sc = network.getSeedClient()
      await usersSeed(sc)
    })

    afterAll(async () => network?.close())

    const seedSpotlight = async (count = 4) => {
      const name = `spotlight-${fixtureIndex++}`
      const { did: recipient } = await sc.createAccount(name, {
        email: `${name}@test.com`,
        handle: `${name}.test`,
        password: 'spotlight-pass',
      })
      const records: {
        post: Awaited<ReturnType<SeedClient['post']>>
        like: AtUriString
        indexedAt: DatetimeString
        id: string
      }[] = []
      for (let index = 0; index < count; index++) {
        const post = await sc.post(recipient, `Post ${index}`)
        const like = (
          await sc.like(sc.dids.bob, post.ref)
        ).toString() as AtUriString
        const indexedAt = Timestamp.fromDate(
          new Date(now - index * 1000),
        ).toJson() as DatetimeString
        records.push({
          post,
          like,
          indexedAt,
          id: createHash('sha256')
            .update(`${indexedAt}\0${like}`)
            .digest('base64url'),
        })
      }
      await network.processAll()
      for (const { like, indexedAt } of records) {
        await network.bsky.db.db
          .updateTable('notification')
          .set({ sortAt: toDatetimeString(new Date(indexedAt)) })
          .where('recordUri', '=', like)
          .where('did', '=', recipient)
          .execute()
      }
      await network.bsky.ctx.dataplane.updateNotificationSeen({
        actorDid: recipient,
        timestamp: Timestamp.fromJson(records[1]!.indexedAt),
      })
      const headers = await network.serviceHeaders(recipient, defs.$lxm)
      return { recipient, records, headers }
    }

    describe.each(spotlightTypes.slice(1))(
      '$reason spotlight',
      ({ reason }) => {
        const via =
          reason === NOTIFICATION_REASON.LIKE_VIA_REPOST ||
          reason === NOTIFICATION_REASON.REPOST_VIA_REPOST
        it.each([
          { remaining: 12, removal: 'none' },
          { remaining: 3, removal: 'interaction' },
          { remaining: 2, removal: 'subject' },
          { remaining: 1, removal: 'post' },
          { remaining: 0, removal: 'block' },
        ] as const)(
          'renders $remaining surviving items after $removal filtering',
          async ({ remaining, removal }) => {
            const name = `rp-spotlight-${fixtureIndex++}`
            const { did: recipient } = await sc.createAccount(name, {
              email: `${name}@test.com`,
              handle: `${name}.test`,
              password: 'spotlight-pass',
            })
            const records: {
              post: AtUriString
              viaRepost?: AtUriString
              uri: AtUriString
              indexedAt: DatetimeString
              id: string
            }[] = []
            for (let index = 0; index < 12; index++) {
              const post = await sc.post(
                via ? sc.dids.carol : recipient,
                `Post ${index}`,
              )
              const repost = via
                ? await sc.repost(recipient, post.ref)
                : undefined
              const overrides = repost ? { via: repost.raw } : undefined
              const uri =
                reason === NOTIFICATION_REASON.LIKE_VIA_REPOST
                  ? ((
                      await sc.like(sc.dids.bob, post.ref, overrides)
                    ).toString() as AtUriString)
                  : (await sc.repost(sc.dids.bob, post.ref, overrides)).uriStr
              const indexedAt = Timestamp.fromDate(
                new Date(now - index * 1000),
              ).toJson() as DatetimeString
              records.push({
                post: post.ref.uriStr,
                ...(repost ? { viaRepost: repost.uriStr } : {}),
                uri,
                indexedAt,
                id: createHash('sha256')
                  .update(`${indexedAt}\0${uri}`)
                  .digest('base64url'),
              })
            }
            if (removal === 'block') await sc.block(recipient, sc.dids.bob)
            await network.processAll()
            for (const { uri, indexedAt } of records) {
              await network.bsky.db.db
                .updateTable('notification')
                .set({ sortAt: toDatetimeString(new Date(indexedAt)) })
                .where('recordUri', '=', uri)
                .where('did', '=', recipient)
                .execute()
            }
            if (removal !== 'block') {
              for (const record of records.slice(0, 12 - remaining)) {
                await network.bsky.ctx.dataplane.takedownRecord({
                  recordUri:
                    removal === 'interaction'
                      ? record.uri
                      : removal === 'subject'
                        ? (record.viaRepost ?? record.post)
                        : record.post,
                })
              }
            }
            await network.bsky.ctx.dataplane.updateNotificationSeen({
              actorDid: recipient,
              timestamp: Timestamp.fromJson(records[10]!.indexedAt),
            })
            const headers = await network.serviceHeaders(recipient, defs.$lxm)
            const response = await network.bsky
              .getClient()
              .call(defs, { limit: 30 }, { headers })
            const kept = records.slice(12 - remaining)
            const newest = kept[0]
            const viaRepostItems = via
              ? kept.map(({ post, viaRepost }) => {
                  assert(viaRepost)
                  return { post, viaRepost }
                })
              : []
            expect(response.groups).toEqual(
              newest
                ? [
                    defs.group.$build({
                      id: newest.id,
                      indexedAt: newest.indexedAt,
                      isRead: remaining === 1,
                      count: remaining,
                      kind:
                        remaining === 1
                          ? reason === NOTIFICATION_REASON.REPOST
                            ? defs.repostGroup.$build({
                                post: newest.post,
                                items: [{ actor: sc.dids.bob }],
                              })
                            : reason === NOTIFICATION_REASON.LIKE_VIA_REPOST
                              ? defs.likeViaRepostGroup.$build({
                                  post: newest.post,
                                  viaRepost: newest.viaRepost!,
                                  items: [{ actor: sc.dids.bob }],
                                })
                              : defs.repostViaRepostGroup.$build({
                                  post: newest.post,
                                  viaRepost: newest.viaRepost!,
                                  items: [{ actor: sc.dids.bob }],
                                })
                          : reason === NOTIFICATION_REASON.REPOST
                            ? defs.multiPostRepostGroup.$build({
                                actor: sc.dids.bob,
                                items: kept.map(({ post }) => ({ post })),
                              })
                            : reason === NOTIFICATION_REASON.LIKE_VIA_REPOST
                              ? defs.multiPostLikeViaRepostGroup.$build({
                                  actor: sc.dids.bob,
                                  items: viaRepostItems,
                                })
                              : defs.multiPostRepostViaRepostGroup.$build({
                                  actor: sc.dids.bob,
                                  items: viaRepostItems,
                                }),
                    }),
                  ]
                : [],
            )
            expect(response.relatedViews).toMatchObject([
              ...(remaining
                ? [
                    {
                      $type: app.bsky.actor.defs.profileViewBasic.$type,
                      did: sc.dids.bob,
                    },
                  ]
                : []),
              ...kept.slice(0, 10).map(({ post }) => ({
                $type: app.bsky.feed.defs.postView.$type,
                uri: post,
              })),
            ])
            expect(response.cursor).toBeUndefined()
            expect(response.seenAt).toBe(records[10]!.indexedAt)
            for (const group of response.groups)
              expect(defs.group.$matches(group)).toBe(true)
          },
        )
      },
    )

    it('returns basic related profiles with filtered known followers', async () => {
      const { recipient, headers } = await seedSpotlight()
      const { bob, carol, dan } = sc.dids
      await sc.follow(bob, recipient)
      await sc.follow(recipient, carol)
      await sc.follow(recipient, dan)
      await sc.follow(carol, bob)
      await sc.follow(dan, bob)
      await sc.block(bob, dan)
      await network.processAll()
      const client = network.bsky.getClient()
      const detailed = await client.call(
        app.bsky.actor.getProfile,
        { actor: bob },
        {
          headers: await network.serviceHeaders(
            recipient,
            app.bsky.actor.getProfile.$lxm,
          ),
        },
      )
      using aggregates = vi.spyOn(
        network.bsky.ctx.hydrator.dataplane,
        'getCountsForUsers',
      )

      const response = await client.call(defs, { limit: 4 }, { headers })

      const profile = response.relatedViews?.find(
        app.bsky.actor.defs.profileViewBasic.$isTypeOf,
      )
      assert(profile)
      expect(profile.did).toBe(bob)
      expect(profile.viewer).toEqual(detailed.viewer)
      expect(profile.viewer?.knownFollowers).toMatchObject({
        count: 2,
        followers: [{ did: carol }],
      })
      expect(profile.viewer?.knownFollowers?.followers).toHaveLength(1)
      expect(
        profile.viewer?.knownFollowers?.followers[0]?.viewer?.knownFollowers,
      ).toBeUndefined()
      expect(profile.labels).toEqual(detailed.labels)
      expect(profile.verification).toEqual(detailed.verification)
      expect(profile).not.toHaveProperty('description')
      expect(profile).not.toHaveProperty('followersCount')
      expect(aggregates).not.toHaveBeenCalled()
    })

    it.each(['all', 'followers'] as const)(
      'hydrates known followers for the first ten actors per follow group in the %s feed',
      async (feed) => {
        const { recipient, headers } = await seedSpotlight()
        const { carol, dan } = sc.dids
        await sc.follow(recipient, carol)
        await sc.follow(recipient, dan)
        await network.processAll()
        await sc.follow(carol, recipient)

        const followers: DidString[] = []
        const name = `social-proof-${fixtureIndex++}`
        for (let index = 0; index < 12; index++) {
          const handle: HandleString = `${name}-${index}.test`
          const { did } = await sc.createAccount(`${name}-${index}`, {
            email: `${handle}@test.com`,
            handle,
            password: 'social-proof-pass',
          })
          followers.push(did)
          await sc.follow(did, recipient)
          await sc.follow(dan, did)
        }
        await network.processAll()
        using knownFollowers = vi.spyOn(
          network.bsky.ctx.hydrator.dataplane,
          'sampleFollowsFollowing',
        )

        const response = await network.bsky
          .getClient()
          .call(defs, { feed, limit: 30 }, { headers })

        const followGroups = response.groups
          .map(({ kind }) => kind)
          .filter(defs.followGroup.$isTypeOf)
        expect(followGroups.map(({ items }) => items.length)).toEqual(
          feed === 'all' ? [12] : Array(12).fill(1),
        )
        expect(
          response.groups.filter(({ kind }) =>
            defs.followBackNotification.$isTypeOf(kind),
          ),
        ).toHaveLength(1)
        const expectedDids = followers
          .slice()
          .reverse()
          .slice(0, feed === 'all' ? 10 : 12)
        expect(
          followGroups.flatMap(({ items }) =>
            items.slice(0, 10).map(({ actor }) => actor),
          ),
        ).toEqual(expectedDids)
        expect(
          knownFollowers.mock.calls.flatMap(([req]) => req.targetDids),
        ).toEqual(expectedDids)
        const profiles = response.relatedViews?.filter(
          app.bsky.actor.defs.profileViewBasic.$isTypeOf,
        )
        expect(
          profiles
            ?.filter((profile) => profile.viewer?.knownFollowers)
            .map(({ did }) => did),
        ).toEqual(expectedDids)
        for (const did of expectedDids) {
          expect(
            profiles?.find((profile) => profile.did === did)?.viewer
              ?.knownFollowers,
          ).toMatchObject({ count: 1, followers: [{ did: dan }] })
        }
      },
    )

    it('returns all twelve follows with related profiles for only the first ten', async () => {
      const follows: {
        actor: DidString
        uri: AtUriString
        indexedAt: DatetimeString
      }[] = []
      for (let index = 0; index < 12; index++) {
        const name = `cap-follower-${index}`
        const { did } = await sc.createAccount(name, {
          email: `${name}@test.com`,
          handle: `${name}.test`,
          password: 'cap-follower-pass',
        })
        const follow = await sc.follow(did, sc.dids.alice)
        follows.push({
          actor: did,
          uri: follow.uriStr,
          indexedAt: toDatetimeString(new Date(minutesAgo(index))),
        })
      }
      await network.processAll()
      for (const { uri, indexedAt } of follows) {
        await network.bsky.db.db
          .updateTable('notification')
          .set({ sortAt: indexedAt })
          .where('recordUri', '=', uri)
          .where('did', '=', sc.dids.alice)
          .execute()
      }
      const headers = await network.serviceHeaders(sc.dids.alice, defs.$lxm)

      const response = await network.bsky
        .getClient()
        .call(defs, { limit: 1 }, { headers })

      expect(response.groups).toHaveLength(1)
      const group = response.groups[0]!
      assert(defs.followGroup.$isTypeOf(group.kind))
      expect(group.count).toBe(12)
      expect(group.kind.items).toHaveLength(12)
      expect(group.kind.items).toEqual(follows.map(({ actor }) => ({ actor })))
      expect(response.relatedViews).toMatchObject(
        follows.slice(0, 10).map(({ actor }) => ({
          $type: app.bsky.actor.defs.profileViewBasic.$type,
          did: actor,
        })),
      )
      expect(response.cursor).toBeUndefined()
    })

    it.each([undefined, 0, 11])(
      'returns all spotlight items with ten related records when like %s is removed',
      async (removedIndex) => {
        const { records, headers } = await seedSpotlight(12)
        if (removedIndex !== undefined) {
          await network.bsky.ctx.dataplane.takedownRecord({
            recordUri: records[removedIndex]!.like,
          })
        }

        const response = await network.bsky
          .getClient()
          .call(defs, { limit: 12 }, { headers })

        expect(response.groups).toHaveLength(1)
        const group = response.groups[0]!
        assert(defs.multiPostLikeGroup.$isTypeOf(group.kind))
        const remaining = records.filter((_, index) => index !== removedIndex)
        expect(group.count).toBe(removedIndex === undefined ? 12 : 11)
        expect(group.kind.items).toHaveLength(
          removedIndex === undefined ? 12 : 11,
        )
        expect(group.kind.items).toEqual(
          remaining.map(({ post }) => ({ post: post.ref.uriStr })),
        )
        expect(group.id).toBe(remaining[0]!.id)
        expect(group.indexedAt).toBe(remaining[0]!.indexedAt)
        expect(response.relatedViews).toMatchObject([
          {
            $type: app.bsky.actor.defs.profileViewBasic.$type,
            did: sc.dids.bob,
          },
          ...remaining.slice(0, 10).map(({ post }) => ({
            $type: app.bsky.feed.defs.postView.$type,
            uri: post.ref.uriStr,
          })),
        ])
        expect(response.cursor).toBeUndefined()
      },
    )

    it.each(['all', 'activity'] as const)(
      'groups subscribed posts across accounts only in all: %s',
      async (feed) => {
        const posts = [
          await sc.post(sc.dids.bob, 'First subscribed post'),
          await sc.post(sc.dids.dan, 'Another account’s subscribed post'),
          await sc.post(sc.dids.bob, 'Second subscribed post'),
        ]
        const actors = [sc.dids.bob, sc.dids.dan, sc.dids.bob]
        await network.processAll()
        // @NOTE the test dataplane doesn't generate subscribed-post notifications.
        using notifications = vi
          .spyOn(network.bsky.ctx.hydrator.dataplane, 'getNotificationsV2')
          .mockResolvedValue(
            new GetNotificationsV2Response({
              notifications: posts.map(
                ({ ref }, index) =>
                  new Notification({
                    recipientDid: sc.dids.carol,
                    uri: ref.uriStr,
                    reason: NOTIFICATION_REASON.SUBSCRIBED_POST,
                    timestamp: Timestamp.fromJson(minutesAgo(index)),
                  }),
              ),
            }),
          )
        const headers = await network.serviceHeaders(sc.dids.carol, defs.$lxm)

        const response = await network.bsky
          .getClient()
          .call(defs, { feed, limit: 3 }, { headers })

        const items = posts.map(({ ref }, index) => ({
          actor: actors[index]!,
          post: ref.uriStr,
        }))
        expect(notifications).toHaveBeenCalledTimes(1)
        expect(response.groups.map(({ count }) => count)).toEqual(
          feed === 'all' ? [3] : [1, 1, 1],
        )
        expect(response.groups.map(({ kind }) => kind)).toEqual(
          (feed === 'all' ? [items] : items.map((item) => [item])).map(
            (items) => defs.subscribedPostGroup.$build({ items }),
          ),
        )
        expect(response.relatedViews).toMatchObject([
          {
            $type: app.bsky.actor.defs.profileViewBasic.$type,
            did: sc.dids.bob,
          },
          {
            $type: app.bsky.actor.defs.profileViewBasic.$type,
            did: sc.dids.dan,
          },
          ...posts.map(({ ref }) => ({
            $type: app.bsky.feed.defs.postView.$type,
            uri: ref.uriStr,
          })),
        ])
        expect(response.cursor).toBeUndefined()
      },
    )

    it('returns all subscribed posts with related views for only the first ten of each group', async () => {
      const authors = [sc.dids.bob, sc.dids.dan]
      const postGroups = await Promise.all(
        authors.map(async (actor) => {
          const posts: Awaited<ReturnType<SeedClient['post']>>[] = []
          for (let index = 0; index < 12; index++) {
            posts.push(await sc.post(actor, `Subscribed post ${index}`))
          }
          return { actor, posts }
        }),
      )
      await network.processAll()
      // The test dataplane doesn't generate subscribed-post notifications.
      using notifications = vi
        .spyOn(network.bsky.ctx.hydrator.dataplane, 'getNotificationsV2')
        .mockResolvedValue(
          new GetNotificationsV2Response({
            notifications: postGroups
              .flatMap(({ posts }) => posts)
              .map(
                ({ ref }, index) =>
                  new Notification({
                    recipientDid: sc.dids.carol,
                    uri: ref.uriStr,
                    reason: NOTIFICATION_REASON.SUBSCRIBED_POST,
                    timestamp: Timestamp.fromJson(minutesAgo(index)),
                  }),
              ),
          }),
        )
      const headers = await network.serviceHeaders(sc.dids.carol, defs.$lxm)

      const response = await network.bsky
        .getClient()
        .call(defs, { limit: 2 }, { headers })

      expect(notifications).toHaveBeenCalledTimes(1)
      expect(response.groups.map(({ count }) => count)).toEqual([24])
      expect(response.groups.map(({ kind }) => kind)).toEqual([
        defs.subscribedPostGroup.$build({
          items: postGroups.flatMap(({ actor, posts }) =>
            posts.map(({ ref }) => ({ actor, post: ref.uriStr })),
          ),
        }),
      ])
      expect(response.relatedViews).toMatchObject([
        {
          $type: app.bsky.actor.defs.profileViewBasic.$type,
          did: sc.dids.bob,
        },
        ...postGroups
          .flatMap(({ posts }) => posts)
          .slice(0, 10)
          .map(({ ref }) => ({
            $type: app.bsky.feed.defs.postView.$type,
            uri: ref.uriStr,
          })),
      ])
      expect(response.cursor).toBeUndefined()
    })

    it('names the parent of a subscribed post that is a reply, with its view', async () => {
      const root = await sc.post(sc.dids.dan, 'Subscribed root')
      const reply = await sc.reply(
        sc.dids.bob,
        root.ref,
        root.ref,
        'Subscribed reply',
      )
      await network.processAll()
      // The test dataplane doesn't generate subscribed-post notifications.
      using notifications = vi
        .spyOn(network.bsky.ctx.hydrator.dataplane, 'getNotificationsV2')
        .mockResolvedValue(
          new GetNotificationsV2Response({
            notifications: [reply, root].map(
              ({ ref }, index) =>
                new Notification({
                  recipientDid: sc.dids.carol,
                  uri: ref.uriStr,
                  reason: NOTIFICATION_REASON.SUBSCRIBED_POST,
                  timestamp: Timestamp.fromJson(minutesAgo(index)),
                }),
            ),
          }),
        )
      const headers = await network.serviceHeaders(sc.dids.carol, defs.$lxm)

      const response = await network.bsky
        .getClient()
        .call(defs, { limit: 2 }, { headers })

      expect(notifications).toHaveBeenCalledTimes(1)
      expect(response.groups.map(({ kind }) => kind)).toEqual([
        defs.subscribedPostGroup.$build({
          items: [
            {
              actor: sc.dids.bob,
              post: reply.ref.uriStr,
              parent: root.ref.uriStr,
            },
            { actor: sc.dids.dan, post: root.ref.uriStr },
          ],
        }),
      ])
      expect(response.groups[0]!.kind).not.toHaveProperty('items.1.parent')
      expect(response.relatedViews).toMatchObject([
        { $type: app.bsky.actor.defs.profileViewBasic.$type, did: sc.dids.bob },
        { $type: app.bsky.actor.defs.profileViewBasic.$type, did: sc.dids.dan },
        { $type: app.bsky.feed.defs.postView.$type, uri: reply.ref.uriStr },
        { $type: app.bsky.feed.defs.postView.$type, uri: root.ref.uriStr },
      ])
    })

    it.each([4, 3, 2, 1, 0])(
      'renders %i surviving likes with exact metadata and related views after rules filtering',
      async (remaining) => {
        const { records, headers } = await seedSpotlight()
        for (const { like } of records.slice(0, 4 - remaining)) {
          await network.bsky.ctx.dataplane.takedownRecord({ recordUri: like })
        }
        using reads = vi.spyOn(
          network.bsky.ctx.hydrator.dataplane,
          'getNotificationsV2',
        )
        using hydration = vi.spyOn(
          network.bsky.ctx.hydrator,
          'hydrateGroupedNotifications',
        )
        const response = await network.bsky
          .getClient()
          .call(defs, { limit: 4 }, { headers })
        const kept = records.slice(4 - remaining)
        const newest = kept[0]

        expect(reads).toHaveBeenCalledTimes(1)
        expect((await reads.mock.results[0]!.value).cursor).toBe('')
        expect(hydration).toHaveBeenCalledTimes(1)
        expect(hydration.mock.calls[0]![0].map(({ uri }) => uri)).toEqual(
          records.map(({ like }) => like),
        )
        expect(response.groups).toEqual(
          newest
            ? [
                defs.group.$build({
                  id: newest.id,
                  indexedAt: newest.indexedAt,
                  isRead: remaining < 3,
                  count: remaining,
                  kind:
                    remaining === 1
                      ? defs.likeGroup.$build({
                          post: newest.post.ref.uriStr,
                          items: [{ actor: sc.dids.bob }],
                        })
                      : defs.multiPostLikeGroup.$build({
                          actor: sc.dids.bob,
                          items: kept.map(({ post }) => ({
                            post: post.ref.uriStr,
                          })),
                        }),
                }),
              ]
            : [],
        )
        expect(response.seenAt).toBe(records[1]!.indexedAt)
        expect(response.cursor).toBeUndefined()
        expect(response.relatedViews).toMatchObject([
          ...(remaining
            ? [
                {
                  $type: app.bsky.actor.defs.profileViewBasic.$type,
                  did: sc.dids.bob,
                },
              ]
            : []),
          ...kept.map(({ post }) => ({
            $type: app.bsky.feed.defs.postView.$type,
            uri: post.ref.uriStr,
          })),
        ])
        for (const view of response.relatedViews ?? []) {
          expect(
            app.bsky.actor.defs.profileViewBasic.$matches(view) ||
              app.bsky.feed.defs.postView.$matches(view),
          ).toBe(true)
        }
      },
    )

    it('deduplicates profiles and records across mixed notification groups', async () => {
      const { recipient, records, headers } = await seedSpotlight(2)
      const generator = await sc.createFeedGen(
        recipient,
        'did:web:example.com',
        'Related feed',
      )
      const starterPack = await sc.createStarterPack(
        recipient,
        'Related starter pack',
        [recipient],
      )
      await sc.like(sc.dids.bob, generator)
      const bobFollow = await sc.follow(sc.dids.bob, recipient, {
        via: starterPack.raw,
      })
      const carolFollow = await sc.follow(sc.dids.carol, recipient, {
        via: starterPack.raw,
      })
      await network.processAll()

      await network.bsky.db.db
        .updateTable('notification')
        .set({ reasonSubject: starterPack.uriStr })
        .where('recordUri', 'in', [bobFollow.uriStr, carolFollow.uriStr])
        .execute()

      const response = await network.bsky
        .getClient()
        .call(defs, { limit: 30 }, { headers })

      expect(response.groups).toHaveLength(4)
      const expectedViews = [
        ...[sc.dids.bob, sc.dids.carol].map((did) => ({
          $type: app.bsky.actor.defs.profileViewBasic.$type,
          did,
        })),
        ...records.map(({ post }) => ({
          $type: app.bsky.feed.defs.postView.$type,
          uri: post.ref.uriStr,
        })),
        {
          $type: app.bsky.feed.defs.generatorView.$type,
          uri: generator.uriStr,
        },
        {
          $type: app.bsky.graph.defs.starterPackViewBasic.$type,
          uri: starterPack.uriStr,
        },
      ]
      expect(response.relatedViews).toHaveLength(expectedViews.length)
      expect(response.relatedViews).toEqual(
        expect.arrayContaining(
          expectedViews.map((view) => expect.objectContaining(view)),
        ),
      )
    })

    it.each(['not found', 'blocked'] as const)(
      'includes a typed placeholder for a %s reply parent',
      async (status) => {
        const { recipient, records, headers } = await seedSpotlight(2)
        const root = records[0]!.post.ref
        const parent = await sc.reply(sc.dids.carol, root, root, 'Parent')
        const reply = await sc.reply(sc.dids.bob, root, parent.ref, 'Reply')
        if (status === 'blocked') {
          await sc.block(recipient, sc.dids.carol)
        }
        await network.processAll()
        if (status === 'not found') {
          await network.bsky.ctx.dataplane.takedownRecord({
            recordUri: parent.ref.uriStr,
          })
        }
        using notifications = vi
          .spyOn(network.bsky.ctx.hydrator.dataplane, 'getNotificationsV2')
          .mockResolvedValue(
            new GetNotificationsV2Response({
              notifications: [
                new Notification({
                  recipientDid: recipient,
                  uri: reply.ref.uriStr,
                  reason: NOTIFICATION_REASON.REPLY,
                  reasonSubject: parent.ref.uriStr,
                  timestamp: Timestamp.fromJson(NOW),
                }),
              ],
            }),
          )

        const response = await network.bsky
          .getClient()
          .call(defs, { limit: 1 }, { headers })

        expect(notifications).toHaveBeenCalledTimes(1)
        expect(response.groups.map(({ kind }) => kind)).toEqual([
          defs.replyNotification.$build({
            post: reply.ref.uriStr,
            parent: parent.ref.uriStr,
          }),
        ])
        expect(response.relatedViews).toMatchObject([
          { $type: app.bsky.feed.defs.postView.$type, uri: reply.ref.uriStr },
          status === 'not found'
            ? app.bsky.feed.defs.notFoundPost.$build({
                uri: parent.ref.uriStr,
                notFound: true,
              })
            : app.bsky.feed.defs.blockedPost.$build({
                uri: parent.ref.uriStr,
                blocked: true,
                author: { did: sc.dids.carol },
              }),
        ])
      },
    )

    it.each([
      { spacing: 15 * MINUTE, eligible: true },
      { spacing: 45 * MINUTE, eligible: algorithm === 'algoGravity' },
      { spacing: DAY, eligible: false },
    ])(
      'uses the configured burst splitter across raw pages: gaps $spacing ms, eligible=$eligible',
      async ({ spacing, eligible }) => {
        const { recipient, records, headers } = await seedSpotlight()
        const now = Date.now()
        const notifications = records.map(
          ({ like, post }, index) =>
            new Notification({
              recipientDid: recipient,
              uri: like,
              reason: NOTIFICATION_REASON.LIKE,
              reasonSubject: post.ref.uriStr,
              timestamp: Timestamp.fromDate(new Date(now - index * spacing)),
            }),
        )
        using reads = vi
          .spyOn(network.bsky.ctx.hydrator.dataplane, 'getNotificationsV2')
          .mockResolvedValueOnce(
            new GetNotificationsV2Response({
              notifications: notifications.slice(0, 2),
              cursor: toDatetimeString(new Date(now - spacing)),
            }),
          )
          .mockResolvedValueOnce(
            new GetNotificationsV2Response({
              notifications: notifications.slice(2),
            }),
          )

        const response = await network.bsky
          .getClient()
          .call(defs, { limit: 4 }, { headers })

        expect(reads).toHaveBeenCalledTimes(2)
        expect(response.groups.map(({ kind }) => kind)).toEqual(
          eligible
            ? [
                defs.multiPostLikeGroup.$build({
                  actor: sc.dids.bob,
                  items: records.map(({ post }) => ({ post: post.ref.uriStr })),
                }),
              ]
            : records.map(({ post }) =>
                defs.likeGroup.$build({
                  post: post.ref.uriStr,
                  items: [{ actor: sc.dids.bob }],
                }),
              ),
        )
        expect(response.cursor).toBeUndefined()
      },
    )

    it('builds the spotlight from all fetched pages and hydrates once', async () => {
      const { records, headers } = await seedSpotlight()
      const dataplane = network.bsky.ctx.hydrator.dataplane
      const getNotifications = dataplane.getNotificationsV2.bind(dataplane)
      using reads = vi
        .spyOn(dataplane, 'getNotificationsV2')
        .mockImplementation((request, ...args) =>
          getNotifications({ ...request, limit: 2 }, ...args),
        )
      using hydration = vi.spyOn(
        network.bsky.ctx.hydrator,
        'hydrateGroupedNotifications',
      )

      const response = await network.bsky
        .getClient()
        .call(defs, { limit: 4 }, { headers })

      expect(reads).toHaveBeenCalledTimes(2)
      expect(Date.parse(reads.mock.calls[1]![0].cursor!)).toBe(
        Date.parse(records[1]!.indexedAt),
      )
      expect(hydration).toHaveBeenCalledTimes(1)
      expect(response.groups.map(({ kind }) => kind)).toEqual([
        defs.multiPostLikeGroup.$build({
          actor: sc.dids.bob,
          items: records.map(({ post }) => ({ post: post.ref.uriStr })),
        }),
      ])
      expect(response.cursor).toBeUndefined()
    })

    it('paginates after trimming and sorts again when rules remove the spotlight’s newest like', async () => {
      const { recipient, records, headers } = await seedSpotlight()
      const otherLikes: { uri: AtUriString; indexedAt: DatetimeString }[] = []
      for (const { post, indexedAt } of records) {
        otherLikes.push({
          uri: (await sc.like(sc.dids.carol, post.ref)).toString(),
          indexedAt: toDatetimeString(new Date(Date.parse(indexedAt) - 500)),
        })
      }
      await network.processAll()
      for (const { uri, indexedAt } of otherLikes) {
        await network.bsky.db.db
          .updateTable('notification')
          .set({ sortAt: indexedAt })
          .where('recordUri', '=', uri)
          .where('did', '=', recipient)
          .execute()
      }
      await network.bsky.ctx.dataplane.takedownRecord({
        recordUri: records[0]!.like,
      })
      using reads = vi.spyOn(
        network.bsky.ctx.hydrator.dataplane,
        'getNotificationsV2',
      )
      const client = network.bsky.getClient()

      const first = await client.call(defs, { limit: 4 }, { headers })

      expect(reads).toHaveBeenCalledTimes(1)
      expect(first.groups.map(({ kind }) => kind)).toEqual([
        defs.likeGroup.$build({
          post: records[0]!.post.ref.uriStr,
          items: [{ actor: sc.dids.carol }],
        }),
        defs.multiPostLikeGroup.$build({
          actor: sc.dids.bob,
          items: records
            .slice(1)
            .map(({ post }) => ({ post: post.ref.uriStr })),
        }),
        defs.likeGroup.$build({
          post: records[1]!.post.ref.uriStr,
          items: [{ actor: sc.dids.carol }],
        }),
        defs.likeGroup.$build({
          post: records[2]!.post.ref.uriStr,
          items: [{ actor: sc.dids.carol }],
        }),
      ])
      expect(first.groups[1]?.id).toBe(records[1]!.id)
      expect(first.groups[1]?.indexedAt).toBe(records[1]!.indexedAt)
      expect(first.groups[1]?.count).toBe(3)
      expect(first.cursor).toBe(records[3]!.indexedAt)
      expect(first.relatedViews).toMatchObject([
        ...[sc.dids.carol, sc.dids.bob].map((did) => ({
          $type: app.bsky.actor.defs.profileViewBasic.$type,
          did,
        })),
        ...records.map(({ post }) => ({
          $type: app.bsky.feed.defs.postView.$type,
          uri: post.ref.uriStr,
        })),
      ])

      const second = await client.call(
        defs,
        { limit: 4, cursor: first.cursor },
        { headers },
      )

      expect(reads).toHaveBeenCalledTimes(2)
      expect(second.groups.map(({ kind }) => kind)).toEqual([
        defs.likeGroup.$build({
          post: records[3]!.post.ref.uriStr,
          items: [{ actor: sc.dids.carol }],
        }),
      ])
      expect(second.cursor).toBeUndefined()
      expect(second.relatedViews).toMatchObject([
        {
          $type: app.bsky.actor.defs.profileViewBasic.$type,
          did: sc.dids.carol,
        },
        {
          $type: app.bsky.feed.defs.postView.$type,
          uri: records[3]!.post.ref.uriStr,
        },
      ])
    })
  },
)
