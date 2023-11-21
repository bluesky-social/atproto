import {
  AtpAgentFetchHandlerResponse,
  ComAtprotoLabelDefs,
  AppBskyFeedDefs,
  AppBskyActorDefs,
  AppBskyFeedPost,
  AppBskyEmbedRecord,
  AppBskyGraphDefs,
} from '../../src'

export async function fetchHandler(
  httpUri: string,
  httpMethod: string,
  httpHeaders: Record<string, string>,
  httpReqBody: unknown,
): Promise<AtpAgentFetchHandlerResponse> {
  // The duplex field is now required for streaming bodies, but not yet reflected
  // anywhere in docs or types. See whatwg/fetch#1438, nodejs/node#46221.
  const reqInit: RequestInit & { duplex: string } = {
    method: httpMethod,
    headers: httpHeaders,
    body: httpReqBody
      ? new TextEncoder().encode(JSON.stringify(httpReqBody))
      : undefined,
    duplex: 'half',
  }
  const res = await fetch(httpUri, reqInit)
  const resBody = await res.arrayBuffer()
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: resBody ? JSON.parse(new TextDecoder().decode(resBody)) : undefined,
  }
}

export const mock = {
  post({
    text,
    reply,
    embed,
  }: {
    text: string
    reply?: AppBskyFeedPost.ReplyRef
    embed?: AppBskyFeedPost.Record['embed']
  }): AppBskyFeedPost.Record {
    return {
      $type: 'app.bsky.feed.post',
      text,
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
      uri: `at://${author.did}/app.bsky.post/fake`,
      cid: 'fake',
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
        uri: `at://${author.did}/app.bsky.post/fake`,
        cid: 'fake',
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
    viewer,
    labels,
  }: {
    handle: string
    displayName?: string
    viewer?: AppBskyActorDefs.ViewerState
    labels?: ComAtprotoLabelDefs.Label[]
  }): AppBskyActorDefs.ProfileViewBasic {
    return {
      did: `did:web:${handle}`,
      handle,
      displayName,
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
      cid: 'fake',
      name,
      purpose: 'app.bsky.graph.defs#modlist',
      indexedAt: new Date().toISOString(),
    }
  },

  label({ val, uri }: { val: string; uri: string }): ComAtprotoLabelDefs.Label {
    return {
      src: 'did:plc:fake-labeler',
      uri,
      val,
      cts: new Date().toISOString(),
    }
  },
}
