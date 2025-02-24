import { mapDefined } from '@atproto/common'
import { AtUri, INVALID_HANDLE, normalizeDatetimeAlways } from '@atproto/syntax'
import { ProfileViewerState } from '../hydration/actor'
import { FeedItem, Like, Post, Repost } from '../hydration/feed'
import { Follow } from '../hydration/graph'
import { HydrationState } from '../hydration/hydrator'
import { Label } from '../hydration/label'
import { RecordInfo } from '../hydration/util'
import { ImageUriBuilder } from '../image/uri'
import { ids } from '../lexicon/lexicons'
import {
  KnownFollowers,
  ProfileView,
  ProfileViewBasic,
  ProfileViewDetailed,
  ViewerState as ProfileViewer,
} from '../lexicon/types/app/bsky/actor/defs'
import {
  Record as ProfileRecord,
  isRecord as isProfileRecord,
} from '../lexicon/types/app/bsky/actor/profile'
import {
  BlockedPost,
  FeedViewPost,
  GeneratorView,
  NotFoundPost,
  PostView,
  ReasonPin,
  ReasonRepost,
  ReplyRef,
  ThreadViewPost,
  ThreadgateView,
  isPostView,
} from '../lexicon/types/app/bsky/feed/defs'
import { Record as LikeRecord } from '../lexicon/types/app/bsky/feed/like'
import {
  Record as PostRecord,
  isRecord as isPostRecord,
} from '../lexicon/types/app/bsky/feed/post'
import { Record as RepostRecord } from '../lexicon/types/app/bsky/feed/repost'
import { isListRule } from '../lexicon/types/app/bsky/feed/threadgate'
import {
  ListView,
  ListViewBasic,
  StarterPackView,
  StarterPackViewBasic,
} from '../lexicon/types/app/bsky/graph/defs'
import { Record as FollowRecord } from '../lexicon/types/app/bsky/graph/follow'
import {
  LabelerView,
  LabelerViewDetailed,
} from '../lexicon/types/app/bsky/labeler/defs'
import {
  Record as LabelerRecord,
  isRecord as isLabelerRecord,
} from '../lexicon/types/app/bsky/labeler/service'
import { isSelfLabels } from '../lexicon/types/com/atproto/label/defs'
import { $Typed, Un$Typed } from '../lexicon/util'
import { Notification } from '../proto/bsky_pb'
import {
  postUriToPostgateUri,
  postUriToThreadgateUri,
  safePinnedPost,
  uriToDid,
  uriToDid as creatorFromUri,
} from '../util/uris'
import {
  Embed,
  EmbedBlocked,
  EmbedDetached,
  EmbedNotFound,
  EmbedView,
  ExternalEmbed,
  ExternalEmbedView,
  ImagesEmbed,
  ImagesEmbedView,
  MaybePostView,
  NotificationView,
  PostEmbedView,
  RecordEmbed,
  RecordEmbedView,
  RecordEmbedViewInternal,
  RecordWithMedia,
  RecordWithMediaView,
  VideoEmbed,
  VideoEmbedView,
  isExternalEmbed,
  isImagesEmbed,
  isRecordEmbed,
  isRecordWithMedia,
  isVideoEmbed,
} from './types'
import {
  VideoUriBuilder,
  cidFromBlobJson,
  parsePostgate,
  parseThreadGate,
} from './util'

export class Views {
  public imgUriBuilder: ImageUriBuilder = this.opts.imgUriBuilder
  public videoUriBuilder: VideoUriBuilder = this.opts.videoUriBuilder
  public indexedAtEpoch: Date | undefined = this.opts.indexedAtEpoch
  constructor(
    private opts: {
      imgUriBuilder: ImageUriBuilder
      videoUriBuilder: VideoUriBuilder
      indexedAtEpoch: Date | undefined
    },
  ) {}

  // Actor
  // ------------

  actorIsNoHosted(did: string, state: HydrationState): boolean {
    return (
      this.actorIsDeactivated(did, state) || this.actorIsTakendown(did, state)
    )
  }

  actorIsDeactivated(did: string, state: HydrationState): boolean {
    if (state.actors?.get(did)?.upstreamStatus === 'deactivated') return true
    return false
  }

  actorIsTakendown(did: string, state: HydrationState): boolean {
    const actor = state.actors?.get(did)
    if (actor?.takedownRef) return true
    if (actor?.upstreamStatus === 'takendown') return true
    if (actor?.upstreamStatus === 'suspended') return true
    if (state.labels?.get(did)?.isTakendown) return true
    return false
  }

  viewerBlockExists(did: string, state: HydrationState): boolean {
    const actor = state.profileViewers?.get(did)
    if (!actor) return false
    return !!(
      actor.blockedBy ||
      actor.blocking ||
      this.blockedByList(actor, state) ||
      this.blockingByList(actor, state)
    )
  }

  viewerMuteExists(did: string, state: HydrationState): boolean {
    const actor = state.profileViewers?.get(did)
    if (!actor) return false
    return !!(actor.muted || this.mutedByList(actor, state))
  }

  blockingByList(viewer: ProfileViewerState, state: HydrationState) {
    return (
      viewer.blockingByList && this.recordActive(viewer.blockingByList, state)
    )
  }

  blockedByList(viewer: ProfileViewerState, state: HydrationState) {
    return (
      viewer.blockedByList && this.recordActive(viewer.blockedByList, state)
    )
  }

  mutedByList(viewer: ProfileViewerState, state: HydrationState) {
    return viewer.mutedByList && this.recordActive(viewer.mutedByList, state)
  }

