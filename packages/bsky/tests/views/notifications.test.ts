import { AppBskyNotificationDeclaration, AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { TAG_HIDE } from '@atproto/dev-env/dist/seed/thread-v2'
import { delayCursor } from '../../src/api/app/bsky/notification/listNotifications'
import { ids } from '../../src/lexicon/lexicons'
import { ProfileView } from '../../src/lexicon/types/app/bsky/actor/defs'
import {
  ActivitySubscription,
  ChatPreference,
  FilterablePreference,
  Preference,
  Preferences,
} from '../../src/lexicon/types/app/bsky/notification/defs'
import {
  OutputSchema as ListActivitySubscriptionsOutputSchema,
  QueryParams,
} from '../../src/lexicon/types/app/bsky/notification/listActivitySubscriptions'
import {
  Notification,
  OutputSchema as ListNotificationsOutputSchema,
} from '../../src/lexicon/types/app/bsky/notification/listNotifications'
import { InputSchema } from '../../src/lexicon/types/app/bsky/notification/putPreferencesV2'
import { Namespaces } from '../../src/stash'
import { forSnapshot, paginateAll } from '../_util'

type Database = TestNetwork['bsky']['db']

describe('notification views', () => {
  let network: TestNetwork
  let db: Database

  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string
  let eve: string
  let fred: string
  let greg: string
  let han: string
  let blocked: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_notifications',
      bsky: {
        threadTagsHide: new Set([TAG_HIDE]),
      },
    })
    db = network.bsky.db
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.bsky.db.db
      .updateTable('actor')
      .set({ trustedVerifier: true })
      .where('did', '=', alice)
      .execute()
    await sc.createAccount('eve', {
      email: 'eve@test.com',
      handle: 'eve.test',
      password: 'eve-pass',
    })
    await sc.createAccount('fred', {
      email: 'fred@test.com',
      handle: 'fred.test',
      password: 'fred-pass',
    })
    await sc.createAccount('greg', {
      email: 'greg@test.com',
      handle: 'greg.test',
      password: 'greg-pass',
    })
    await sc.createAccount('han', {
      email: 'han@test.com',
      handle: 'han.test',
      password: 'han-pass',
    })
    await sc.createAccount('blocked', {
      email: 'blocked@test.com',
      handle: 'blocked.test',
      password: 'blocked-pass',
    })

    await network.processAll()

    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    eve = sc.dids.eve
    fred = sc.dids.fred
    greg = sc.dids.greg
    han = sc.dids.han
    blocked = sc.dids.blocked
  })

  afterAll(async () => {
    await network.close()
  })

  const sortNotifs = (notifs: Notification[]) => {
    // Need to sort because notification ordering is not well-defined
    return notifs.sort((a, b) => {
      const stableUriA = a.uri.replace(
        /\/did:plc:.+?\//,
        `/${a.author.handle}/`,
      )
      const stableUriB = b.uri.replace(
        /\/did:plc:.+?\//,
        `/${b.author.handle}/`,
      )
      if (stableUriA === stableUriB) {
        return a.indexedAt > b.indexedAt ? -1 : 1
      }
      return stableUriA > stableUriB ? -1 : 1
    })
  }

  it('fetches notification count without a last-seen', async () => {
    const notifCountAlice =
      await agent.api.app.bsky.notification.getUnreadCount(
        {},
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyNotificationGetUnreadCount,
          ),
        },
      )

    expect(notifCountAlice.data.count).toBe(12)

    const notifCountBob = await agent.api.app.bsky.notification.getUnreadCount(
      {},
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyNotificationGetUnreadCount,
        ),
      },
    )

    expect(notifCountBob.data.count).toBeGreaterThanOrEqual(3)
  })

  it('generates notifications for all reply ancestors', async () => {
    // Add to reply chain, post ancestors: alice -> bob -> alice -> carol.
    // Should have added one notification for each of alice and bob.
    await sc.reply(
      sc.dids.carol,
      sc.posts[alice][1].ref,
      sc.replies[alice][0].ref,
      'indeed',
    )
    await network.processAll()

    const notifCountAlice =
      await agent.api.app.bsky.notification.getUnreadCount(
        {},
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyNotificationGetUnreadCount,
          ),
        },
      )

    expect(notifCountAlice.data.count).toBe(13)

    const notifCountBob = await agent.api.app.bsky.notification.getUnreadCount(
      {},
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyNotificationGetUnreadCount,
        ),
      },
    )

    expect(notifCountBob.data.count).toBeGreaterThanOrEqual(4)
  })

  it('does not give notifs for a deleted subject', async () => {
    const root = await sc.post(sc.dids.alice, 'root')
    const first = await sc.reply(sc.dids.bob, root.ref, root.ref, 'first')
    await sc.deletePost(sc.dids.alice, root.ref.uri)
    const second = await sc.reply(sc.dids.carol, root.ref, first.ref, 'second')
    await network.processAll()

    const notifsAlice = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    const hasNotif = notifsAlice.data.notifications.some(
      (notif) => notif.uri === second.ref.uriStr,
    )
    expect(hasNotif).toBe(false)

    // cleanup
    await sc.deletePost(sc.dids.bob, first.ref.uri)
    await sc.deletePost(sc.dids.carol, second.ref.uri)
    await network.processAll()
  })

  it('generates notifications for quotes', async () => {
    // Dan was quoted by alice
    const notifsDan = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          sc.dids.dan,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    expect(
      forSnapshot(sortNotifs(notifsDan.data.notifications)),
    ).toMatchSnapshot()
  })

  it('generates notifications for likes', async () => {
    const notifsAlice = await agent.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )

    const na = sortNotifs(
      notifsAlice.data.notifications.filter((n) => n.reason === 'like'),
    )
    expect(na).toHaveLength(5)
    expect(forSnapshot(na)).toMatchSnapshot()
  })

  it('generates notifications for reposts', async () => {
    const notifsAlice = await agent.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )

    const na = sortNotifs(
      notifsAlice.data.notifications.filter((n) => n.reason === 'repost'),
    )
    expect(na).toHaveLength(2)
    expect(forSnapshot(na)).toMatchSnapshot()
  })

  it('generates notifications for likes via repost', async () => {
    const op = dan
    const reposter = carol
    const liker = alice
    await sc.like(liker, sc.posts[op][1].ref, {
      via: sc.reposts[reposter][0].raw,
    })
    await network.processAll()

    const notifsOp = await agent.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          op,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )

    const no = sortNotifs(
      notifsOp.data.notifications.filter((n) => n.reason === 'like'),
    )
    // Like from `alice` in this test.
    expect(no).toHaveLength(1)
    expect(forSnapshot(no)).toMatchSnapshot()

    const notifsReposter = await agent.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          reposter,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )

    const nr = sortNotifs(
      notifsReposter.data.notifications.filter(
        (n) => n.reason === 'like-via-repost',
      ),
    )
    // Like from `alice` in this test.
    expect(nr).toHaveLength(1)
    expect(forSnapshot(nr)).toMatchSnapshot()
  })

  it('does not generate self notifications for likes via own repost', async () => {
    const op = dan
    const reposter = carol
    await sc.like(reposter, sc.posts[op][1].ref, {
      via: sc.reposts[reposter][0].raw,
    })
    await network.processAll()

    const notifsOp = await agent.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          op,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )

    const no = sortNotifs(
      notifsOp.data.notifications.filter((n) => n.reason === 'like'),
    )
    // Like from `alice` in previous test + `carol` on this test.
    expect(no).toHaveLength(2)
    expect(forSnapshot(no)).toMatchSnapshot()

    const notifsReposter = await agent.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          reposter,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )

    const nr = sortNotifs(
      notifsReposter.data.notifications.filter(
        (n) => n.reason === 'like-via-repost',
      ),
    )
    // Like from `alice` in previous test.
    expect(nr).toHaveLength(1)
    expect(forSnapshot(nr)).toMatchSnapshot()
  })

  it('generates notifications for reposts via repost', async () => {
    const op = dan
    const reposter = carol
    const reReposter = alice
    await sc.repost(reReposter, sc.posts[op][1].ref, {
      via: sc.reposts[reposter][0].raw,
    })
    await network.processAll()

    const notifsOp = await agent.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          op,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )

    const no = sortNotifs(
      notifsOp.data.notifications.filter((n) => n.reason === 'repost'),
    )
    // Repost from `carol` in seeds + `alice` on this test.
    expect(no).toHaveLength(2)
    expect(forSnapshot(no)).toMatchSnapshot()

    const notifsReposter = await agent.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          reposter,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )

    const nr = sortNotifs(
      notifsReposter.data.notifications.filter(
        (n) => n.reason === 'repost-via-repost',
      ),
    )
    // Repost from `alice` in this test.
    expect(nr).toHaveLength(1)
    expect(forSnapshot(nr)).toMatchSnapshot()
  })

  it('generates notifications for verification created and removed', async () => {
    await sc.verify(
      sc.dids.alice,
      sc.dids.bob,
      sc.accounts[sc.dids.bob].handle,
      sc.profiles[sc.dids.bob].displayName,
    )
    await network.processAll()
    const notifsBob1 = await agent.app.bsky.notification.listNotifications(
      { reasons: ['verified', 'unverified'] },
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    expect(
      forSnapshot(sortNotifs(notifsBob1.data.notifications)),
    ).toMatchSnapshot()

    await sc.unverify(sc.dids.alice, sc.dids.bob)
    await network.processAll()
    const notifsBob2 = await agent.app.bsky.notification.listNotifications(
      { reasons: ['verified', 'unverified'] },
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    expect(
      forSnapshot(sortNotifs(notifsBob2.data.notifications)),
    ).toMatchSnapshot()
  })

  it('fetches notifications without a last-seen', async () => {
    const notifRes = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )

    const notifs = notifRes.data.notifications
    expect(notifs.length).toBe(13)

    const readStates = notifs.map((notif) => notif.isRead)
    expect(readStates).toEqual(notifs.map((_, i) => i !== 0)) // only first appears unread

    expect(forSnapshot(sortNotifs(notifs))).toMatchSnapshot()
  })

  it('paginates', async () => {
    const results = (results: ListNotificationsOutputSchema[]) =>
      sortNotifs(results.flatMap((res) => res.notifications))
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.notification.listNotifications(
        { cursor, limit: 6 },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyNotificationListNotifications,
          ),
        },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.notifications.length).toBeLessThanOrEqual(6),
    )

    const full = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )

    expect(full.data.notifications.length).toEqual(13)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches notification count with a last-seen', async () => {
    const full = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    const seenAt = full.data.notifications[3].indexedAt
    await agent.api.app.bsky.notification.updateSeen(
      { seenAt },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationUpdateSeen,
        ),
        encoding: 'application/json',
      },
    )
    const full2 = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    expect(full2.data.notifications.length).toBe(full.data.notifications.length)
    expect(full2.data.seenAt).toEqual(seenAt)

    const notifCount = await agent.api.app.bsky.notification.getUnreadCount(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationGetUnreadCount,
        ),
      },
    )

    expect(notifCount.data.count).toBe(
      full.data.notifications.filter((n) => n.indexedAt > seenAt).length,
    )
    expect(notifCount.data.count).toBeGreaterThan(0)

    // reset last-seen
    await agent.api.app.bsky.notification.updateSeen(
      { seenAt: new Date(0).toISOString() },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationUpdateSeen,
        ),
        encoding: 'application/json',
      },
    )
  })

  it('fetches notifications with a last-seen', async () => {
    const full = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    const seenAt = full.data.notifications[3].indexedAt
    await agent.api.app.bsky.notification.updateSeen(
      { seenAt },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationUpdateSeen,
        ),
        encoding: 'application/json',
      },
    )
    const notifRes = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )

    const notifs = notifRes.data.notifications
    expect(notifs.length).toBe(13)

    const readStates = notifs.map((notif) => notif.isRead)
    expect(readStates).toEqual(notifs.map((n) => n.indexedAt < seenAt))
    // reset last-seen
    await agent.api.app.bsky.notification.updateSeen(
      { seenAt: new Date(0).toISOString() },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationUpdateSeen,
        ),
        encoding: 'application/json',
      },
    )
  })

  it('fetches notifications omitting mentions and replies for taken-down posts', async () => {
    const postRef1 = sc.replies[sc.dids.carol][0].ref // Reply
    const postRef2 = sc.posts[sc.dids.dan][1].ref // Mention
    await Promise.all(
      [postRef1, postRef2].map((postRef) =>
        network.bsky.ctx.dataplane.takedownRecord({
          recordUri: postRef.uriStr,
        }),
      ),
    )

    const notifRes = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    const notifCount = await agent.api.app.bsky.notification.getUnreadCount(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationGetUnreadCount,
        ),
      },
    )

    const notifs = sortNotifs(notifRes.data.notifications)
    expect(notifs.length).toBe(11)
    expect(forSnapshot(notifs)).toMatchSnapshot()
    expect(notifCount.data.count).toBe(11)

    // Cleanup
    await Promise.all(
      [postRef1, postRef2].map((postRef) =>
        network.bsky.ctx.dataplane.untakedownRecord({
          recordUri: postRef.uriStr,
        }),
      ),
    )
  })

  it('fetches notifications with explicit priority', async () => {
    const priority = await agent.api.app.bsky.notification.listNotifications(
      { priority: true },
      {
        headers: await network.serviceHeaders(
          sc.dids.carol,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    // only notifs from follow (alice)
    expect(
      priority.data.notifications.every(
        (notif) => ![sc.dids.bob, sc.dids.dan].includes(notif.author.did),
      ),
    ).toBe(true)
    expect(forSnapshot(priority.data)).toMatchSnapshot()
    const noPriority = await agent.api.app.bsky.notification.listNotifications(
      { priority: false },
      {
        headers: await network.serviceHeaders(
          sc.dids.carol,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    expect(forSnapshot(noPriority.data)).toMatchSnapshot()
  })

  it('fetches notifications with default priority', async () => {
    await agent.api.app.bsky.notification.putPreferences(
      { priority: true },
      {
        encoding: 'application/json',
        headers: await network.serviceHeaders(
          sc.dids.carol,
          ids.AppBskyNotificationPutPreferences,
        ),
      },
    )
    await network.processAll()
    const notifs = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          sc.dids.carol,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    // only notifs from follow (alice)
    expect(
      notifs.data.notifications.every(
        (notif) => ![sc.dids.bob, sc.dids.dan].includes(notif.author.did),
      ),
    ).toBe(true)
    expect(forSnapshot(notifs.data)).toMatchSnapshot()
    await agent.api.app.bsky.notification.putPreferences(
      { priority: false },
      {
        encoding: 'application/json',
        headers: await network.serviceHeaders(
          sc.dids.carol,
          ids.AppBskyNotificationPutPreferences,
        ),
      },
    )
    await network.processAll()
  })

  it('filters notifications by reason', async () => {
    const res = await agent.app.bsky.notification.listNotifications(
      {
        reasons: ['mention'],
      },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    expect(res.data.notifications.length).toBe(1)
    expect(forSnapshot(res.data)).toMatchSnapshot()
  })

  it('filters notifications by multiple reasons', async () => {
    const res = await agent.app.bsky.notification.listNotifications(
      {
        reasons: ['mention', 'reply'],
      },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    expect(res.data.notifications.length).toBe(4)
    expect(forSnapshot(res.data)).toMatchSnapshot()
  })

  it('paginates filtered notifications', async () => {
    const results = (results: ListNotificationsOutputSchema[]) =>
      sortNotifs(results.flatMap((res) => res.notifications))
    const paginator = async (cursor?: string) => {
      const res = await agent.app.bsky.notification.listNotifications(
        { reasons: ['mention', 'reply'], cursor, limit: 2 },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyNotificationListNotifications,
          ),
        },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.notifications.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.app.bsky.notification.listNotifications(
      { reasons: ['mention', 'reply'] },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )

    expect(full.data.notifications.length).toBe(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  describe('handles hide tag filters', () => {
    beforeAll(async () => {
      const danPost = await sc.post(sc.dids.dan, 'hello friends')
      await network.processAll()
      const eveReply = await sc.reply(
        sc.dids.eve,
        danPost.ref,
        danPost.ref,
        'no thanks',
      )
      await network.processAll()
      await createTag(db, { uri: eveReply.ref.uri.toString(), val: TAG_HIDE })
    })

    it('filters posts with hide tag', async () => {
      const results = await agent.app.bsky.notification.listNotifications(
        { reasons: ['reply'] },
        {
          headers: await network.serviceHeaders(
            dan,
            ids.AppBskyNotificationListNotifications,
          ),
        },
      )
      expect(results.data.notifications.length).toEqual(0)
      expect(forSnapshot(results.data.notifications)).toMatchSnapshot()
    })

    it('shows posts with hide tag if they are followed', async () => {
      await sc.follow(dan, eve)
      await network.processAll()
      const results = await agent.app.bsky.notification.listNotifications(
        { reasons: ['reply'] },
        {
          headers: await network.serviceHeaders(
            dan,
            ids.AppBskyNotificationListNotifications,
          ),
        },
      )
      expect(results.data.notifications.length).toEqual(1)
      expect(forSnapshot(results.data.notifications)).toMatchSnapshot()
    })
  })

  describe('notifications delay', () => {
    const notificationsDelayMs = 5_000

    let delayNetwork: TestNetwork
    let delayAgent: AtpAgent
    let delaySc: SeedClient
    let delayAlice: string

    beforeAll(async () => {
      delayNetwork = await TestNetwork.create({
        bsky: {
          notificationsDelayMs,
        },
        dbPostgresSchema: 'bsky_views_notifications_delay',
      })
      delayAgent = delayNetwork.bsky.getClient()
      delaySc = delayNetwork.getSeedClient()
      await basicSeed(delaySc)
      await delayNetwork.processAll()
      delayAlice = delaySc.dids.alice

      // Add to reply chain, post ancestors: alice -> bob -> alice -> carol.
      // Should have added one notification for each of alice and bob.
      await delaySc.reply(
        delaySc.dids.carol,
        delaySc.posts[delayAlice][1].ref,
        delaySc.replies[delayAlice][0].ref,
        'indeed',
      )
      await delayNetwork.processAll()

      // @NOTE: Use fake timers after inserting seed data,
      // to avoid inserting all notifications with the same timestamp.
      jest.useFakeTimers({
        doNotFake: [
          'nextTick',
          'performance',
          'setImmediate',
          'setInterval',
          'setTimeout',
        ],
      })
    })

    afterAll(async () => {
      jest.useRealTimers()
      await delayNetwork.close()
    })

    it('paginates', async () => {
      const firstNotification = await delayNetwork.bsky.db.db
        .selectFrom('notification')
        .selectAll()
        .limit(1)
        .orderBy('sortAt', 'asc')
        .executeTakeFirstOrThrow()
      // Sets the system time to when the first notification happened.
      // At this point we won't have any notifications that already crossed the delay threshold.
      jest.setSystemTime(new Date(firstNotification.sortAt))

      const results = (results: ListNotificationsOutputSchema[]) =>
        sortNotifs(results.flatMap((res) => res.notifications))
      const paginator = async (cursor?: string) => {
        const res =
          await delayAgent.api.app.bsky.notification.listNotifications(
            { cursor, limit: 6 },
            {
              headers: await delayNetwork.serviceHeaders(
                delayAlice,
                ids.AppBskyNotificationListNotifications,
              ),
            },
          )
        return res.data
      }

      const paginatedAllBeforeDelay = await paginateAll(paginator)
      paginatedAllBeforeDelay.forEach((res) =>
        expect(res.notifications.length).toBe(0),
      )
      const fullBeforeDelay =
        await delayAgent.api.app.bsky.notification.listNotifications(
          {},
          {
            headers: await delayNetwork.serviceHeaders(
              delayAlice,
              ids.AppBskyNotificationListNotifications,
            ),
          },
        )

      expect(fullBeforeDelay.data.notifications.length).toEqual(0)
      expect(results(paginatedAllBeforeDelay)).toEqual(
        results([fullBeforeDelay.data]),
      )

      const lastNotification = await delayNetwork.bsky.db.db
        .selectFrom('notification')
        .selectAll()
        .limit(1)
        .orderBy('sortAt', 'desc')
        .executeTakeFirstOrThrow()
      // Sets the system time to when the last notification happened and the delay has elapsed.
      // At this point we all notifications already crossed the delay threshold.
      jest.setSystemTime(
        new Date(
          new Date(lastNotification.sortAt).getTime() +
            notificationsDelayMs +
            1,
        ),
      )

      const paginatedAllAfterDelay = await paginateAll(paginator)
      paginatedAllAfterDelay.forEach((res) =>
        expect(res.notifications.length).toBeLessThanOrEqual(6),
      )
      const fullAfterDelay =
        await delayAgent.api.app.bsky.notification.listNotifications(
          {},
          {
            headers: await delayNetwork.serviceHeaders(
              delayAlice,
              ids.AppBskyNotificationListNotifications,
            ),
          },
        )

      expect(fullAfterDelay.data.notifications.length).toEqual(13)
      expect(results(paginatedAllAfterDelay)).toEqual(
        results([fullAfterDelay.data]),
      )
    })

    describe('cursor delay', () => {
      const delay0s = 0
      const delay5s = 5_000

      const now = '2021-01-01T01:00:00.000Z'
      const nowMinus2s = '2021-01-01T00:59:58.000Z'
      const nowMinus5s = '2021-01-01T00:59:55.000Z'
      const nowMinus8s = '2021-01-01T00:59:52.000Z'

      beforeAll(async () => {
        jest.useFakeTimers({ doNotFake: ['performance'] })
        jest.setSystemTime(new Date(now))
      })

      afterAll(async () => {
        jest.useRealTimers()
      })

      describe('for undefined cursor', () => {
        it('returns now minus delay', async () => {
          const delayedCursor = delayCursor(undefined, delay5s)
          expect(delayedCursor).toBe(nowMinus5s)
        })

        it('returns now if delay is 0', async () => {
          const delayedCursor = delayCursor(undefined, delay0s)
          expect(delayedCursor).toBe(now)
        })
      })

      describe('for defined cursor', () => {
        it('returns original cursor if delay is 0', async () => {
          const originalCursor = nowMinus2s
          const delayedCursor = delayCursor(originalCursor, delay0s)
          expect(delayedCursor).toBe(originalCursor)
        })

        it('returns "now minus delay" for cursor that is after that', async () => {
          // Cursor is "now - 2s", should become "now - 5s"
          const originalCursor = nowMinus2s
          const cursor = delayCursor(originalCursor, delay5s)
          expect(cursor).toBe(nowMinus5s)
        })

        it('returns original cursor for cursor that is before "now minus delay"', async () => {
          // Cursor is "now - 8s", should stay like that.
          const originalCursor = nowMinus8s
          const cursor = delayCursor(originalCursor, delay5s)
          expect(cursor).toBe(originalCursor)
        })

        it('passes through a non-date cursor', async () => {
          const originalCursor = '123_abc'
          const cursor = delayCursor(originalCursor, delay5s)
          expect(cursor).toBe(originalCursor)
        })
      })
    })
  })

  describe('preferences v2', () => {
    beforeEach(async () => {
      await clearPrivateData(db)
    })

    // Defaults
    const fp: FilterablePreference = {
      include: 'all',
      list: true,
      push: true,
    }
    const p: Preference = {
      list: true,
      push: true,
    }
    const cp: ChatPreference = {
      include: 'all',
      push: true,
    }

    it('gets preferences filling up with the defaults', async () => {
      const actorDid = sc.dids.carol

      const getAndAssert = async (
        expectedApi: Preferences,
        expectedDb: Preferences | undefined,
      ) => {
        const { data } = await agent.app.bsky.notification.getPreferences(
          {},
          {
            headers: await network.serviceHeaders(
              actorDid,
              ids.AppBskyNotificationGetPreferences,
            ),
          },
        )
        expect(data.preferences).toStrictEqual(expectedApi)

        const dbResult = await db.db
          .selectFrom('private_data')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .where(
            'namespace',
            '=',
            Namespaces.AppBskyNotificationDefsPreferences,
          )
          .where('key', '=', 'self')
          .executeTakeFirst()
        if (dbResult === undefined) {
          expect(dbResult).toBe(expectedDb)
        } else {
          expect(dbResult).toStrictEqual({
            actorDid: actorDid,
            namespace: Namespaces.AppBskyNotificationDefsPreferences,
            key: 'self',
            indexedAt: expect.any(String),
            payload: expect.anything(), // Better to compare payload parsed.
            updatedAt: expect.any(String),
          })
          expect(JSON.parse(dbResult.payload)).toStrictEqual({
            $type: Namespaces.AppBskyNotificationDefsPreferences,
            ...expectedDb,
          })
        }
      }

      const expectedApi0: Preferences = {
        chat: cp,
        follow: fp,
        like: fp,
        likeViaRepost: fp,
        mention: fp,
        quote: fp,
        reply: fp,
        repost: fp,
        repostViaRepost: fp,
        starterpackJoined: p,
        subscribedPost: p,
        unverified: p,
        verified: p,
      }
      // The user has no preferences set yet, so nothing stored.
      const expectedDb0 = undefined
      await getAndAssert(expectedApi0, expectedDb0)

      await agent.app.bsky.notification.putPreferencesV2(
        { verified: { list: false, push: false } },
        {
          encoding: 'application/json',
          headers: await network.serviceHeaders(
            actorDid,
            ids.AppBskyNotificationPutPreferencesV2,
          ),
        },
      )
      await network.processAll()

      const expectedApi1: Preferences = {
        chat: cp,
        follow: fp,
        like: fp,
        likeViaRepost: fp,
        mention: fp,
        quote: fp,
        reply: fp,
        repost: fp,
        repostViaRepost: fp,
        starterpackJoined: p,
        subscribedPost: p,
        unverified: p,
        verified: { list: false, push: false },
      }
      // Stored all the defaults.
      const expectedDb1 = expectedApi1
      await getAndAssert(expectedApi1, expectedDb1)
    })

    it('stores the preferences setting the defaults', async () => {
      const actorDid = sc.dids.carol

      const putAndAssert = async (
        input: InputSchema,
        expected: Preferences,
      ) => {
        const { data } = await agent.app.bsky.notification.putPreferencesV2(
          input,
          {
            encoding: 'application/json',
            headers: await network.serviceHeaders(
              actorDid,
              ids.AppBskyNotificationPutPreferencesV2,
            ),
          },
        )
        await network.processAll()
        expect(data.preferences).toStrictEqual(expected)

        const dbResult = await db.db
          .selectFrom('private_data')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .where(
            'namespace',
            '=',
            Namespaces.AppBskyNotificationDefsPreferences,
          )
          .where('key', '=', 'self')
          .executeTakeFirstOrThrow()
        expect(dbResult).toStrictEqual({
          actorDid: actorDid,
          namespace: Namespaces.AppBskyNotificationDefsPreferences,
          key: 'self',
          indexedAt: expect.any(String),
          payload: expect.anything(), // Better to compare payload parsed.
          updatedAt: expect.any(String),
        })
        expect(JSON.parse(dbResult.payload)).toStrictEqual({
          $type: Namespaces.AppBskyNotificationDefsPreferences,
          ...expected,
        })
      }

      const input0 = {
        chat: {
          push: false,
          include: 'accepted',
        },
      }
      const expected0: Preferences = {
        chat: input0.chat,
        follow: fp,
        like: fp,
        likeViaRepost: fp,
        mention: fp,
        quote: fp,
        reply: fp,
        repost: fp,
        repostViaRepost: fp,
        starterpackJoined: p,
        subscribedPost: p,
        unverified: p,
        verified: p,
      }
      await putAndAssert(input0, expected0)

      const input1 = {
        mention: {
          list: false,
          push: false,
          include: 'follows',
        },
      }
      const expected1: Preferences = {
        // Kept from the previous call.
        chat: input0.chat,
        follow: fp,
        like: fp,
        likeViaRepost: fp,
        mention: input1.mention,
        quote: fp,
        reply: fp,
        repost: fp,
        repostViaRepost: fp,
        starterpackJoined: p,
        subscribedPost: p,
        unverified: p,
        verified: p,
      }
      await putAndAssert(input1, expected1)
    })
  })

  describe('activity subscriptions', () => {
    const sortProfiles = (profiles: ProfileView[]) => {
      return profiles.sort((a, b) => (a.handle > b.handle ? 1 : -1))
    }

    const declare = async (actor: string, value: string) => {
      await pdsAgent.com.atproto.repo.createRecord(
        {
          repo: actor,
          collection: ids.AppBskyNotificationDeclaration,
          rkey: 'self',
          record: {
            allowSubscriptions: value,
          } as AppBskyNotificationDeclaration.Record,
        },
        { headers: sc.getHeaders(actor), encoding: 'application/json' },
      )
    }

    const put = async (
      actor: string,
      subject: string,
      val: ActivitySubscription,
    ) =>
      agent.app.bsky.notification.putActivitySubscription(
        {
          subject,
          activitySubscription: val,
        },
        {
          headers: await network.serviceHeaders(
            actor,
            ids.AppBskyNotificationPutActivitySubscription,
          ),
        },
      )

    const list = async (actor: string, params?: QueryParams) =>
      agent.app.bsky.notification.listActivitySubscriptions(params ?? {}, {
        headers: await network.serviceHeaders(
          actor,
          ids.AppBskyNotificationListActivitySubscriptions,
        ),
      })

    const associatedAllowSub = async (actor: string, subject: string) => {
      const { data } = await agent.app.bsky.actor.getProfile(
        { actor: subject },
        {
          headers: await network.serviceHeaders(
            actor,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      return data.associated?.activitySubscription?.allowSubscriptions
    }

    const viewerActivitySub = async (actor: string, subject: string) => {
      const { data } = await agent.app.bsky.actor.getProfile(
        { actor: subject },
        {
          headers: await network.serviceHeaders(
            actor,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      return data.viewer?.activitySubscription
    }

    beforeAll(async () => {
      // 'none' declaration.
      await declare(bob, 'none')

      // 'mutuals' declaration and both follow.
      await declare(carol, 'mutuals')
      await sc.follow(alice, carol)
      await sc.follow(carol, alice)

      // 'mutuals' declaration but only actor follows.
      await declare(dan, 'mutuals')
      await sc.follow(alice, dan)

      // 'mutuals' declaration but only subject follows.
      await declare(eve, 'mutuals')
      await sc.follow(eve, alice)

      // 'followers' declaration and viewer follows.
      await declare(fred, 'followers')
      await sc.follow(alice, fred)

      // 'followers' declaration but viewer does not follow.
      await declare(greg, 'followers')

      // blocked.
      await declare(blocked, 'followers')
      await sc.block(alice, blocked)

      await network.processAll()
    })

    beforeEach(async () => {
      await clearActivitySubscription(db)
    })

    it('lists an empty list of subscriptions', async () => {
      const actorDid = alice

      const { data } = await list(actorDid)

      expect(data.cursor).toBeUndefined()
      expect(data.subscriptions).toHaveLength(0)
    })

    it('does not allow subscribing to self', async () => {
      const actorDid = alice
      const promise = put(actorDid, actorDid, { post: true, reply: false })

      await expect(promise).rejects.toThrow('Cannot subscribe to own activity')
    })

    it('inserts a subscription entry if it does not exist', async () => {
      const actorDid = alice
      const subjectDid = fred
      const val = { post: true, reply: false }

      const { data: createData } = await put(actorDid, subjectDid, val)
      expect(createData).toStrictEqual({
        subject: subjectDid,
        activitySubscription: val,
      })

      const { data: listData } = await list(actorDid)
      expect(listData).toEqual({
        cursor: expect.any(String),
        subscriptions: [
          expect.objectContaining({
            did: subjectDid,
            viewer: expect.objectContaining({ activitySubscription: val }),
          }),
        ],
      })
    })

    it('updates a subscription entry if it exists', async () => {
      const actorDid = alice
      const subjectDid = fred
      const valCreate = { post: true, reply: false }
      const valUpdate = { post: false, reply: true }

      const { data: createData } = await put(actorDid, subjectDid, valCreate)
      expect(createData).toStrictEqual({
        subject: subjectDid,
        activitySubscription: valCreate,
      })

      const { data: updateData } = await put(actorDid, subjectDid, valUpdate)
      expect(updateData).toStrictEqual({
        subject: subjectDid,
        activitySubscription: valUpdate,
      })

      const { data: listData } = await list(actorDid)
      expect(listData).toEqual({
        cursor: expect.any(String),
        subscriptions: [
          expect.objectContaining({
            did: subjectDid,
            viewer: expect.objectContaining({
              activitySubscription: valUpdate,
            }),
          }),
        ],
      })
    })

    it('deletes a subscription entry when all options are turned off', async () => {
      const actorDid = alice
      const subjectDid = fred
      const valCreate = { post: true, reply: false }
      const valDelete = { post: false, reply: false }

      await put(actorDid, subjectDid, valCreate)
      const { data: list0 } = await list(actorDid)
      expect(list0.subscriptions).toHaveLength(1)

      await put(actorDid, subjectDid, valDelete)
      const { data: list1 } = await list(actorDid)
      expect(list1.subscriptions).toHaveLength(0)
    })

    it('paginates', async () => {
      const actorDid = alice
      const limit = 2
      const val = { post: true, reply: false }

      await put(actorDid, bob, val)
      await put(actorDid, carol, val)
      await put(actorDid, dan, val)
      await put(actorDid, eve, val)
      await put(actorDid, fred, val)
      await put(actorDid, blocked, val) // blocked is removed from the list.

      const results = (results: ListActivitySubscriptionsOutputSchema[]) =>
        sortProfiles(
          results.flatMap(
            (res: ListActivitySubscriptionsOutputSchema) => res.subscriptions,
          ),
        )
      const paginator = async (cursor?: string) => {
        const { data } = await list(actorDid, { cursor, limit })
        return data
      }

      const paginatedAll = await paginateAll(paginator)
      paginatedAll.forEach((res) =>
        expect(res.subscriptions.length).toBeLessThanOrEqual(limit),
      )

      const full = await list(actorDid)
      expect(full.data.subscriptions.length).toEqual(5)
      expect(results(paginatedAll)).toEqual(results([full.data]))
    })

    it('gets the declaration record', async () => {
      const declaration = await pdsAgent.com.atproto.repo.getRecord({
        repo: carol,
        collection: 'app.bsky.notification.declaration',
        rkey: 'self',
      })

      expect(declaration.data.value.allowSubscriptions).toEqual('mutuals')
    })

    describe('activity subscription declaration', () => {
      it('includes the declaration in the profile view', async () => {
        await expect(associatedAllowSub(alice, bob)).resolves.toBe('none')
        await expect(associatedAllowSub(alice, carol)).resolves.toBe('mutuals')
        await expect(associatedAllowSub(alice, dan)).resolves.toBe('mutuals')
        await expect(associatedAllowSub(alice, eve)).resolves.toBe('mutuals')
        await expect(associatedAllowSub(alice, fred)).resolves.toBe('followers')
        await expect(associatedAllowSub(alice, greg)).resolves.toBe('followers')
      })
    })

    describe('activity subscription viewer state', () => {
      it('includes the relationship in the profile view', async () => {
        const viewer = alice
        const val = { post: true, reply: true }

        // 'none' declaration.
        await put(viewer, bob, val)
        await expect(viewerActivitySub(viewer, bob)).resolves.toBeUndefined()

        // 'mutuals' declaration and both follow.
        await put(viewer, carol, val)
        await expect(viewerActivitySub(viewer, carol)).resolves.toStrictEqual(
          val,
        )

        // 'mutuals' declaration but only actor follows.
        await put(viewer, dan, val)
        await expect(viewerActivitySub(viewer, dan)).resolves.toBeUndefined()

        // 'mutuals' declaration but only subject follows.
        await put(viewer, eve, val)
        await expect(viewerActivitySub(viewer, eve)).resolves.toBeUndefined()

        // 'followers' declaration and viewer follows.
        await put(viewer, fred, val)
        await expect(viewerActivitySub(viewer, carol)).resolves.toStrictEqual(
          val,
        )

        // 'followers' declaration but viewer does not follow.
        await expect(viewerActivitySub(viewer, greg)).resolves.toBeUndefined()

        // no declaration
        await expect(viewerActivitySub(viewer, han)).resolves.toBeUndefined()
      })
    })
  })
})

const clearPrivateData = async (db: Database) => {
  await db.db.deleteFrom('private_data').execute()
}

const clearActivitySubscription = async (db: Database) => {
  await db.db.deleteFrom('activity_subscription').execute()
}

const createTag = async (
  db: Database,
  opts: {
    uri: string
    val: string
  },
) => {
  await db.db
    .updateTable('record')
    .set({
      tags: JSON.stringify([opts.val]),
    })
    .where('uri', '=', opts.uri)
    .returningAll()
    .execute()
}
