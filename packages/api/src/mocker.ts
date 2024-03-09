import {
  ComAtprotoLabelDefs,
  AppBskyFeedDefs,
  AppBskyActorDefs,
  AppBskyFeedPost,
  AppBskyEmbedRecord,
  AppBskyGraphDefs,
  AppBskyNotificationListNotifications,
} from './client'

const FAKE_CID = 'bafyreiclp443lavogvhj3d2ob2cxbfuscni2k5jk7bebjzg7khl3esabwq'

export const mock = {
  post({
    text,
    facets,
    reply,
    embed,
  }: {
    text: string
    facets?: AppBskyFeedPost.Record['facets']
    reply?: AppBskyFeedPost.ReplyRef
    embed?: AppBskyFeedPost.Record['embed']
  }): AppBskyFeedPost.Record {
    return {
      $type: 'app.bsky.feed.post',
      text,
      facets,
      reply,
      embed,
      langs: ['en'],
      createdAt: new Date().toISOString(),
    }
  },

  postView({
    record,
    author,
    embed,
    replyCount,
    repostCount,
    likeCount,
    viewer,
    labels,
  }: {
    record: AppBskyFeedPost.Record
    author: AppBskyActorDefs.ProfileViewBasic
    embed?: AppBskyFeedDefs.PostView['embed']
    replyCount?: number
    repostCount?: number
    likeCount?: number
    viewer?: AppBskyFeedDefs.ViewerState
    labels?: ComAtprotoLabelDefs.Label[]
  }): AppBskyFeedDefs.PostView {
    return {
      $type: 'app.bsky.feed.defs#postView',
      uri: `at://${author.did}/app.bsky.feed.post/fake`,
      cid: FAKE_CID,
      author,
      record,
      embed,
      replyCount,
      repostCount,
      likeCount,
      indexedAt: new Date().toISOString(),
      viewer,
      labels,
    }
  },

  embedRecordView({
    record,
    author,
    labels,
  }: {
    record: AppBskyFeedPost.Record
    author: AppBskyActorDefs.ProfileViewBasic
    labels?: ComAtprotoLabelDefs.Label[]
  }): AppBskyEmbedRecord.View {
    return {
      $type: 'app.bsky.embed.record#view',
      record: {
        $type: 'app.bsky.embed.record#viewRecord',
        uri: `at://${author.did}/app.bsky.feed.post/fake`,
        cid: FAKE_CID,
        author,
        value: record,
        labels,
        indexedAt: new Date().toISOString(),
      },
    }
  },

  profileViewBasic({
    handle,
    displayName,
    description,
    viewer,
    labels,
  }: {
    handle: string
    displayName?: string
    description?: string
    viewer?: AppBskyActorDefs.ViewerState
    labels?: ComAtprotoLabelDefs.Label[]
  }): AppBskyActorDefs.ProfileViewBasic {
    return {
      did: `did:web:${handle}`,
      handle,
      displayName,
      description, // technically not in ProfileViewBasic but useful in some cases
      viewer,
      labels,
    }
  },

  actorViewerState({
    muted,
    mutedByList,
    blockedBy,
    blocking,
    blockingByList,
    following,
    followedBy,
  }: {
    muted?: boolean
    mutedByList?: AppBskyGraphDefs.ListViewBasic
    blockedBy?: boolean
    blocking?: string
    blockingByList?: AppBskyGraphDefs.ListViewBasic
    following?: string
    followedBy?: string
  }): AppBskyActorDefs.ViewerState {
    return {
      muted,
      mutedByList,
      blockedBy,
      blocking,
      blockingByList,
      following,
      followedBy,
    }
  },

  listViewBasic({ name }: { name: string }): AppBskyGraphDefs.ListViewBasic {
    return {
      uri: 'at://did:plc:fake/app.bsky.graph.list/fake',
      cid: FAKE_CID,
      name,
      purpose: 'app.bsky.graph.defs#modlist',
      indexedAt: new Date().toISOString(),
    }
  },

  replyNotification({
    author,
    record,
    labels,
  }: {
    record: AppBskyFeedPost.Record
    author: AppBskyActorDefs.ProfileViewBasic
    labels?: ComAtprotoLabelDefs.Label[]
  }): AppBskyNotificationListNotifications.Notification {
    return {
      uri: `at://${author.did}/app.bsky.feed.post/fake`,
      cid: FAKE_CID,
      author,
      reason: 'reply',
      reasonSubject: `at://${author.did}/app.bsky.feed.post/fake-parent`,
      record,
      isRead: false,
      indexedAt: new Date().toISOString(),
      labels,
    }
  },

  followNotification({
    author,
    subjectDid,
    labels,
  }: {
    author: AppBskyActorDefs.ProfileViewBasic
    subjectDid: string
    labels?: ComAtprotoLabelDefs.Label[]
  }): AppBskyNotificationListNotifications.Notification {
    return {
      uri: `at://${author.did}/app.bsky.graph.follow/fake`,
      cid: FAKE_CID,
      author,
      reason: 'follow',
      record: {
        $type: 'app.bsky.graph.follow',
        createdAt: new Date().toISOString(),
        subject: subjectDid,
      },
      isRead: false,
      indexedAt: new Date().toISOString(),
      labels,
    }
  },

  label({
    val,
    uri,
    src,
  }: {
    val: string
    uri: string
    src?: string
  }): ComAtprotoLabelDefs.Label {
    return {
      src: src || 'did:plc:fake-labeler',
      uri,
      val,
      cts: new Date().toISOString(),
    }
  },
}