  recordActive(uri: string, state: HydrationState) {
    const did = uriToDid(uri)
    const actor = state.actors?.get(did)
    if (!actor || this.actorIsTakendown(did, state)) {
      // actor may not be present when takedowns are eagerly applied during hydration.
      // so it's important to _try_ to hydrate the actor for records checked this way.
      return
    }
    return uri
  }

  viewerSeesNeedsReview(
    { did, uri }: { did?: string; uri?: string },
    state: HydrationState,
  ): boolean {
    const { labels, profileViewers, ctx } = state
    did = did || (uri && uriToDid(uri))
    if (!did) {
      return true
    }
    if (
      labels?.get(did)?.needsReview ||
      (uri && labels?.get(uri)?.needsReview)
    ) {
      // content marked as needs review
      return ctx?.viewer === did || !!profileViewers?.get(did)?.following
    }
    return true
  }

  replyIsHiddenByThreadgate(
    replyUri: string,
    rootPostUri: string,
    state: HydrationState,
  ) {
    const threadgateUri = postUriToThreadgateUri(rootPostUri)
    const threadgate = state.threadgates?.get(threadgateUri)
    return !!threadgate?.record?.hiddenReplies?.includes(replyUri)
  }

  profileDetailed(
    did: string,
    state: HydrationState,
  ): Un$Typed<ProfileViewDetailed> | undefined {
    const actor = state.actors?.get(did)
    if (!actor) return
    const baseView = this.profile(did, state)
    if (!baseView) return
    const knownFollowers = this.knownFollowers(did, state)
    const profileAggs = state.profileAggs?.get(did)
    return {
      ...baseView,
      viewer: baseView.viewer
        ? {
            ...baseView.viewer,
            knownFollowers,
          }
        : undefined,
      banner: actor.profile?.banner
        ? this.imgUriBuilder.getPresetUri(
            'banner',
            did,
            cidFromBlobJson(actor.profile.banner),
          )
        : undefined,
      followersCount: profileAggs?.followers ?? 0,
      followsCount: profileAggs?.follows ?? 0,
      postsCount: profileAggs?.posts ?? 0,
      associated: {
        lists: profileAggs?.lists,
        feedgens: profileAggs?.feeds,
        starterPacks: profileAggs?.starterPacks,
        labeler: actor.isLabeler,
        // @TODO apply default chat policy?
        chat: actor.allowIncomingChatsFrom
          ? { allowIncoming: actor.allowIncomingChatsFrom }
          : undefined,
      },
      joinedViaStarterPack: actor.profile?.joinedViaStarterPack
        ? this.starterPackBasic(actor.profile.joinedViaStarterPack.uri, state)
        : undefined,
      pinnedPost: safePinnedPost(actor.profile?.pinnedPost),
    }
  }

  profile(
    did: string,
    state: HydrationState,
  ): Un$Typed<ProfileView> | undefined {
    const actor = state.actors?.get(did)
    if (!actor) return
    const basicView = this.profileBasic(did, state)
    if (!basicView) return
    return {
      ...basicView,
      description: actor.profile?.description || undefined,
      indexedAt:
        actor.indexedAt && actor.sortedAt
          ? this.indexedAt({
              sortedAt: actor.sortedAt,
              indexedAt: actor.indexedAt,
            }).toISOString()
          : undefined,
    }
  }

  profileBasic(
    did: string,
    state: HydrationState,
  ): Un$Typed<ProfileViewBasic> | undefined {
    const actor = state.actors?.get(did)
    if (!actor) return
    const profileUri = AtUri.make(
      did,
      ids.AppBskyActorProfile,
      'self',
    ).toString()
    const labels = [
      ...(state.labels?.getBySubject(did) ?? []),
      ...(state.labels?.getBySubject(profileUri) ?? []),
      ...this.selfLabels({
        uri: profileUri,
        cid: actor.profileCid?.toString(),
        record: actor.profile,
      }),
    ]
    return {
      did,
      handle: actor.handle ?? INVALID_HANDLE,
      displayName: actor.profile?.displayName,
      avatar: actor.profile?.avatar
        ? this.imgUriBuilder.getPresetUri(
            'avatar',
            did,
            cidFromBlobJson(actor.profile.avatar),
          )
        : undefined,
      // associated.feedgens and associated.lists info not necessarily included
      // on profile and profile-basic views, but should be on profile-detailed.
      associated:
        actor.isLabeler || actor.allowIncomingChatsFrom
          ? {
              labeler: actor.isLabeler ? true : undefined,
              // @TODO apply default chat policy?
              chat: actor.allowIncomingChatsFrom
                ? { allowIncoming: actor.allowIncomingChatsFrom }
                : undefined,
            }
          : undefined,
      viewer: this.profileViewer(did, state),
      labels,
      createdAt: actor.createdAt?.toISOString(),
    }
  }

  profileKnownFollowers(
    did: string,
    state: HydrationState,
  ): ProfileView | undefined {
    const actor = state.actors?.get(did)
    if (!actor) return
    const baseView = this.profile(did, state)
    if (!baseView) return
    const knownFollowers = this.knownFollowers(did, state)
    return {
      ...baseView,
      viewer: baseView.viewer
        ? {
            ...baseView.viewer,
            knownFollowers,
          }
        : undefined,
    }
  }

