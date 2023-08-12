import axios from 'axios'
import Database from './db'
import { Notification } from './db/tables/notification'
import { AtUri } from '@atproto/api'
import { Insertable } from 'kysely'
import logger from './indexer/logger'
import { BackgroundQueue } from './background'
import { ServerConfig } from './config'

type Platform = 'ios' | 'android' | 'web'
type PushNotification = {
  tokens: string[]
  platform: 1 | 2 // 1 = ios, 2 = android
  title: string
  message: string
  topic: string
  data?: {
    [key: string]: string
  }
}
type InsertableNotif = Insertable<Notification>
const NOTIFICATION_BATCH_SIZE = ServerConfig.readEnv().debugMode ? 2 : 50 // if debug mode, send 2 notifications at a time, otherwise send 50
export class NotificationServer {
  private notificationBatch: PushNotification[] = []
  private userNotificationRateLimit: Map<string, { timestamps: Date[] }> =
    new Map() // key is token, value is timestamps of notifications
  private backgroundQueue: BackgroundQueue

  constructor(public db: Database, public pushEndpoint?: string) {
    this.backgroundQueue = new BackgroundQueue(db)
  }

  async getUserTokens(did: string) {
    const userTokens = await this.db.db
      .selectFrom('notification_push_token')
      .where('did', '=', did)
      .selectAll()
      .execute()

    return userTokens
  }

  async prepareNotifsToSend(notifications: InsertableNotif[]) {
    const notifsToSend: PushNotification[] = []

    for (const notif of notifications) {
      const { did: userDid } = notif
      const userTokens = await this.getUserTokens(userDid)
      const attr = await this.getNotificationDisplayAttributes(notif)
      // if user has no tokens or the post attr cannot be found, skip
      if (!userTokens || userTokens.length === 0) {
        continue
      }
      if (!attr) {
        logger.warn(
          {
            userDid,
            notif,
          },
          'No notification display attributes found for this notification. Either profile or post data for this notification is missing.',
        )
        continue
      }
      const { title, body } = attr

      for (const t of userTokens) {
        const { appId, platform, token } = t
        if (platform === 'ios' || platform === 'android') {
          notifsToSend.push({
            tokens: [token],
            platform: platform === 'ios' ? 1 : 2,
            title: title,
            message: body,
            topic: appId,
            data: {
              reason: notif.reason,
              recordUri: notif.recordUri,
              recordCid: notif.recordCid,
            },
          })
        } else {
          // @TODO: Handle web notifs
        }
      }
    }
    return notifsToSend
  }

  async addNotificationsToQueue(notifs: PushNotification[]) {
    for (const notif of notifs) {
      const { tokens } = notif
      const token = tokens[0]
      // Rate limiting
      const userRateData = this.userNotificationRateLimit.get(token) || {
        timestamps: [],
      }
      const now = new Date()
      userRateData.timestamps = userRateData.timestamps.filter(
        (timestamp) => now.getTime() - timestamp.getTime() < 20 * 60 * 1000,
      )

      if (userRateData.timestamps.length >= 20) {
        // Skip adding notification to be sent as the rate limit reached
        return
      }

      // Add to rate limit
      userRateData.timestamps.push(now)
      this.userNotificationRateLimit.set(token, userRateData)

      // Add to batch
      this.notificationBatch.push(notif)

      // If batch size is 20, add task to background queue
      if (this.notificationBatch.length >= NOTIFICATION_BATCH_SIZE) {
        try {
          this.backgroundQueue.add(async () => {
            return await this.sendPushNotifications(this.notificationBatch)
          })
        } catch (error) {
          logger.error({
            notificationBatch: this.notificationBatch,
            error,
          })
        } finally {
          this.notificationBatch = []
        }
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
    // if no notifications, skip and return early
    if (!notifications || notifications.length === 0) {
      return
    }
    // if pushEndpoint is not defined, we are not running in the indexer service, so we can't send push notifications
    if (!this.pushEndpoint) {
      throw new Error('Push endpoint not defined')
    }
    await axios.post(
      this.pushEndpoint,
      {
        notifications: notifications,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
      },
    )
  }

  async registerDeviceForPushNotifications(
    did: string,
    platform: Platform,
    token: string,
    appId: string,
    endpoint: string,
  ) {
    // if token doesn't exist, insert it, on conflict do nothing
    await this.db.db
      .insertInto('notification_push_token')
      .values({
        did,
        token,
        platform,
        appId,
        endpoint,
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async getNotificationDisplayAttributes(
    notif: InsertableNotif,
  ): Promise<{ title: string; body: string } | undefined> {
    const {
      author: authorDid,
      reason,
      reasonSubject: subjectUri, // if like/reply/quote/emtion, the post which was liked/replied to/mention is in/or quoted. if custom feed liked, the feed which was liked
      recordUri,
    } = notif
    // 1. Get author's display name
    const displayName = await this.db.db
      .selectFrom('profile')
      .where('creator', '=', authorDid)
      .select(['displayName'])
      .executeTakeFirst()

    // if no display name, dont send notification
    if (!displayName || !displayName?.displayName) {
      return
    }
    const author = displayName.displayName

    // 2. Get post data content
    // if follow, get the URI of the author's profile
    // if reply, or mention, get URI of the postRecord
    // if like, or custom feed like, or repost get the URI of the reasonSubject
    let title = ''
    let body = ''

    // check follow first and mention first because they don't have subjectUri and return
    // reply has subjectUri but the recordUri is the replied post
    if (reason === 'follow') {
      title = 'New follower!'
      body = `${author} has followed you`
      return { title, body }
    } else if (reason === 'mention' || reason === 'reply') {
      // use recordUri for mention and reply
      title =
        reason === 'mention'
          ? `${author} mentioned you`
          : `${author} replied to your post`
      const postData = await this.db.db
        .selectFrom('post')
        .where('uri', '=', recordUri)
        .selectAll()
        .executeTakeFirst()
      body = postData?.text || ''
      return { title, body }
    }

    // if no subjectUri, don't send notification
    // at this point, subjectUri should exist for all the other reasons
    if (!subjectUri) {
      return
    }

    // if no post data, don't send notification
    const postData = await this.db.db
      .selectFrom('post')
      .where('uri', '=', subjectUri)
      .selectAll()
      .executeTakeFirst()
    if (!postData) {
      return
    }

    if (reason === 'like') {
      title = `${author} liked your post`
      body = postData?.text || ''
      // custom feed like
      if (subjectUri?.includes('feed.generator')) {
        title = `${author} liked your custom feed`
        body = `${new AtUri(subjectUri).rkey}`
      }
    } else if (reason === 'quote') {
      title = `${author} quoted your post`
      body = postData?.text || ''
    } else if (reason === 'repost') {
      title = `${author} reposted your post`
      body = postData?.text || ''
    }

    if (title === '' && body === '') {
      logger.warn(
        {
          notif,
        },
        'No notification display attributes found for this notification. Either profile or post data for this notification is missing.',
      )
      return
    }

    return { title: title, body: body }
  }
}
