import axios from 'axios'
import Database from './db'
import { Notification } from './db/tables/notification'
import { AppBskyEmbedImages, AtUri } from '@atproto/api'
import { Insertable } from 'kysely'

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

export class NotificationServer {
  constructor(public db: Database, public pushEndpoint?: string) {}

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
      if (!userTokens || userTokens.length === 0 || !attr) {
        continue
      }

      for (const t of userTokens) {
        const { appId, platform, token } = t
        // get title and message of notification
        // if no title or body, skip

        const { title, body } = attr
        if (platform === 'ios') {
          notifsToSend.push({
            tokens: [token],
            platform: 1,
            title: title,
            message: body,
            topic: appId,
            data: {
              reason: notif.reason,
              recordUri: notif.recordUri,
              recordCid: notif.recordCid,
            },
          })
        } else if (platform === 'android') {
          notifsToSend.push({
            tokens: [token],
            platform: 2,
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
          // TODO: Handle web notifs
        }
      }
    }
    return notifsToSend
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
  async sendPushNotifications(notifications: PushNotification[]) {
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

  async registerPushNotificationsEndpoint() {}

  async registerPushNotificationsToken() {}

  async getNotificationDisplayAttributes(notif: InsertableNotif) {
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
    if (!displayName || !displayName?.displayName) {
      throw new Error('Failed to get display name. User has no profile')
    }
    const author = displayName.displayName

    // 2. Get post data content
    // if reply, quote, or mention, get URI of the postRecord
    // if like, or custom feed like, or repost get the URI of the reasonSubject
    // if follow, get the URI of the author's profile
    let title = ''
    let body = ''

    // check follow first and mention first because they don't have subjectUri and return
    if (reason === 'follow') {
      title = 'New follower!'
      body = `${author} has followed you`
      return { title, body }
    } else if (reason === 'mention') {
      title = `${author} mentioned you`
      const mentionedPostData = await this.db.db
        .selectFrom('post')
        .where('uri', '=', recordUri)
        .selectAll()
        .executeTakeFirst()
      body = mentionedPostData?.text || ''
      return { title, body }
    }

    if (!subjectUri) {
      throw new Error('Failed to get subject URI')
    }

    const postData = await this.db.db
      .selectFrom('post')
      .where('uri', '=', subjectUri)
      .selectAll()
      .executeTakeFirst()
    if (!postData) {
      throw new Error('Failed to get post data')
    }

    if (reason === 'like') {
      title = `${author} liked your post`
      body = postData?.text || ''
      // custom feed like
      if (subjectUri?.includes('feed.generator')) {
        title = `${author} liked your custom feed`
        body = `${new AtUri(subjectUri).rkey}`
      }
    } else if (reason === 'reply') {
      title = `${author} replied to your post`
      body = postData?.text || ''
    } else if (reason === 'quote') {
      title = `${author} quoted your post`
      body = postData?.text || ''
    } else if (reason === 'repost') {
      title = `${author} reposted your post`
      body = postData?.text || ''

      // TODO: handle images
      // let image
      // if (
      //   AppBskyEmbedImages.isView(
      //     notification.additionalPost?.thread?.post.embed,
      //   ) &&
      //   notification.additionalPost?.thread?.post.embed.images[0]?.thumb
      // ) {
      //   image = notification.additionalPost.thread.post.embed.images[0].thumb
      // }
    }

    if (title === '' && body === '') {
      throw new Error('Failed to get title and body')
    }

    return { title: title, body: body }
  }
}