  profileViewer(did: string, state: HydrationState): ProfileViewer | undefined {
    const viewer = state.profileViewers?.get(did)
    if (!viewer) return
    const blockedByList = this.blockedByList(viewer, state)
    const blockedByUri = viewer.blockedBy || blockedByList
    const blockingByList = this.blockingByList(viewer, state)
    const blockingUri = viewer.blocking || blockingByList
    const block = !!blockedByUri || !!blockingUri
    const mutedByList = this.mutedByList(viewer, state)
    return {
      muted: !!(viewer.muted || mutedByList),
      mutedByList: mutedByList ? this.listBasic(mutedByList, state) : undefined,
      blockedBy: !!blockedByUri,
      blocking: blockingUri,
      blockingByList: blockingByList
        ? this.listBasic(blockingByList, state)
        : undefined,
      following: viewer.following && !block ? viewer.following : undefined,
      followedBy: viewer.followedBy && !block ? viewer.followedBy : undefined,
    }
  }

  knownFollowers(
    did: string,
    state: HydrationState,
  ): KnownFollowers | undefined {
    const knownFollowers = state.knownFollowers?.get(did)
    if (!knownFollowers) return
    const blocks = state.bidirectionalBlocks?.get(did)
    const followers = mapDefined(knownFollowers.followers, (followerDid) => {
      if (this.viewerBlockExists(followerDid, state)) {
        return undefined
      }
      if (blocks?.get(followerDid) === true) {
        return undefined
      }
      if (this.actorIsNoHosted(followerDid, state)) {
        // @TODO only needed right now to work around getProfile's { includeTakedowns: true }
        return undefined
      }
      return this.profileBasic(followerDid, state)
    })
    return { count: knownFollowers.count, followers }
  }

  blockedProfileViewer(
    did: string,
    state: HydrationState,
  ): ProfileViewer | undefined {
    const viewer = state.profileViewers?.get(did)
    if (!viewer) return
    const blockedByUri = viewer.blockedBy || this.blockedByList(viewer, state)
    const blockingUri = viewer.blocking || this.blockingByList(viewer, state)
    return {
      blockedBy: !!blockedByUri,
      blocking: blockingUri,
    }
  }

  // Graph
  // ------------

  list(uri: string, state: HydrationState): Un$Typed<ListView> | undefined {
    const creatorDid = creatorFromUri(uri)
    const list = state.lists?.get(uri)
    if (!list) return
    const creator = this.profile(creatorDid, state)
    if (!creator) return
    const basicView = this.listBasic(uri, state)
    if (!basicView) return

    return {
      ...basicView,
      creator,
      description: list.record.description,
      descriptionFacets: list.record.descriptionFacets,
      indexedAt: this.indexedAt(list).toISOString(),
    }
  }

  listBasic(
    uri: string,
    state: HydrationState,
  ): Un$Typed<ListViewBasic> | undefined {
    const list = state.lists?.get(uri)
    if (!list) {
      return undefined
    }
    const listAgg = state.listAggs?.get(uri)
    const listViewer = state.listViewers?.get(uri)
    const labels = state.labels?.getBySubject(uri) ?? []
    const creator = creatorFromUri(uri)
    return {
      uri,
      cid: list.cid,
      name: list.record.name,
      purpose: list.record.purpose,
      avatar: list.record.avatar
        ? this.imgUriBuilder.getPresetUri(
            'avatar',
            creator,
            cidFromBlobJson(list.record.avatar),
          )
        : undefined,
      listItemCount: listAgg?.listItems ?? 0,
      indexedAt: this.indexedAt(list).toISOString(),
      labels,
      viewer: listViewer
        ? {
            muted: !!listViewer.viewerMuted,
            blocked: listViewer.viewerListBlockUri,
          }
        : undefined,
    }
  }

  starterPackBasic(
    uri: string,
    state: HydrationState,
  ): Un$Typed<StarterPackViewBasic> | undefined {
    const sp = state.starterPacks?.get(uri)
    if (!sp) return
    const parsedUri = new AtUri(uri)
    const creator = this.profileBasic(parsedUri.hostname, state)
    if (!creator) return
    const agg = state.starterPackAggs?.get(uri)
    const labels = state.labels?.getBySubject(uri) ?? []
    return {
      uri,
      cid: sp.cid,
      record: sp.record,
      creator,
      joinedAllTimeCount: agg?.joinedAllTime ?? 0,
      joinedWeekCount: agg?.joinedWeek ?? 0,
      labels,
      indexedAt: this.indexedAt(sp).toISOString(),
    }
  }

  starterPack(
    uri: string,
    state: HydrationState,
  ): Un$Typed<StarterPackView> | undefined {
    const sp = state.starterPacks?.get(uri)
    const basicView = this.starterPackBasic(uri, state)
    if (!sp || !basicView) return
    const agg = state.starterPackAggs?.get(uri)
    const feeds = mapDefined(sp.record.feeds ?? [], (feed) =>
      this.feedGenerator(feed.uri, state),
    )
    const list = this.listBasic(sp.record.list, state)
    const listItemsSample = mapDefined(agg?.listItemSampleUris ?? [], (uri) => {
      const li = state.listItems?.get(uri)
      if (!li) return
      const subject = this.profile(li.record.subject, state)
      if (!subject) return
      return { uri, subject }
    })
    return {
      ...basicView,
      feeds,
      list,
      listItemsSample,
    }
  }

  // Labels
  // ------------

  selfLabels({
    uri,
    cid,
    record,
  }: {
    uri?: string
    cid?: string
    record?:
      | PostRecord
      | LikeRecord
      | RepostRecord
      | FollowRecord
      | ProfileRecord
      | LabelerRecord
  }): Label[] {
    if (!uri || !cid || !record) return []

    // Only these have a "labels" property:
    if (
      !isPostRecord(record) &&
      !isProfileRecord(record) &&
      !isLabelerRecord(record)
    ) {
      return []
    }

    // Ignore if no labels defines
    if (!isSelfLabels(record.labels) || !record.labels.values.length) {
      return []
    }

    const src = creatorFromUri(uri) // record creator
    const cts =
      typeof record.createdAt === 'string'
        ? normalizeDatetimeAlways(record.createdAt)
        : new Date(0).toISOString()
    return record.labels.values.map(({ val }) => {
      return { src, uri, cid, val, cts }
    })
  }

