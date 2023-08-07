import axios from 'axios'
import Database from './db'
import { UserNotification } from './db/tables/user-notification'
import { AppBskyEmbedImages, AtUri } from '@atproto/api'

const GORUSH_URL = 'https://push.bsky.app'
const PUSH_NOTIFICATION_ENDPOINT = '/api/push'
const BSKY_APP_ID = 'xyz.blueskyweb.app'
type Platform = 'ios' | 'android' | 'web'
type PushNotification = {
  tokens: string[]
  platform: 1 | 2 // 1 = ios, 2 = android
  title: string
  message: string
  topic: string
}

export class NotificationServer {
  db: Database
  notificationServerUrl: string
  pushNotificationEndpoint: string

  constructor(opts: { db: Database; notificationServerEndpoint?: string }) {
    const { db, notificationServerEndpoint } = opts
    this.db = db
    if (notificationServerEndpoint) {
      this.notificationServerUrl = notificationServerEndpoint
    } else {
      this.notificationServerUrl = GORUSH_URL + PUSH_NOTIFICATION_ENDPOINT
    }
  }

  platformEnumToNumber(platform: Platform) {
    switch (platform) {
      case 'ios':
        return 1
      case 'android':
        return 2
      case 'web':
        // TODO: support web notifications
        return undefined
      default:
        return undefined
    }
  }

  async getUserTokens(did: string) {
    const userTokens = await this.db.db
      .selectFrom('notification_push_token')
      .where('did', '=', did)
      .selectAll()
      .execute()

    if (!userTokens.length) {
      // TODO: replace this error with logging
      throw new Error('User has no push notification tokens')
    }
    return userTokens
  }

  async prepareNotifsToSend(notifications: UserNotification[]) {
    const notifsToSend: PushNotification[] = []

    for (const notif of notifications) {
      const { userDid } = notif
      const userTokens = await this.getUserTokens(userDid)

      for (let i = 0; i < userTokens.length; i++) {
        const { appId, platform, token } = userTokens[i]
        // get title and message of notification
        const attr = await this.getNotificationDisplayAttributes(notif)
        if (!attr) {
          throw new Error('Failed to get notification data')
        }
        const { title, body } = attr
        if (platform === 'ios') {
          notifsToSend.push({
            tokens: [token],
            platform: 1,
            title: title,
            message: body,
            topic: appId,
          })
        } else if (platform === 'android') {
          notifsToSend.push({
            tokens: [token],
            platform: 2,
            title: title,
            message: body,
            topic: appId,
          })
        } else {
          // TODO: Handle web notifs
        }
      }
    }

    return notifsToSend
  }

  async sendPushNotifications(notifications: PushNotification[]) {
    try {
      await axios.post(
        this.notificationServerUrl,
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
    } catch (error) {
      console.log(error) // TODO: delete this line
      throw new Error('Failed to send push notification')
    }
  }

  async registerDeviceForPushNotifications(
    did: string,
    platform: Platform,
    token: string,
    endpoint = this.notificationServerUrl,
    appId = BSKY_APP_ID,
  ) {
    try {
      // check if token already exists
      const existing = await this.db.db
        .selectFrom('notification_push_token')
        .where('did', '=', did)
        .where('token', '=', token)
        .execute()
      if (existing.length) {
        return
      }

      // if token doesn't exist, insert it
      await this.db.db
        .insertInto('notification_push_token')
        .values({
          did,
          token,
          platform,
          endpoint,
          appId,
        })
        .execute()
    } catch (error) {
      throw new Error('Failed to insert notification token')
    }
  }

  async registerPushNotificationsEndpoint() {}

  async registerPushNotificationsToken() {}

  async getNotificationDisplayAttributes(notif: UserNotification) {
    const {
      author: authorDid,
      reason,
      indexedAt,
      reasonSubject: subjectUri, // if like/reply/quote/emtion, the post which was liked/replied to/mention is in/or quoted. if custom feed liked, the feed which was liked
      recordCid,
      recordUri,
      userDid,
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
    const author = this.sanitizeDisplayName(displayName.displayName)

    // 2. Get post data content
    // if reply, quote, or mention, get URI of the postRecord
    // if like, or custom feed like, or repost get the URI of the reasonSubject
    // if follow, get the URI of the author's profile
    let title: string
    let body: string

    // check follow first because it doesn't have subjectUri
    if (reason === 'follow') {
      title = 'New follower!'
      body = `${author} has followed you`
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
      // TODO: do this in a better way
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
    } else if (reason === 'mention') {
      title = `${author} mentioned you`
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

      return { title, body }
    }
  }

  sanitizeDisplayName(str: string): string {
    // \u2705 = ✅
    // \u2713 = ✓
    // \u2714 = ✔
    // \u2611 = ☑
    const CHECK_MARKS_RE = /[\u2705\u2713\u2714\u2611]/gu
    if (typeof str === 'string') {
      return str.replace(CHECK_MARKS_RE, '').trim()
    }
    return ''
  }
}
