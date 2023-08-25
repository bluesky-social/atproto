import axios from 'axios'
import { Insertable, sql } from 'kysely'
import TTLCache from '@isaacs/ttlcache'
import { AtUri } from '@atproto/api'
import { MINUTE, chunkArray } from '@atproto/common'
import Database from './db/primary'
import { Notification } from './db/tables/notification'
import { NotificationPushToken as PushToken } from './db/tables/notification-push-token'
import logger from './indexer/logger'
import { notSoftDeletedClause, valuesList } from './db/util'
import { ids } from './lexicon/lexicons'
import { retryHttp } from './util/retry'

export type Platform = 'ios' | 'android' | 'web'

type PushNotification = {
  tokens: string[]
  platform: 1 | 2 // 1 = ios, 2 = android
  title: string
  message: string
  topic: string
  data?: {
    [key: string]: string
  }
  collapse_id?: string
  collapse_key?: string
}

type InsertableNotif = Insertable<Notification>

type NotifDisplay = {
  key: string
  rateLimit: boolean
  title: string
  body: string
  notif: InsertableNotif
}

export class NotificationServer {
  private rateLimiter = new RateLimiter(1, 30 * MINUTE)

  constructor(public db: Database, public pushEndpoint?: string) {}

  async getTokensByDid(dids: string[]) {
    if (!dids.length) return {}
    const tokens = await this.db.db
      .selectFrom('notification_push_token')
      .where('did', 'in', dids)
      .selectAll()
      .execute()
    return tokens.reduce((acc, token) => {
      acc[token.did] ??= []
      acc[token.did].push(token)
      return acc
    }, {} as Record<string, PushToken[]>)
  }

  async prepareNotifsToSend(notifications: InsertableNotif[]) {
    const now = Date.now()
    const notifsToSend: PushNotification[] = []
    const tokensByDid = await this.getTokensByDid(
      unique(notifications.map((n) => n.did)),
    )
    // views for all notifications that have tokens
    const notificationViews = await this.getNotificationDisplayAttributes(
      notifications.filter((n) => tokensByDid[n.did]),
    )

    for (const notifView of notificationViews) {
      if (!isRecent(notifView.notif.sortAt, 10 * MINUTE)) {
        continue // if the notif is from > 10 minutes ago, don't send push notif
      }
      const { did: userDid } = notifView.notif
      const userTokens = tokensByDid[userDid] ?? []
      for (const t of userTokens) {
        const { appId, platform, token } = t
        if (notifView.rateLimit && !this.rateLimiter.check(token, now)) {
          continue
        }
        if (platform === 'ios' || platform === 'android') {
          notifsToSend.push({
            tokens: [token],
            platform: platform === 'ios' ? 1 : 2,
            title: notifView.title,
            message: notifView.body,
            topic: appId,
            data: {
              reason: notifView.notif.reason,
              recordUri: notifView.notif.recordUri,
              recordCid: notifView.notif.recordCid,
            },
            collapse_id: notifView.key,
            collapse_key: notifView.key,
          })
        } else {
          // @TODO: Handle web notifs
          logger.warn({ did: userDid }, 'cannot send web notification to user')
        }
      }
    }

    return notifsToSend
  }

  /**
   * The function `addNotificationsToQueue` adds push notifications to a queue, taking into account rate
   * limiting and batching the notifications for efficient processing.
   * @param {PushNotification[]} notifs - An array of PushNotification objects. Each PushNotification
   * object has a "tokens" property which is an array of tokens.
   * @returns void
   */
  async processNotifications(notifs: PushNotification[]) {
    for (const batch of chunkArray(notifs, 20)) {
      try {
        await this.sendPushNotifications(batch)
      } catch (err) {
        logger.error({ err, batch }, 'notification push batch failed')
      }
    }
  }