  labeler(
    did: string,
    state: HydrationState,
  ): Un$Typed<LabelerView> | undefined {
    const labeler = state.labelers?.get(did)
    if (!labeler) return
    const creator = this.profile(did, state)
    if (!creator) return
    const viewer = state.labelerViewers?.get(did)
    const aggs = state.labelerAggs?.get(did)

    const uri = AtUri.make(did, ids.AppBskyLabelerService, 'self').toString()
    const labels = [
      ...(state.labels?.getBySubject(uri) ?? []),
      ...this.selfLabels({
        uri,
        cid: labeler.cid.toString(),
        record: labeler.record,
      }),
    ]

    return {
      uri,
      cid: labeler.cid.toString(),
      creator,
      likeCount: aggs?.likes ?? 0,
      viewer: viewer
        ? {
            like: viewer.like,
          }
        : undefined,
      indexedAt: this.indexedAt(labeler).toISOString(),
      labels,
    }
  }

  labelerDetailed(
    did: string,
    state: HydrationState,
  ): Un$Typed<LabelerViewDetailed> | undefined {
    const baseView = this.labeler(did, state)
    if (!baseView) return
    const labeler = state.labelers?.get(did)
    if (!labeler) return

    return {
      ...baseView,
      policies: labeler.record.policies,
      reasonTypes: labeler.record.reasonTypes,
      subjectTypes: labeler.record.subjectTypes,
      subjectCollections: labeler.record.subjectCollections,
    }
  }

  // Feed
  // ------------

  feedItemBlocksAndMutes(
    item: FeedItem,
    state: HydrationState,
  ): {
    originatorMuted: boolean
    originatorBlocked: boolean
    authorMuted: boolean
    authorBlocked: boolean
    ancestorAuthorBlocked: boolean
  } {
    const authorDid = creatorFromUri(item.post.uri)
    const originatorDid = item.repost
      ? creatorFromUri(item.repost.uri)
      : authorDid
    const post = state.posts?.get(item.post.uri)
    const parentUri = post?.record.reply?.parent.uri
    const parentAuthorDid = parentUri && creatorFromUri(parentUri)
    const parent = parentUri ? state.posts?.get(parentUri) : undefined
    const grandparentUri = parent?.record.reply?.parent.uri
    const grandparentAuthorDid =
      grandparentUri && creatorFromUri(grandparentUri)
    return {
      originatorMuted: this.viewerMuteExists(originatorDid, state),
      originatorBlocked: this.viewerBlockExists(originatorDid, state),
      authorMuted: this.viewerMuteExists(authorDid, state),
      authorBlocked: this.viewerBlockExists(authorDid, state),
      ancestorAuthorBlocked:
        (!!parentAuthorDid && this.viewerBlockExists(parentAuthorDid, state)) ||
        (!!grandparentAuthorDid &&
          this.viewerBlockExists(grandparentAuthorDid, state)),
    }
  }

  feedGenerator(
    uri: string,
    state: HydrationState,
  ): Un$Typed<GeneratorView> | undefined {
    const feedgen = state.feedgens?.get(uri)
    if (!feedgen) return
    const creatorDid = creatorFromUri(uri)
    const creator = this.profile(creatorDid, state)
    if (!creator) return
    const viewer = state.feedgenViewers?.get(uri)
    const aggs = state.feedgenAggs?.get(uri)
    const labels = state.labels?.getBySubject(uri) ?? []

    return {
      uri,
      cid: feedgen.cid,
      did: feedgen.record.did,
      creator,
      displayName: feedgen.record.displayName,
      description: feedgen.record.description,
      descriptionFacets: feedgen.record.descriptionFacets,
      avatar: feedgen.record.avatar
        ? this.imgUriBuilder.getPresetUri(
            'avatar',
            creatorDid,
            cidFromBlobJson(feedgen.record.avatar),
          )
        : undefined,
      likeCount: aggs?.likes ?? 0,
      labels,
      viewer: viewer
        ? {
            like: viewer.like,
          }
        : undefined,
      contentMode: feedgen.record.contentMode,
      indexedAt: this.indexedAt(feedgen).toISOString(),
    }
  }

  threadgate(
    uri: string,
    state: HydrationState,
  ): Un$Typed<ThreadgateView> | undefined {
    const gate = state.threadgates?.get(uri)
    if (!gate) return
    return {
      uri,
      cid: gate.cid,
      record: gate.record,
      lists: mapDefined(gate.record.allow ?? [], (rule) => {
        if (!isListRule(rule)) return
        return this.listBasic(rule.list, state)
      }),
    }
  }

