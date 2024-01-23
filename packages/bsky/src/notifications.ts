import axios from 'axios'
import { Insertable, sql } from 'kysely'
import TTLCache from '@isaacs/ttlcache'
import { Struct, Timestamp } from '@bufbuild/protobuf'
import murmur from 'murmurhash'
import { AtUri } from '@atproto/api'
import { MINUTE, chunkArray } from '@atproto/common'
import Database from './db/primary'
import { Notification } from './db/tables/notification'
import { NotificationPushToken as PushToken } from './db/tables/notification-push-token'
import logger from './indexer/logger'
import { notSoftDeletedClause, valuesList } from './db/util'
import { ids } from './lexicon/lexicons'
import { retryConnect, retryHttp } from './util/retry'
import { Notification as CourierNotification } from './proto/courier_pb'
import { CourierClient } from './courier'

export type Platform = 'ios' | 'android' | 'web'

type GorushNotification = {
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

type NotifRow = Insertable<Notification>

type NotifView = {
  key: string
  rateLimit: boolean
  title: string
  body: string
  notif: NotifRow
}

export abstract class NotificationServer<N = unknown> {
  constructor(public db: Database) {}

  abstract prepareNotifications(notifs: NotifRow[]): Promise<N[]>

  abstract processNotifications(prepared: N[]): Promise<void>

  async getNotificationViews(notifs: NotifRow[]): Promise<NotifView[]> {
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

    const results: NotifView[] = []

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

  private async findBlocksAndMutes(notifs: NotifRow[]) {
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

export class GorushNotificationServer extends NotificationServer<GorushNotification> {
  private rateLimiter = new RateLimiter(1, 30 * MINUTE)

  constructor(public db: Database, public pushEndpoint: string) {
    super(db)
  }

  async prepareNotifications(
    notifs: NotifRow[],
  ): Promise<GorushNotification[]> {
    const now = Date.now()
    const notifsToSend: GorushNotification[] = []
    const tokensByDid = await this.getTokensByDid(
      unique(notifs.map((n) => n.did)),
    )
    // views for all notifications that have tokens
    const notificationViews = await this.getNotificationViews(
      notifs.filter((n) => tokensByDid[n.did]),
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

  async processNotifications(prepared: GorushNotification[]): Promise<void> {
    for (const batch of chunkArray(prepared, 20)) {
      try {
        await this.sendToGorush(batch)
      } catch (err) {
        logger.error({ err, batch }, 'notification push batch failed')
      }
    }
  }

  private async sendToGorush(prepared: GorushNotification[]) {
    // if no notifications, skip and return early
    if (prepared.length === 0) {
      return
    }
    const pushEndpoint = this.pushEndpoint
    await retryHttp(() =>
      axios.post(
        pushEndpoint,
        { notifications: prepared },
        {
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
        },
      ),
    )
  }
}

export class CourierNotificationServer extends NotificationServer<CourierNotification> {
  constructor(public db: Database, public courierClient: CourierClient) {
    super(db)
  }

  async prepareNotifications(
    notifs: NotifRow[],
  ): Promise<CourierNotification[]> {
    const notificationViews = await this.getNotificationViews(notifs)
    const notifsToSend = notificationViews.map((n) => {
      return new CourierNotification({
        id: getCourierId(n),
        recipientDid: n.notif.did,
        title: n.title,
        message: n.body,
        collapseKey: n.key,
        alwaysDeliver: !n.rateLimit,
        timestamp: Timestamp.fromDate(new Date(n.notif.sortAt)),
        additional: Struct.fromJson({
          uri: n.notif.recordUri,
          reason: n.notif.reason,
          subject: n.notif.reasonSubject || '',
        }),
      })
    })
    return notifsToSend
  }

  async processNotifications(prepared: CourierNotification[]): Promise<void> {
    try {
      await retryConnect(() =>
        this.courierClient.pushNotifications({ notifications: prepared }),
      )
    } catch (err) {
      logger.error({ err }, 'notification push to courier failed')
    }
  }
}

const getCourierId = (notif: NotifView) => {
  const key = [
    notif.notif.recordUri,
    notif.notif.did,
    notif.notif.reason,
    notif.notif.reasonSubject || '',
  ].join('::')
  return murmur.v3(key).toString(16)
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