  /**  1. Get the user's token (APNS or FCM for iOS and Android respectively) from the database
    User token will be in the format:
        did || token || platform (1 = iOS, 2 = Android, 3 = Web)
    2. Send notification to `gorush` server with token
    Notification will be in the format:
    "notifications": [
      {
        "tokens": string[],
        "platform": 1 | 2,
        "message": string,
        "title": string,
        "priority": "normal" | "high",
        "image": string, (Android only)
        "expiration": number, (iOS only)
        "badge": number, (iOS only)
      }
    ]
    3. `gorush` will send notification to APNS or FCM
    4.  store response from `gorush` which contains the ID of the notification
    5. If notification needs to be updated or deleted, find the ID of the notification from the database and send a new notification to `gorush` with the ID (repeat step 2)
  */
  private async sendPushNotifications(notifications: PushNotification[]) {
    // if pushEndpoint is not defined, we are not running in the indexer service, so we can't send push notifications
    if (!this.pushEndpoint) {
      throw new Error('Push endpoint not defined')
    }
    // if no notifications, skip and return early
    if (notifications.length === 0) {
      return
    }
    const pushEndpoint = this.pushEndpoint
    await retryHttp(() =>
      axios.post(
        pushEndpoint,
        { notifications },
        {
          headers: {
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
        },
      ),
    )
  }

  async registerDeviceForPushNotifications(
    did: string,
    token: string,
    platform: Platform,
    appId: string,
  ) {
    // if token doesn't exist, insert it, on conflict do nothing
    await this.db.db
      .insertInto('notification_push_token')
      .values({ did, token, platform, appId })
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async getNotificationDisplayAttributes(
    notifs: InsertableNotif[],
  ): Promise<NotifDisplay[]> {
    const { ref } = this.db.db.dynamic
    const authorDids = notifs.map((n) => n.author)
    const subjectUris = notifs.flatMap((n) => n.reasonSubject ?? [])
    const recordUris = notifs.map((n) => n.recordUri)
    const allUris = [...subjectUris, ...recordUris]

    // gather potential display data for notifications in batch
    const [authors, posts, blocksAndMutes] = await Promise.all([
      this.db.db
        .selectFrom('actor')
        .leftJoin('profile', 'profile.creator', 'actor.did')
        .leftJoin('record', 'record.uri', 'profile.uri')
        .where(notSoftDeletedClause(ref('actor')))
        .where(notSoftDeletedClause(ref('record')))
        .where('profile.creator', 'in', authorDids.length ? authorDids : [''])
        .select(['actor.did as did', 'handle', 'displayName'])
        .execute(),
      this.db.db
        .selectFrom('post')
        .innerJoin('actor', 'actor.did', 'post.creator')
        .innerJoin('record', 'record.uri', 'post.uri')
        .where(notSoftDeletedClause(ref('actor')))
        .where(notSoftDeletedClause(ref('record')))
        .where('post.uri', 'in', allUris.length ? allUris : [''])
        .select(['post.uri as uri', 'text'])
        .execute(),
      this.findBlocksAndMutes(notifs),
    ])

    const authorsByDid = authors.reduce((acc, author) => {
      acc[author.did] = author
      return acc
    }, {} as Record<string, { displayName: string | null; handle: string | null }>)
    const postsByUri = posts.reduce((acc, post) => {
      acc[post.uri] = post
      return acc
    }, {} as Record<string, { text: string }>)

    const results: NotifDisplay[] = []

    for (const notif of notifs) {
      const {
        author: authorDid,
        reason,
        reasonSubject: subjectUri, // if like/reply/quote/mention, the post which was liked/replied to/mention is in/or quoted. if custom feed liked, the feed which was liked
        recordUri,
      } = notif

      const author =
        authorsByDid[authorDid]?.displayName || authorsByDid[authorDid]?.handle
      const postRecord = postsByUri[recordUri]
      const postSubject = subjectUri ? postsByUri[subjectUri] : null

      // if blocked or muted, don't send notification
      const shouldFilter = blocksAndMutes.some(
        (pair) => pair.author === notif.author && pair.receiver === notif.did,
      )
      if (shouldFilter || !author) {
        // if no display name, dont send notification
        continue
      }
      // const author = displayName.displayName

      // 2. Get post data content
      // if follow, get the URI of the author's profile
      // if reply, or mention, get URI of the postRecord
      // if like, or custom feed like, or repost get the URI of the reasonSubject
      const key = reason
      let title = ''
      let body = ''
      let rateLimit = true

      // check follow first and mention first because they don't have subjectUri and return
      // reply has subjectUri but the recordUri is the replied post
      if (reason === 'follow') {
        title = 'New follower!'
        body = `${author} has followed you`
        results.push({ key, title, body, notif, rateLimit })
        continue
      } else if (reason === 'mention' || reason === 'reply') {
        // use recordUri for mention and reply
        title =
          reason === 'mention'
            ? `${author} mentioned you`
            : `${author} replied to your post`
        body = postRecord?.text || ''
        rateLimit = false // always deliver
        results.push({ key, title, body, notif, rateLimit })
        continue
      }

      // if no subjectUri, don't send notification
      // at this point, subjectUri should exist for all the other reasons
      if (!postSubject) {
        continue
      }

      if (reason === 'like') {
        title = `${author} liked your post`
        body = postSubject?.text || ''
        // custom feed like
        const uri = subjectUri ? new AtUri(subjectUri) : null
        if (uri?.collection === ids.AppBskyFeedGenerator) {
          title = `${author} liked your custom feed`
          body = uri?.rkey ?? ''
        }
      } else if (reason === 'quote') {
        title = `${author} quoted your post`
        body = postSubject?.text || ''
        rateLimit = true // always deliver
      } else if (reason === 'repost') {
        title = `${author} reposted your post`
        body = postSubject?.text || ''
      }

      if (title === '' && body === '') {
        logger.warn(
          { notif },
          'No notification display attributes found for this notification. Either profile or post data for this notification is missing.',
        )
        continue
      }

      results.push({ key, title, body, notif, rateLimit })
    }

    return results
  }

  async findBlocksAndMutes(notifs: InsertableNotif[]) {
    const pairs = notifs.map((n) => ({ author: n.author, receiver: n.did }))
    const { ref } = this.db.db.dynamic
    const blockQb = this.db.db
      .selectFrom('actor_block')
      .where((outer) =>
        outer
          .where((qb) =>
            qb
              .whereRef('actor_block.creator', '=', ref('author'))
              .whereRef('actor_block.subjectDid', '=', ref('receiver')),
          )
          .orWhere((qb) =>
            qb
              .whereRef('actor_block.creator', '=', ref('receiver'))
              .whereRef('actor_block.subjectDid', '=', ref('author')),
          ),
      )
      .select(['creator', 'subjectDid'])
    const muteQb = this.db.db
      .selectFrom('mute')
      .whereRef('mute.subjectDid', '=', ref('author'))
      .whereRef('mute.mutedByDid', '=', ref('receiver'))
      .selectAll()
    const muteListQb = this.db.db
      .selectFrom('list_item')
      .innerJoin('list_mute', 'list_mute.listUri', 'list_item.listUri')
      .whereRef('list_mute.mutedByDid', '=', ref('receiver'))
      .whereRef('list_item.subjectDid', '=', ref('author'))
      .select('list_item.subjectDid')

    const values = valuesList(pairs.map((p) => sql`${p.author}, ${p.receiver}`))
    const filterPairs = await this.db.db
      .selectFrom(values.as(sql`pair (author, receiver)`))
      .whereExists(muteQb)
      .orWhereExists(muteListQb)
      .orWhereExists(blockQb)
      .selectAll()
      .execute()
    return filterPairs as { author: string; receiver: string }[]
  }
}

const isRecent = (isoTime: string, timeDiff: number): boolean => {
  const diff = Date.now() - new Date(isoTime).getTime()
  return diff < timeDiff
}

const unique = (items: string[]) => [...new Set(items)]

class RateLimiter {
  private rateLimitCache = new TTLCache<string, number>({
    max: 50000,
    ttl: this.windowMs,
    noUpdateTTL: true,
  })
  constructor(private limit: number, private windowMs: number) {}
  check(token: string, now = Date.now()) {
    const key = getRateLimitKey(token, now)
    const last = this.rateLimitCache.get(key) ?? 0
    const current = last + 1
    this.rateLimitCache.set(key, current)
    return current <= this.limit
  }
}

const getRateLimitKey = (token: string, now: number) => {
  const iteration = Math.floor(now / (20 * MINUTE))
  return `${iteration}:${token}`
}