  post(
    uri: string,
    state: HydrationState,
    depth = 0,
  ): Un$Typed<PostView> | undefined {
    const post = state.posts?.get(uri)
    if (!post) return
    const parsedUri = new AtUri(uri)
    const authorDid = parsedUri.hostname
    const author = this.profileBasic(authorDid, state)
    if (!author) return
    const aggs = state.postAggs?.get(uri)
    const viewer = state.postViewers?.get(uri)
    const threadgateUri = postUriToThreadgateUri(uri)
    const labels = [
      ...(state.labels?.getBySubject(uri) ?? []),
      ...this.selfLabels({
        uri,
        cid: post.cid,
        record: post.record,
      }),
    ]
    return {
      uri,
      cid: post.cid,
      author,
      record: post.record,
      embed:
        depth < 2 && post.record.embed
          ? this.embed(uri, post.record.embed, state, depth + 1)
          : undefined,
      replyCount: aggs?.replies ?? 0,
      repostCount: aggs?.reposts ?? 0,
      likeCount: aggs?.likes ?? 0,
      quoteCount: aggs?.quotes ?? 0,
      indexedAt: this.indexedAt(post).toISOString(),
      viewer: viewer
        ? {
            repost: viewer.repost,
            like: viewer.like,
            threadMuted: viewer.threadMuted,
            replyDisabled: this.userReplyDisabled(uri, state),
            embeddingDisabled: this.userPostEmbeddingDisabled(uri, state),
            pinned: this.viewerPinned(uri, state, authorDid),
          }
        : undefined,
      labels,
      threadgate: !post.record.reply // only hydrate gate on root post
        ? this.threadgate(threadgateUri, state)
        : undefined,
    }
  }

  feedViewPost(
    item: FeedItem,
    state: HydrationState,
  ): Un$Typed<FeedViewPost> | undefined {
    const postInfo = state.posts?.get(item.post.uri)
    let reason: $Typed<ReasonRepost> | $Typed<ReasonPin> | undefined
    if (item.authorPinned) {
      reason = this.reasonPin()
    } else if (item.repost) {
      const repost = state.reposts?.get(item.repost.uri)
      if (!repost) return
      if (repost.record.subject.uri !== item.post.uri) return
      reason = this.reasonRepost(creatorFromUri(item.repost.uri), repost, state)
      if (!reason) return
    }
    const post = this.post(item.post.uri, state)
    if (!post) return
    const reply = !postInfo?.violatesThreadGate
      ? this.replyRef(item.post.uri, state)
      : undefined
    return {
      post,
      reason,
      reply,
    }
  }

  replyRef(uri: string, state: HydrationState): Un$Typed<ReplyRef> | undefined {
    const postRecord = state.posts?.get(uri.toString())?.record
    if (!postRecord?.reply) return
    let root = this.maybePost(postRecord.reply.root.uri, state)
    let parent = this.maybePost(postRecord.reply.parent.uri, state)
    if (!state.ctx?.include3pBlocks) {
      const childBlocks = state.postBlocks?.get(uri)
      const parentBlocks = state.postBlocks?.get(parent.uri)
      // if child blocks parent, block parent
      if (isPostView(parent) && childBlocks?.parent) {
        parent = this.blockedPost(parent.uri, parent.author.did, state)
      }
      // if child or parent blocks root, block root
      if (isPostView(root) && (childBlocks?.root || parentBlocks?.root)) {
        root = this.blockedPost(root.uri, root.author.did, state)
      }
    }
    let grandparentAuthor: ProfileViewBasic | undefined
    if (
      isPostView(parent) &&
      isPostRecord(parent.record) &&
      parent.record.reply
    ) {
      grandparentAuthor = this.profileBasic(
        // @ts-expect-error isValidPostRecord(parent.record) should be used but the "parent" is not IPDL decoded
        creatorFromUri(parent.record.reply.parent.uri),
        state,
      )
    }
    return {
      root,
      parent,
      grandparentAuthor,
    }
  }

  maybePost(uri: string, state: HydrationState): $Typed<MaybePostView> {
    const post = this.post(uri, state)
    if (!post) {
      return this.notFoundPost(uri)
    }
    if (this.viewerBlockExists(post.author.did, state)) {
      return this.blockedPost(uri, post.author.did, state)
    }
    return {
      ...post,
      $type: 'app.bsky.feed.defs#postView',
    }
  }

  blockedPost(
    uri: string,
    authorDid: string,
    state: HydrationState,
  ): $Typed<BlockedPost> {
    return {
      $type: 'app.bsky.feed.defs#blockedPost',
      uri,
      blocked: true,
      author: {
        did: authorDid,
        viewer: this.blockedProfileViewer(authorDid, state),
      },
    }
  }

  notFoundPost(uri: string): $Typed<NotFoundPost> {
    return {
      $type: 'app.bsky.feed.defs#notFoundPost',
      uri,
      notFound: true,
    }
  }

  reasonRepost(
    creatorDid: string,
    repost: Repost,
    state: HydrationState,
  ): $Typed<ReasonRepost> | undefined {
    const creator = this.profileBasic(creatorDid, state)
    if (!creator) return
    return {
      $type: 'app.bsky.feed.defs#reasonRepost',
      by: creator,
      indexedAt: this.indexedAt(repost).toISOString(),
    }
  }

  reasonPin(): $Typed<ReasonPin> {
    return {
      $type: 'app.bsky.feed.defs#reasonPin',
    }
  }

  // Threads
  // ------------

  thread(
    skele: { anchor: string; uris: string[] },
    state: HydrationState,
    opts: { height: number; depth: number },
  ): $Typed<ThreadViewPost> | $Typed<NotFoundPost> | $Typed<BlockedPost> {
    const { anchor, uris } = skele
    const post = this.post(anchor, state)
    const postInfo = state.posts?.get(anchor)
    if (!postInfo || !post) return this.notFoundPost(anchor)
    if (this.viewerBlockExists(post.author.did, state)) {
      return this.blockedPost(anchor, post.author.did, state)
    }
    const includedPosts = new Set<string>([anchor])
    const childrenByParentUri: Record<string, string[]> = {}
    uris.forEach((uri) => {
      const post = state.posts?.get(uri)
      const parentUri = post?.record.reply?.parent.uri
      if (!parentUri) return
      if (includedPosts.has(uri)) return
      includedPosts.add(uri)
      childrenByParentUri[parentUri] ??= []
      childrenByParentUri[parentUri].push(uri)
    })
    const rootUri = getRootUri(anchor, postInfo)
    const violatesThreadGate = postInfo.violatesThreadGate

    return {
      $type: 'app.bsky.feed.defs#threadViewPost',
      post,
      parent: !violatesThreadGate
        ? this.threadParent(anchor, rootUri, state, opts.height)
        : undefined,
      replies: !violatesThreadGate
        ? this.threadReplies(
            anchor,
            rootUri,
            childrenByParentUri,
            state,
            opts.depth,
          )
        : undefined,
      threadContext: {
        rootAuthorLike: state.threadContexts?.get(post.uri)?.like,
      },
    }
  }

  threadParent(
    childUri: string,
    rootUri: string,
    state: HydrationState,
    height: number,
  ):
    | $Typed<ThreadViewPost>
    | $Typed<NotFoundPost>
    | $Typed<BlockedPost>
    | undefined {
    if (height < 1) return undefined
    const parentUri = state.posts?.get(childUri)?.record.reply?.parent.uri
    if (!parentUri) return undefined
    if (
      !state.ctx?.include3pBlocks &&
      state.postBlocks?.get(childUri)?.parent
    ) {
      return this.blockedPost(parentUri, creatorFromUri(parentUri), state)
    }
    const post = this.post(parentUri, state)
    const postInfo = state.posts?.get(parentUri)
    if (!postInfo || !post) return this.notFoundPost(parentUri)
    if (rootUri !== getRootUri(parentUri, postInfo)) return // outside thread boundary
    if (this.viewerBlockExists(post.author.did, state)) {
      return this.blockedPost(parentUri, post.author.did, state)
    }
    return {
      $type: 'app.bsky.feed.defs#threadViewPost',
      post,
      parent: this.threadParent(parentUri, rootUri, state, height - 1),
      threadContext: {
        rootAuthorLike: state.threadContexts?.get(post.uri)?.like,
      },
    }
  }

  threadReplies(
    parentUri: string,
    rootUri: string,
    childrenByParentUri: Record<string, string[]>,
    state: HydrationState,
    depth: number,
  ): ($Typed<ThreadViewPost> | $Typed<BlockedPost>)[] | undefined {
    if (depth < 1) return undefined
    const childrenUris = childrenByParentUri[parentUri] ?? []
    return mapDefined(childrenUris, (uri) => {
      const postInfo = state.posts?.get(uri)
      if (postInfo?.violatesThreadGate) {
        return undefined
      }
      if (!state.ctx?.include3pBlocks && state.postBlocks?.get(uri)?.parent) {
        return undefined
      }
      const post = this.post(uri, state)
      if (!postInfo || !post) {
        // in the future we might consider keeping a placeholder for deleted
        // posts that have replies under them, but not supported at the moment.
        // this case is mostly likely hit when a takedown was applied to a post.
        return undefined
      }
      if (rootUri !== getRootUri(uri, postInfo)) return // outside thread boundary
      if (this.viewerBlockExists(post.author.did, state)) {
        return this.blockedPost(uri, post.author.did, state)
      }
      if (!this.viewerSeesNeedsReview({ uri, did: post.author.did }, state)) {
        return undefined
      }
      return {
        $type: 'app.bsky.feed.defs#threadViewPost',
        post,
        replies: this.threadReplies(
          uri,
          rootUri,
          childrenByParentUri,
          state,
          depth - 1,
        ),
        threadContext: {
          rootAuthorLike: state.threadContexts?.get(post.uri)?.like,
        },
      }
    })
  }

  // Embeds
  // ------------

  embed(
    postUri: string,
    embed: Embed | { $type: string },
    state: HydrationState,
    depth: number,
  ): $Typed<EmbedView> | undefined {
    if (isImagesEmbed(embed)) {
      return this.imagesEmbed(creatorFromUri(postUri), embed)
    } else if (isVideoEmbed(embed)) {
      return this.videoEmbed(creatorFromUri(postUri), embed)
    } else if (isExternalEmbed(embed)) {
      return this.externalEmbed(creatorFromUri(postUri), embed)
    } else if (isRecordEmbed(embed)) {
      return this.recordEmbed(postUri, embed, state, depth)
    } else if (isRecordWithMedia(embed)) {
      return this.recordWithMediaEmbed(postUri, embed, state, depth)
    } else {
      return undefined
    }
  }

  imagesEmbed(did: string, embed: ImagesEmbed): $Typed<ImagesEmbedView> {
    const imgViews = embed.images.map((img) => ({
      thumb: this.imgUriBuilder.getPresetUri(
        'feed_thumbnail',
        did,
        cidFromBlobJson(img.image),
      ),
      fullsize: this.imgUriBuilder.getPresetUri(
        'feed_fullsize',
        did,
        cidFromBlobJson(img.image),
      ),
      alt: img.alt,
      aspectRatio: img.aspectRatio,
    }))
    return {
      $type: 'app.bsky.embed.images#view',
      images: imgViews,
    }
  }

  videoEmbed(did: string, embed: VideoEmbed): $Typed<VideoEmbedView> {
    const cid = cidFromBlobJson(embed.video)
    return {
      $type: 'app.bsky.embed.video#view',
      cid,
      playlist: this.videoUriBuilder.playlist({ did, cid }),
      thumbnail: this.videoUriBuilder.thumbnail({ did, cid }),
      alt: embed.alt,
      aspectRatio: embed.aspectRatio,
    }
  }

  externalEmbed(did: string, embed: ExternalEmbed): $Typed<ExternalEmbedView> {
    const { uri, title, description, thumb } = embed.external
    return {
      $type: 'app.bsky.embed.external#view',
      external: {
        uri,
        title,
        description,
        thumb: thumb
          ? this.imgUriBuilder.getPresetUri(
              'feed_thumbnail',
              did,
              cidFromBlobJson(thumb),
            )
          : undefined,
      },
    }
  }

  embedNotFound(uri: string): {
    $type: 'app.bsky.embed.record#view'
    record: $Typed<EmbedNotFound>
  } {
    return {
      $type: 'app.bsky.embed.record#view',
      record: {
        $type: 'app.bsky.embed.record#viewNotFound',
        uri,
        notFound: true,
      },
    }
  }

  embedDetached(uri: string): {
    $type: 'app.bsky.embed.record#view'
    record: $Typed<EmbedDetached>
  } {
    return {
      $type: 'app.bsky.embed.record#view',
      record: {
        $type: 'app.bsky.embed.record#viewDetached',
        uri,
        detached: true,
      },
    }
  }

  embedBlocked(
    uri: string,
    state: HydrationState,
  ): {
    $type: 'app.bsky.embed.record#view'
    record: $Typed<EmbedBlocked>
  } {
    const creator = creatorFromUri(uri)
    return {
      $type: 'app.bsky.embed.record#view',
      record: {
        $type: 'app.bsky.embed.record#viewBlocked',
        uri,
        blocked: true,
        author: {
          did: creator,
          viewer: this.blockedProfileViewer(creator, state),
        },
      },
    }
  }

  embedPostView(
    uri: string,
    state: HydrationState,
    depth: number,
  ): $Typed<PostEmbedView> | undefined {
    const postView = this.post(uri, state, depth)
    if (!postView) return
    return {
      $type: 'app.bsky.embed.record#viewRecord',
      uri: postView.uri,
      cid: postView.cid,
      author: postView.author,
      value: postView.record,
      labels: postView.labels,
      likeCount: postView.likeCount,
      replyCount: postView.replyCount,
      repostCount: postView.repostCount,
      quoteCount: postView.quoteCount,
      indexedAt: postView.indexedAt,
      embeds: depth > 1 ? undefined : postView.embed ? [postView.embed] : [],
    }
  }

  recordEmbed(
    postUri: string,
    embed: RecordEmbed,
    state: HydrationState,
    depth: number,
    withTypeTag: false,
  ): RecordEmbedView
  recordEmbed(
    postUri: string,
    embed: RecordEmbed,
    state: HydrationState,
    depth: number,
    withTypeTag?: true,
  ): $Typed<RecordEmbedView>
  recordEmbed(
    postUri: string,
    embed: RecordEmbed,
    state: HydrationState,
    depth: number,
    withTypeTag = true,
  ): RecordEmbedView {
    const uri = embed.record.uri
    const parsedUri = new AtUri(uri)
    if (
      this.viewerBlockExists(parsedUri.hostname, state) ||
      (!state.ctx?.include3pBlocks && state.postBlocks?.get(postUri)?.embed)
    ) {
      return this.embedBlocked(uri, state)
    }

    const post = state.posts?.get(postUri)
    if (post?.violatesEmbeddingRules) {
      return this.embedDetached(uri)
    }

    if (parsedUri.collection === ids.AppBskyFeedPost) {
      const view = this.embedPostView(uri, state, depth)
      if (!view) return this.embedNotFound(uri)
      const postgateRecordUri = postUriToPostgateUri(parsedUri.toString())
      const postgate = state.postgates?.get(postgateRecordUri)
      if (postgate?.record?.detachedEmbeddingUris?.includes(postUri)) {
        return this.embedDetached(uri)
      }
      return this.recordEmbedWrapper(view, withTypeTag)
    } else if (parsedUri.collection === ids.AppBskyFeedGenerator) {
      const view = this.feedGenerator(uri, state)
      if (!view) return this.embedNotFound(uri)
      return this.recordEmbedWrapper(
        { ...view, $type: 'app.bsky.feed.defs#generatorView' },
        withTypeTag,
      )
    } else if (parsedUri.collection === ids.AppBskyGraphList) {
      const view = this.list(uri, state)
      if (!view) return this.embedNotFound(uri)
      return this.recordEmbedWrapper(
        { ...view, $type: 'app.bsky.graph.defs#listView' },
        withTypeTag,
      )
    } else if (parsedUri.collection === ids.AppBskyLabelerService) {
      const view = this.labeler(parsedUri.hostname, state)
      if (!view) return this.embedNotFound(uri)
      return this.recordEmbedWrapper(
        { ...view, $type: 'app.bsky.labeler.defs#labelerView' },
        withTypeTag,
      )
    } else if (parsedUri.collection === ids.AppBskyGraphStarterpack) {
      const view = this.starterPackBasic(uri, state)
      if (!view) return this.embedNotFound(uri)
      return this.recordEmbedWrapper(
        { ...view, $type: 'app.bsky.graph.defs#starterPackViewBasic' },
        withTypeTag,
      )
    }
    return this.embedNotFound(uri)
  }

  private recordEmbedWrapper<T extends $Typed<RecordEmbedViewInternal>>(
    record: T,
    withTypeTag: boolean,
  ) {
    return {
      $type: withTypeTag ? ('app.bsky.embed.record#view' as const) : undefined,
      record,
    } satisfies RecordEmbedView
  }

  recordWithMediaEmbed(
    postUri: string,
    embed: RecordWithMedia,
    state: HydrationState,
    depth: number,
  ): $Typed<RecordWithMediaView> | undefined {
    const creator = creatorFromUri(postUri)
    let mediaEmbed:
      | $Typed<ImagesEmbedView>
      | $Typed<VideoEmbedView>
      | $Typed<ExternalEmbedView>
    if (isImagesEmbed(embed.media)) {
      mediaEmbed = this.imagesEmbed(creator, embed.media)
    } else if (isVideoEmbed(embed.media)) {
      mediaEmbed = this.videoEmbed(creator, embed.media)
    } else if (isExternalEmbed(embed.media)) {
      mediaEmbed = this.externalEmbed(creator, embed.media)
    } else {
      return
    }
    return {
      $type: 'app.bsky.embed.recordWithMedia#view',
      media: mediaEmbed,
      record: this.recordEmbed(postUri, embed.record, state, depth, false),
    }
  }

  userReplyDisabled(uri: string, state: HydrationState): boolean | undefined {
    const post = state.posts?.get(uri)
    if (post?.violatesThreadGate) {
      return true
    }
    const rootUriStr: string = post?.record.reply?.root.uri ?? uri
    const gate = state.threadgates?.get(
      postUriToThreadgateUri(rootUriStr),
    )?.record
    const viewer = state.ctx?.viewer
    if (!gate || !viewer) {
      return undefined
    }
    const rootPost = state.posts?.get(rootUriStr)?.record
    const ownerDid = creatorFromUri(rootUriStr)
    const {
      canReply,
      allowFollower,
      allowFollowing,
      allowListUris = [],
    } = parseThreadGate(viewer, ownerDid, rootPost ?? null, gate)
    if (canReply) {
      return false
    }
    if (allowFollower && state.profileViewers?.get(ownerDid)?.following) {
      return false
    }
    if (allowFollowing && state.profileViewers?.get(ownerDid)?.followedBy) {
      return false
    }
    for (const listUri of allowListUris) {
      const list = state.listViewers?.get(listUri)
      if (list?.viewerInList) {
        return false
      }
    }
    return true
  }

  userPostEmbeddingDisabled(
    uri: string,
    state: HydrationState,
  ): boolean | undefined {
    const post = state.posts?.get(uri)
    if (!post) {
      return true
    }
    const postgateRecordUri = postUriToPostgateUri(uri)
    const gate = state.postgates?.get(postgateRecordUri)?.record
    const viewerDid = state.ctx?.viewer ?? undefined
    const {
      embeddingRules: { canEmbed },
    } = parsePostgate({
      gate,
      viewerDid,
      authorDid: creatorFromUri(uri),
    })
    if (canEmbed) {
      return false
    }
    return true
  }

  viewerPinned(uri: string, state: HydrationState, authorDid: string) {
    if (!state.ctx?.viewer || state.ctx.viewer !== authorDid) return
    const actor = state.actors?.get(authorDid)
    if (!actor) return
    const pinnedPost = safePinnedPost(actor.profile?.pinnedPost)
    if (!pinnedPost) return undefined
    return pinnedPost.uri === uri
  }

  notification(
    notif: Notification,
    lastSeenAt: string | undefined,
    state: HydrationState,
  ): Un$Typed<NotificationView> | undefined {
    if (!notif.timestamp || !notif.reason) return
    const uri = new AtUri(notif.uri)
    const authorDid = uri.hostname
    const author = this.profile(authorDid, state)
    if (!author) return

    let recordInfo:
      | Post
      | Like
      | Repost
      | Follow
      | RecordInfo<ProfileRecord>
      | undefined
      | null

    if (uri.collection === ids.AppBskyFeedPost) {
      recordInfo = state.posts?.get(notif.uri)
    } else if (uri.collection === ids.AppBskyFeedLike) {
      recordInfo = state.likes?.get(notif.uri)
    } else if (uri.collection === ids.AppBskyFeedRepost) {
      recordInfo = state.reposts?.get(notif.uri)
    } else if (uri.collection === ids.AppBskyGraphFollow) {
      recordInfo = state.follows?.get(notif.uri)
    } else if (uri.collection === ids.AppBskyActorProfile) {
      const actor = state.actors?.get(authorDid)
      recordInfo =
        actor && actor.profile && actor.profileCid
          ? {
              record: actor.profile,
              cid: actor.profileCid,
              sortedAt: actor.sortedAt ?? new Date(0), // @NOTE will be present since profile record is present
              indexedAt: actor.indexedAt ?? new Date(0), // @NOTE will be present since profile record is present
              takedownRef: actor.profileTakedownRef,
            }
          : undefined
    }
    if (!recordInfo) return

    const labels = state.labels?.getBySubject(notif.uri) ?? []
    const selfLabels = this.selfLabels({
      uri: notif.uri,
      cid: recordInfo.cid,
      record: recordInfo.record,
    })
    const indexedAt = notif.timestamp.toDate().toISOString()
    return {
      uri: notif.uri,
      cid: recordInfo.cid,
      author,
      reason: notif.reason,
      reasonSubject: notif.reasonSubject || undefined,
      record: recordInfo.record,
      // @NOTE works with a hack in listNotifications so that when there's no last-seen time,
      // the user's first notification is marked unread, and all previous read. in this case,
      // the last seen time will be equal to the first notification's indexed time.
      isRead: lastSeenAt ? lastSeenAt > indexedAt : true,
      indexedAt: notif.timestamp.toDate().toISOString(),
      labels: [...labels, ...selfLabels],
    }
  }

  indexedAt({ sortedAt, indexedAt }: { sortedAt: Date; indexedAt: Date }) {
    if (!this.indexedAtEpoch) return sortedAt
    return indexedAt && indexedAt > this.indexedAtEpoch ? indexedAt : sortedAt
  }
}

const getRootUri = (uri: string, post: Post): string => {
  return post.record.reply?.root.uri ?? uri
}
