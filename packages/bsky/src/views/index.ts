import { HOUR, MINUTE, dedupeStrs, mapDefined } from '@atproto/common'
import {
  type $Typed,
  type Un$Typed,
  type Unknown$TypedObject,
  type UriString,
  atUri,
  getBlobCidString,
} from '@atproto/lex'
import {
  AtUri,
  type AtUriString,
  type DatetimeString,
  type DidString,
  INVALID_HANDLE,
  normalizeDatetimeAlways,
} from '@atproto/syntax'
import type { Actor, ProfileViewerState } from '../hydration/actor.js'
import {
  type AssociatedSiteStandardRecord,
  type SiteStandardDocument,
  type SiteStandardPublication,
  getSiteStandardRecordsFromHydrationMapsByRefs,
} from '../hydration/external.js'
import type { FeedItem, Like, Post, Repost } from '../hydration/feed.js'
import type { Follow, Verification } from '../hydration/graph.js'
import type { HydrationState } from '../hydration/hydrator.js'
import type { Label } from '../hydration/label.js'
import { type RecordInfo, parseString } from '../hydration/util.js'
import type { ImageUriBuilder } from '../image/uri.js'
import { app, site } from '../lexicons/index.js'
import { viewsLogger } from '../logger.js'
import type { Notification } from '../proto/bsky_pb.js'
import {
  estimateReadingTimeMinutes,
  validateStandardSiteForUrl,
} from '../util/standard-site.js'
import {
  postUriToPostgateUri,
  postUriToThreadgateUri,
  safePinnedPost,
  uriToDid,
  uriToDid as creatorFromUri,
} from '../util/uris.js'
import {
  type ThreadItemValueBlocked,
  type ThreadItemValueNoUnauthenticated,
  type ThreadItemValueNotFound,
  type ThreadItemValuePost,
  type ThreadOtherAnchorPostNode,
  type ThreadOtherItemValuePost,
  type ThreadOtherPostNode,
  type ThreadTree,
  type ThreadTreeVisible,
  sortTrimFlattenThreadTree,
} from './threads-v2.js'
import {
  type ActivitySubscription,
  type BlockedPost,
  type BookmarkView,
  type Embed,
  type EmbedView,
  type ExternalEmbed,
  type ExternalEmbedColorRgb,
  type ExternalEmbedSourceThemeView,
  type ExternalEmbedSourceView,
  type ExternalEmbedView,
  type FeedViewPost,
  type FollowRecord,
  type GalleryEmbed,
  type GalleryEmbedView,
  type GalleryImageEmbed,
  type GalleryImageEmbedView,
  type GeneratorView,
  type GetPostThreadV2QueryParams,
  type ImagesEmbed,
  type ImagesEmbedView,
  type KnownFollowers,
  type LabelerRecord,
  type LabelerView,
  type LabelerViewDetailed,
  type LikeRecord,
  type ListItemView,
  type ListView,
  type ListViewBasic,
  type MaybePostView,
  type NotFoundPost,
  type NotificationRecordDeleted,
  type NotificationView,
  type PostEmbedView,
  type PostRecord,
  type PostView,
  type ProfileAssociatedActivitySubscription,
  type ProfileAssociatedChat,
  type ProfileRecord,
  type ProfileView,
  type ProfileViewBasic,
  type ProfileViewDetailed,
  type ProfileViewer,
  type ReasonPin,
  type ReasonRepost,
  type RecordEmbed,
  type RecordEmbedView,
  type RecordEmbedViewInternal,
  type RecordWithMedia,
  type RecordWithMediaView,
  type ReplyRef,
  type RepostRecord,
  type SiteStandardPublicationRecord,
  type StarterPackView,
  type StarterPackViewBasic,
  type StatusView,
  type ThreadItem,
  type ThreadOtherItem,
  type ThreadViewPost,
  type ThreadgateView,
  type VerificationRecord,
  type VerificationState,
  type VerificationView,
  type VideoEmbed,
  type VideoEmbedView,
  isExternalEmbedType,
  isGalleryEmbedType,
  isGalleryImageEmbedType,
  isImagesEmbedType,
  isLabelerRecordType,
  isListRuleType,
  isPostRecordType,
  isPostViewType,
  isProfileRecordType,
  isRecordEmbedType,
  isRecordWithMediaType,
  isSelfLabelsType,
  isVideoEmbedType,
} from './types.js'
import { type VideoUriBuilder, parsePostgate, parseThreadGate } from './util.js'

const notificationDeletedRecord =
  app.bsky.notification.defs.recordDeleted.$build({})

// Pre-computed CID for the `notificationDeletedRecord`.
const notificationDeletedRecordCid =
  'bafyreidad6nyekfa4a67yfb573ptxiv6s7kyxyg2ra6qbbemcruadvtuim'

// Soft-limit for `app.bsky.embed.gallery#main.items`. The lexicon's
// schema-level cap is 20, but clients are expected to enforce a soft limit
// of 10 today. The AppView trims defensively at the view boundary.
const GALLERY_SOFT_LIMIT = 10

export class Views {
  public imgUriBuilder: ImageUriBuilder = this.opts.imgUriBuilder
  public videoUriBuilder: VideoUriBuilder = this.opts.videoUriBuilder
  public indexedAtEpoch: Date | undefined = this.opts.indexedAtEpoch
  private threadTagsBumpDown: readonly string[] = this.opts.threadTagsBumpDown
  private threadTagsHide: readonly string[] = this.opts.threadTagsHide
  private visibilityTagHide: string = this.opts.visibilityTagHide
  private visibilityTagRankPrefix: string = this.opts.visibilityTagRankPrefix
  constructor(
    private opts: {
      imgUriBuilder: ImageUriBuilder
      videoUriBuilder: VideoUriBuilder
      indexedAtEpoch: Date | undefined
      threadTagsBumpDown: readonly string[]
      threadTagsHide: readonly string[]
      visibilityTagHide: string
      visibilityTagRankPrefix: string
    },
  ) {}

  // Actor
  // ------------

  actorIsNoHosted(did: DidString, state: HydrationState): boolean {
    return (
      this.actorIsDeactivated(did, state) || this.actorIsTakendown(did, state)
    )
  }

  actorIsDeactivated(did: DidString, state: HydrationState): boolean {
    if (state.actors?.get(did)?.upstreamStatus === 'deactivated') return true
    return false
  }

  actorIsTakendown(did: DidString, state: HydrationState): boolean {
    const actor = state.actors?.get(did)
    if (actor?.takedownRef) return true
    if (actor?.upstreamStatus === 'takendown') return true
    if (actor?.upstreamStatus === 'suspended') return true
    if (state.labels?.get(did)?.isTakendown) return true
    return false
  }

  noUnauthenticatedPost(state: HydrationState, post: PostView): boolean {
    const isNoUnauthenticated = post.author.labels?.some(
      (l) => l.val === '!no-unauthenticated',
    )
    return !state.ctx?.viewer && !!isNoUnauthenticated
  }

  viewerBlockExists(did: DidString, state: HydrationState): boolean {
    if (state.ctx?.skipViewerBlocks) return false
    const viewer = state.profileViewers?.get(did)
    if (!viewer) return false
    return !!(
      viewer.blockedBy ||
      viewer.blocking ||
      this.blockedByList(viewer, state) ||
      this.blockingByList(viewer, state)
    )
  }

  viewerMuteExists(did: DidString, state: HydrationState): boolean {
    const viewer = state.profileViewers?.get(did)
    if (!viewer) return false
    return !!(viewer.muted || this.mutedByList(viewer, state))
  }

  blockingByList(
    viewer: ProfileViewerState,
    state: HydrationState,
  ): undefined | AtUriString {
    return (
      viewer.blockingByList && this.recordActive(viewer.blockingByList, state)
    )
  }

  blockedByList(
    viewer: ProfileViewerState,
    state: HydrationState,
  ): undefined | AtUriString {
    return (
      viewer.blockedByList && this.recordActive(viewer.blockedByList, state)
    )
  }

  mutedByList(
    viewer: ProfileViewerState,
    state: HydrationState,
  ): undefined | AtUriString {
    return viewer.mutedByList && this.recordActive(viewer.mutedByList, state)
  }

  recordActive(
    uri: AtUriString,
    state: HydrationState,
  ): AtUriString | undefined {
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
    { did, uri }: { did?: DidString; uri?: AtUriString },
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
    replyUri: AtUriString,
    rootPostUri: AtUriString,
    state: HydrationState,
  ) {
    const threadgateUri = postUriToThreadgateUri(rootPostUri)
    const threadgate = state.threadgates?.get(threadgateUri)
    return !!threadgate?.record?.hiddenReplies?.includes(replyUri)
  }

  profileDetailed(
    did: DidString,
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
      website: this.profileWebsite(did, state),
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
            getBlobCidString(actor.profile.banner),
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
        chat: this.profileAssociatedChat(actor),
        activitySubscription: this.profileAssociatedActivitySubscription(actor),
        germ: actor.germ?.record.messageMe
          ? {
              showButtonTo: actor.germ.record.messageMe.showButtonTo,
              messageMeUrl: actor.germ.record.messageMe.messageMeUrl,
            }
          : undefined,
      },
      joinedViaStarterPack: actor.profile?.joinedViaStarterPack
        ? this.starterPackBasic(actor.profile.joinedViaStarterPack.uri, state)
        : undefined,
      pinnedPost: safePinnedPost(actor.profile?.pinnedPost),
    }
  }
  profile(
    did: DidString,
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
          ? (this.indexedAt({
              sortedAt: actor.sortedAt,
              indexedAt: actor.indexedAt,
            }).toISOString() as DatetimeString)
          : undefined,
    }
  }

  profileBasic(
    did: DidString,
    state: HydrationState,
  ): Un$Typed<ProfileViewBasic> | undefined {
    const actor = state.actors?.get(did)
    if (!actor) return
    const profileUri = atUri(did, app.bsky.actor.profile)
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
      pronouns: actor.profile?.pronouns,
      avatar: actor.profile?.avatar
        ? this.imgUriBuilder.getPresetUri(
            'avatar',
            did,
            getBlobCidString(actor.profile.avatar),
          )
        : undefined,
      // associated.feedgens and associated.lists info not necessarily included
      // on profile and profile-basic views, but should be on profile-detailed.
      associated: {
        labeler: actor.isLabeler ? true : undefined,
        chat: this.profileAssociatedChat(actor),
        activitySubscription: this.profileAssociatedActivitySubscription(actor),
        germ: actor.germ?.record.messageMe
          ? {
              showButtonTo: actor.germ.record.messageMe.showButtonTo,
              messageMeUrl: actor.germ.record.messageMe.messageMeUrl,
            }
          : undefined,
      },
      viewer: this.profileViewer(did, state),
      labels,
      createdAt: actor.createdAt
        ? (actor.createdAt.toISOString() as DatetimeString)
        : undefined,
      verification: this.verification(did, state),
      status: this.status(did, state),
      debug: state.ctx?.includeDebugField ? actor.debug : undefined,
    }
  }

  profileAssociatedChat(actor: Actor): ProfileAssociatedChat | undefined {
    if (!actor.allowIncomingChatsFrom) return undefined
    return {
      allowIncoming: actor.allowIncomingChatsFrom,
      allowGroupInvites: actor.allowGroupChatInvitesFrom,
    }
  }

  profileAssociatedActivitySubscription(
    actor: Actor,
  ): ProfileAssociatedActivitySubscription {
    return { allowSubscriptions: actor.allowActivitySubscriptionsFrom }
  }

  profileKnownFollowers(
    did: DidString,
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

  profileViewer(
    did: DidString,
    state: HydrationState,
  ): ProfileViewer | undefined {
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
      activitySubscription: this.profileViewerActivitySubscription(
        viewer,
        did,
        state,
      ),
    }
  }

  profileViewerActivitySubscription(
    profileViewer: ProfileViewerState,
    did: DidString,
    state: HydrationState,
  ): ActivitySubscription | undefined {
    const actor = state.actors?.get(did)
    if (!actor) return undefined

    const activitySubscription = state.activitySubscriptions?.get(did)
    if (!activitySubscription) return undefined

    const allowFrom = actor.allowActivitySubscriptionsFrom
    const actorFollowsViewer = !!profileViewer.followedBy
    const viewerFollowsActor = !!profileViewer.following
    if (
      (allowFrom === 'followers' && viewerFollowsActor) ||
      (allowFrom === 'mutuals' && actorFollowsViewer && viewerFollowsActor)
    ) {
      return activitySubscription
    }
    return undefined
  }

  profileWebsite(did: DidString, state: HydrationState): UriString | undefined {
    const actor = state.actors?.get(did)
    if (!actor?.profile?.website) return
    const { website } = actor.profile

    // The record property accepts any URI, but we don't want
    // to pass the client any schemes other than HTTPS.
    return website.startsWith('https://') ? website : undefined
  }

  knownFollowers(
    did: DidString,
    state: HydrationState,
  ): KnownFollowers | undefined {
    const knownFollowers = state.knownFollowers?.get(did)
    if (!knownFollowers) return
    const blocks = state.bidirectionalBlocks?.get(did)
    const followers = mapDefined(knownFollowers.followers, (followerDid) => {
      if (this.viewerBlockExists(followerDid, state)) {
        return undefined
      }
      if (blocks?.get(followerDid)) {
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

  verification(
    did: DidString,
    state: HydrationState,
  ): VerificationState | undefined {
    const actor = state.actors?.get(did)
    if (!actor) return

    // Currently, the handle comes as "handle.invalid" from the production dataplane.
    // But the contract allows for empty handle, so we cover both cases.
    if (!actor.handle || actor.handle === INVALID_HANDLE) return

    const isImpersonation = state.labels?.get(did)?.isImpersonation

    const verifications = actor.verifications.map(
      ({ issuer, uri, displayName, handle, createdAt }): VerificationView => {
        // @NOTE: We don't factor-in impersonation when evaluating the validity of each verification,
        // only in the overall profile verification validity.
        // The verification record's `displayName`/`handle` are the *subject's* snapshot at
        // verification time; we compare them to the subject's current values to determine validity.
        const isValid =
          !!displayName &&
          displayName === actor.profile?.displayName &&
          !!handle &&
          handle === actor.handle

        // Expose the *issuer's* current handle/displayName, sourced from the
        // issuer's hydrated actor record (see `Hydrator.hydrateProfiles`).
        const issuerActor = state.actors?.get(issuer)

        return {
          issuer,
          issuerDisplayName: issuerActor?.profile?.displayName,
          issuerHandle: issuerActor?.handle,
          uri,
          isValid,
          createdAt,
        }
      },
    )
    const hasValidVerification = verifications.some((v) => v.isValid)

    const verifiedStatus = verifications.length
      ? hasValidVerification && !isImpersonation
        ? 'valid'
        : 'invalid'
      : 'none'
    const trustedVerifierStatus = actor.trustedVerifier
      ? isImpersonation
        ? 'invalid'
        : 'valid'
      : 'none'

    if (
      verifications.length === 0 &&
      verifiedStatus === 'none' &&
      trustedVerifierStatus === 'none'
    ) {
      return undefined
    }

    return {
      verifications,
      verifiedStatus,
      trustedVerifierStatus,
    }
  }

  status(did: DidString, state: HydrationState): StatusView | undefined {
    const actor = state.actors?.get(did)
    if (!actor?.status) return

    const isViewerStatusOwner = did === state.ctx?.viewer
    const { status } = actor
    const { record, sortedAt, cid, takedownRef } = status
    const isTakenDown = !!takedownRef

    /*
     * Manual filter for takendown status records. If this is ever removed, we
     * need to reinstate `includeTakedowns` handling in the `Actor.getActors`
     * hydrator.
     */
    if (isTakenDown && !isViewerStatusOwner) {
      return undefined
    }

    const uri = atUri(did, app.bsky.actor.status)
    const labels = state.labels?.getBySubject(uri)

    const minDuration = 5 * MINUTE
    const maxDuration = 4 * HOUR

    const expiresAtMs = record.durationMinutes
      ? sortedAt.getTime() +
        Math.max(
          Math.min(record.durationMinutes * MINUTE, maxDuration),
          minDuration,
        )
      : undefined
    const expiresAt = expiresAtMs
      ? (new Date(expiresAtMs).toISOString() as DatetimeString)
      : undefined

    const isActive = expiresAtMs ? expiresAtMs > Date.now() : undefined

    const response: StatusView = {
      uri,
      cid,
      record: record,
      status: record.status,
      embed:
        record.embed && isExternalEmbedType(record.embed)
          ? this.externalEmbed(did, record.embed, state)
          : undefined,
      labels,
      expiresAt,
      isActive,
    }

    if (isViewerStatusOwner) {
      response.isDisabled = isTakenDown
    }

    return response
  }

  blockedProfileViewer(
    did: DidString,
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

  list(
    uri: AtUriString,
    state: HydrationState,
  ): Un$Typed<ListView> | undefined {
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
      indexedAt: this.indexedAt(list).toISOString() as DatetimeString,
    }
  }

  listBasic(
    uri: AtUriString,
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
            getBlobCidString(list.record.avatar),
          )
        : undefined,
      listItemCount: listAgg?.listItems ?? 0,
      indexedAt: this.indexedAt(list).toISOString() as DatetimeString,
      labels,
      viewer: listViewer
        ? {
            muted: !!listViewer.viewerMuted,
            blocked: listViewer.viewerListBlockUri,
          }
        : undefined,
    }
  }

  listItemView(
    uri: AtUriString,
    did: DidString,
    state: HydrationState,
  ): Un$Typed<ListItemView> | undefined {
    const subject = this.profile(did, state)
    if (!subject) return
    return { uri, subject }
  }

  starterPackBasic(
    uri: AtUriString,
    state: HydrationState,
  ): Un$Typed<StarterPackViewBasic> | undefined {
    const sp = state.starterPacks?.get(uri)
    if (!sp) return
    const parsedUri = new AtUri(uri)
    const creator = this.profileBasic(parsedUri.did, state)
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
      indexedAt: this.indexedAt(sp).toISOString() as DatetimeString,
    }
  }

  starterPack(
    uri: AtUriString,
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
    uri?: AtUriString
    cid?: string
    record?:
      | PostRecord
      | LikeRecord
      | RepostRecord
      | FollowRecord
      | ProfileRecord
      | LabelerRecord
      | VerificationRecord
      | NotificationRecordDeleted
  }): Label[] {
    if (!uri || !cid || !record) return []

    // Only these have a "labels" property:
    if (
      !isPostRecordType(record) &&
      !isProfileRecordType(record) &&
      !isLabelerRecordType(record)
    ) {
      return []
    }

    // Ignore if no labels defines
    if (
      !record.labels ||
      !isSelfLabelsType(record.labels) ||
      !record.labels.values.length
    ) {
      return []
    }

    const src = creatorFromUri(uri) // record creator
    const cts =
      typeof record.createdAt === 'string'
        ? normalizeDatetimeAlways(record.createdAt)
        : (new Date(0).toISOString() as DatetimeString)
    return record.labels.values.map(({ val }) => {
      return { src, uri, cid, val, cts }
    })
  }

  labeler(
    did: DidString,
    state: HydrationState,
  ): Un$Typed<LabelerView> | undefined {
    const labeler = state.labelers?.get(did)
    if (!labeler) return
    const creator = this.profile(did, state)
    if (!creator) return
    const viewer = state.labelerViewers?.get(did)
    const aggs = state.labelerAggs?.get(did)

    const uri = atUri(did, app.bsky.labeler.service)
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
      indexedAt: this.indexedAt(labeler).toISOString() as DatetimeString,
      labels,
    }
  }

  labelerDetailed(
    did: DidString,
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
    uri: AtUriString,
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
            getBlobCidString(feedgen.record.avatar),
          )
        : undefined,
      likeCount: aggs?.likes ?? 0,
      acceptsInteractions: feedgen.record.acceptsInteractions,
      labels,
      viewer: viewer
        ? {
            like: viewer.like,
          }
        : undefined,
      contentMode: feedgen.record.contentMode,
      indexedAt: this.indexedAt(feedgen).toISOString() as DatetimeString,
    }
  }

  threadgate(
    uri: AtUriString,
    state: HydrationState,
  ): Un$Typed<ThreadgateView> | undefined {
    const gate = state.threadgates?.get(uri)
    if (!gate) return
    return {
      uri,
      cid: gate.cid,
      record: gate.record,
      lists: mapDefined(gate.record.allow ?? [], (rule) => {
        if (!isListRuleType(rule)) return
        return this.listBasic(rule.list, state)
      }),
    }
  }

  post(
    uri: AtUriString,
    state: HydrationState,
    depth = 0,
  ): Un$Typed<PostView> | undefined {
    const post = state.posts?.get(uri)
    if (!post) return
    const parsedUri = new AtUri(uri)
    const authorDid = parsedUri.did
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
      bookmarkCount: aggs?.bookmarks ?? 0,
      replyCount: aggs?.replies ?? 0,
      repostCount: aggs?.reposts ?? 0,
      likeCount: aggs?.likes ?? 0,
      quoteCount: aggs?.quotes ?? 0,
      indexedAt: this.indexedAt(post).toISOString() as DatetimeString,
      viewer: viewer
        ? {
            repost: viewer.repost,
            like: viewer.like,
            bookmarked: viewer.bookmarked,
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
      debug: state.ctx?.includeDebugField
        ? { post: post.debug, author: author.debug }
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
      reason = this.reasonRepost(item.repost.uri, repost, state)
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

  replyRef(
    uri: AtUriString,
    state: HydrationState,
  ): Un$Typed<ReplyRef> | undefined {
    const postRecord = state.posts?.get(uri)?.record
    if (!postRecord?.reply) return
    let root = this.maybePost(postRecord.reply.root.uri, state)
    let parent = this.maybePost(postRecord.reply.parent.uri, state)
    if (!state.ctx?.include3pBlocks) {
      const childBlocks = state.postBlocks?.get(uri)
      const parentBlocks = state.postBlocks?.get(parent.uri)
      // if child blocks parent, block parent
      if (isPostViewType(parent) && childBlocks?.parent) {
        parent = this.blockedPost(parent.uri, parent.author.did, state)
      }
      // if child or parent blocks root, block root
      if (isPostViewType(root) && (childBlocks?.root || parentBlocks?.root)) {
        root = this.blockedPost(root.uri, root.author.did, state)
      }
    }
    let grandparentAuthor: ProfileViewBasic | undefined
    if (isPostViewType(parent)) {
      // @NOTE The "parent.record" property is of type "unknown" in the lexicon
      // schema, which means that it is typed as LexMap here. In order to avoid
      // (expensive) validation using "isPostRecord(parent.record)", we only
      // check that the "$type" property is a post record type, then use a
      // try/catch to "validate" the post uri.
      if (isPostRecordType(parent.record) && parent.record.reply != null) {
        const uri = (parent.record.reply as any).parent?.uri
        if (typeof uri === 'string') {
          try {
            grandparentAuthor = this.profileBasic(creatorFromUri(uri), state)
          } catch {
            // ignore (just as if validation had failed)
          }
        }
      }
    }
    return {
      root,
      parent,
      grandparentAuthor,
    }
  }

  maybePost(uri: AtUriString, state: HydrationState): $Typed<MaybePostView> {
    const post = this.post(uri, state)
    if (!post) {
      return this.notFoundPost(uri)
    }
    if (this.viewerBlockExists(post.author.did, state)) {
      return this.blockedPost(uri, post.author.did, state)
    }
    return app.bsky.feed.defs.postView.$build(post)
  }

  blockedPost(
    uri: AtUriString,
    authorDid: DidString,
    state: HydrationState,
  ): $Typed<BlockedPost> {
    return app.bsky.feed.defs.blockedPost.$build({
      uri,
      blocked: true,
      author: {
        did: authorDid,
        viewer: this.blockedProfileViewer(authorDid, state),
      },
    })
  }

  notFoundPost(uri: AtUriString): $Typed<NotFoundPost> {
    return app.bsky.feed.defs.notFoundPost.$build({
      uri,
      notFound: true,
    })
  }

  reasonRepost(
    uri: AtUriString,
    repost: Repost,
    state: HydrationState,
  ): $Typed<ReasonRepost> | undefined {
    const creatorDid = creatorFromUri(uri)
    const creator = this.profileBasic(creatorDid, state)
    if (!creator) return
    return app.bsky.feed.defs.reasonRepost.$build({
      by: creator,
      uri,
      cid: repost.cid,
      indexedAt: this.indexedAt(repost).toISOString() as DatetimeString,
    })
  }

  reasonPin(): $Typed<ReasonPin> {
    return app.bsky.feed.defs.reasonPin.$build({})
  }

  // Bookmarks
  // ------------
  bookmark(
    key: string,
    state: HydrationState,
  ): Un$Typed<BookmarkView> | undefined {
    const viewer = state.ctx?.viewer
    if (!viewer) return

    const bookmark = state.bookmarks?.get(viewer)?.get(key)
    if (!bookmark) return

    const atUri = new AtUri(bookmark.subjectUri)
    if (atUri.collection !== app.bsky.feed.post.$type) return

    const item = this.maybePost(atUri.href, state)
    return {
      createdAt: bookmark.indexedAt
        ? (bookmark.indexedAt.toISOString() as DatetimeString)
        : undefined,
      subject: {
        uri: atUri.href,
        cid: bookmark.subjectCid,
      },
      item,
    }
  }

  // Threads
  // ------------

  thread(
    skele: { anchor: AtUriString; uris: AtUriString[] },
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
    const childrenByParentUri: Record<AtUriString, AtUriString[]> = {}
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

    return app.bsky.feed.defs.threadViewPost.$build({
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
    })
  }

  threadParent(
    childUri: AtUriString,
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
    return app.bsky.feed.defs.threadViewPost.$build({
      post,
      parent: this.threadParent(parentUri, rootUri, state, height - 1),
      threadContext: {
        rootAuthorLike: state.threadContexts?.get(post.uri)?.like,
      },
    })
  }

  threadReplies(
    parentUri: AtUriString,
    rootUri: AtUriString,
    childrenByParentUri: Record<AtUriString, AtUriString[]>,
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
      return app.bsky.feed.defs.threadViewPost.$build({
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
      })
    })
  }

  // Threads V2
  // ------------

  threadV2(
    skeleton: { anchor: AtUriString; uris: AtUriString[] },
    state: HydrationState,
    {
      above,
      below,
      branchingFactor,
      sort,
    }: {
      above: number
      below: number
      branchingFactor: number
      sort: GetPostThreadV2QueryParams['sort']
    },
  ): { hasOtherReplies: boolean; thread: ThreadItem[] } {
    const { anchor: anchorUri, uris } = skeleton

    // Not found.
    const postView = this.post(anchorUri, state)
    const post = state.posts?.get(anchorUri)
    if (!post || !postView) {
      return {
        hasOtherReplies: false,
        thread: [
          this.threadV2ItemNotFound({
            uri: anchorUri,
            depth: 0,
          }),
        ],
      }
    }

    // Blocked (only 1p for anchor).
    if (this.viewerBlockExists(postView.author.did, state)) {
      return {
        hasOtherReplies: false,
        thread: [
          this.threadV2ItemBlocked({
            uri: anchorUri,
            depth: 0,
            authorDid: postView.author.did,
            state,
          }),
        ],
      }
    }

    const childrenByParentUri = this.groupThreadChildrenByParent(
      anchorUri,
      uris,
      state,
    )
    const rootUri = getRootUri(anchorUri, post)
    const opDid = uriToDid(rootUri)
    const authorDid = postView.author.did
    const isOPPost = authorDid === opDid
    const anchorViolatesThreadGate = post.violatesThreadGate

    // Builds the parent tree, and whether it is a contiguous OP thread.
    const parentTree = !anchorViolatesThreadGate
      ? this.threadV2Parent(
          {
            childUri: anchorUri,
            opDid,
            rootUri,

            above,
            depth: -1,
          },
          state,
        )
      : undefined

    const { tree: parent, isOPThread: isOPThreadFromRootToParent } =
      parentTree ?? { tree: undefined, isOPThread: false }

    const isOPThread = parent
      ? isOPThreadFromRootToParent && isOPPost
      : isOPPost

    const anchorDepth = 0 // The depth of the anchor post is always 0.
    let anchorTree: ThreadTree
    let hasOtherReplies = false

    if (this.noUnauthenticatedPost(state, postView)) {
      anchorTree = {
        type: 'noUnauthenticated',
        item: this.threadV2ItemNoUnauthenticated({
          uri: anchorUri,
          depth: anchorDepth,
        }),
        parent,
      }
    } else {
      const { replies, hasOtherReplies: hasOtherRepliesShadow } =
        !anchorViolatesThreadGate
          ? this.threadV2Replies(
              {
                parentUri: anchorUri,
                isOPThread,
                opDid,
                rootUri,
                childrenByParentUri,
                below,
                depth: 1,
                branchingFactor,
              },
              state,
            )
          : { replies: undefined, hasOtherReplies: false }
      hasOtherReplies = hasOtherRepliesShadow

      anchorTree = {
        type: 'post',
        item: this.threadV2ItemPost({
          depth: anchorDepth,
          isOPThread,
          postView,
          repliesAllowance: Infinity, // While we don't have pagination.
          uri: anchorUri,
        }),
        tags: post.tags,
        hasOPLike: !!state.threadContexts?.get(postView.uri)?.like,
        parent,
        replies,
      }
    }

    const thread = sortTrimFlattenThreadTree(
      anchorTree,
      {
        opDid,
        branchingFactor,
        sort,
        viewer: state.ctx?.viewer ?? null,
        threadTagsBumpDown: this.threadTagsBumpDown,
        threadTagsHide: this.threadTagsHide,
        visibilityTagRankPrefix: this.visibilityTagRankPrefix,
      },
      state.ctx?.features.checkGate(
        state.ctx.features.Gate.ThreadsReplyRankingExplorationEnable,
      ),
    )

    return {
      hasOtherReplies,
      thread,
    }
  }

  private threadV2Parent(
    {
      childUri,
      opDid,
      rootUri,
      above,
      depth,
    }: {
      childUri: AtUriString
      opDid: DidString
      rootUri: AtUriString
      above: number
      depth: number
    },
    state: HydrationState,
  ): { tree: ThreadTreeVisible; isOPThread: boolean } | undefined {
    // Reached the `above` limit.
    if (Math.abs(depth) > above) {
      return undefined
    }

    // Not found.
    const uri = state.posts?.get(childUri)?.record.reply?.parent.uri
    if (!uri) {
      return undefined
    }
    const postView = this.post(uri, state)
    const post = state.posts?.get(uri)
    if (!post || !postView) {
      return {
        tree: {
          type: 'notFound',
          item: this.threadV2ItemNotFound({ uri, depth }),
        },
        isOPThread: false,
      }
    }
    if (rootUri !== getRootUri(uri, post)) {
      // Outside thread boundary.
      return undefined
    }

    // Blocked (1p and 3p for parent).
    const authorDid = postView.author.did
    const has1pBlock = this.viewerBlockExists(authorDid, state)
    const has3pBlock =
      !state.ctx?.include3pBlocks && state.postBlocks?.get(childUri)?.parent
    if (has1pBlock || has3pBlock) {
      return {
        tree: {
          type: 'blocked',
          item: this.threadV2ItemBlocked({
            uri,
            depth,
            authorDid,
            state,
          }),
        },
        isOPThread: false,
      }
    }

    // Recurse up.
    const parentTree = this.threadV2Parent(
      {
        childUri: uri,
        opDid,
        rootUri,
        above,
        depth: depth - 1,
      },
      state,
    )
    const { tree: parent, isOPThread: isOPThreadFromRootToParent } =
      parentTree ?? { tree: undefined, isOPThread: false }

    const isOPPost = authorDid === opDid
    const isOPThread = parent
      ? isOPThreadFromRootToParent && isOPPost
      : isOPPost

    if (this.noUnauthenticatedPost(state, postView)) {
      return {
        tree: {
          type: 'noUnauthenticated',
          item: this.threadV2ItemNoUnauthenticated({
            uri,
            depth,
          }),
          parent,
        },
        isOPThread,
      }
    }

    const parentUri = post.record.reply?.parent.uri
    const hasMoreParents = !!parentUri && !parent

    return {
      tree: {
        type: 'post',
        item: this.threadV2ItemPost({
          depth,
          isOPThread,
          moreParents: hasMoreParents,
          postView,
          uri,
        }),
        tags: post.tags,
        hasOPLike: !!state.threadContexts?.get(postView.uri)?.like,
        parent,
        replies: undefined,
      },
      isOPThread,
    }
  }

  private threadV2Replies(
    {
      parentUri,
      isOPThread: isOPThreadFromRootToParent,
      opDid,
      rootUri,
      childrenByParentUri,
      below,
      depth,
      branchingFactor,
    }: {
      parentUri: AtUriString
      isOPThread: boolean
      opDid: string
      rootUri: AtUriString
      childrenByParentUri: Record<AtUriString, AtUriString[]>
      below: number
      depth: number
      branchingFactor: number
    },
    state: HydrationState,
  ): { replies: ThreadTreeVisible[] | undefined; hasOtherReplies: boolean } {
    // Reached the `below` limit.
    if (depth > below) {
      return { replies: undefined, hasOtherReplies: false }
    }

    const childrenUris: AtUriString[] = childrenByParentUri[parentUri] ?? []
    let hasOtherReplies = false
    const replies = mapDefined(childrenUris, (uri) => {
      const replyInclusion = this.checkThreadV2ReplyInclusion({
        uri,
        rootUri,
        state,
      })
      if (!replyInclusion) {
        return undefined
      }
      const { authorDid, post, postView } = replyInclusion

      // Hidden.
      const { isOther } = this.isOtherThreadPost(
        { post, postView, rootUri, uri },
        state,
      )
      if (isOther) {
        // Only care about anchor replies
        if (depth === 1) {
          hasOtherReplies = true
        }
        return undefined
      }

      // Recurse down.
      const isOPThread = isOPThreadFromRootToParent && authorDid === opDid
      const { replies: nestedReplies } = this.threadV2Replies(
        {
          parentUri: uri,
          isOPThread,
          opDid,
          rootUri,
          childrenByParentUri,
          below,
          depth: depth + 1,
          branchingFactor,
        },
        state,
      )

      const reachedDepth = depth === below
      const repliesAllowance = reachedDepth ? 0 : branchingFactor

      const tree: ThreadTree = {
        type: 'post',
        item: this.threadV2ItemPost({
          depth,
          isOPThread,
          postView,
          repliesAllowance,
          uri,
        }),
        tags: post.tags,
        hasOPLike: !!state.threadContexts?.get(postView.uri)?.like,
        parent: undefined,
        replies: nestedReplies,
      }

      return tree
    })

    return {
      replies,
      hasOtherReplies,
    }
  }

  private threadV2ItemPost({
    depth,
    isOPThread,
    moreParents,
    postView,
    repliesAllowance,
    uri,
  }: {
    depth: number
    isOPThread: boolean
    moreParents?: boolean
    postView: PostView
    repliesAllowance?: number
    uri: AtUriString
  }): ThreadItemValuePost {
    const moreReplies =
      repliesAllowance === undefined
        ? 0
        : Math.max((postView.replyCount ?? 0) - repliesAllowance, 0)

    return {
      uri,
      depth,
      value: app.bsky.unspecced.defs.threadItemPost.$build({
        post: postView,
        moreParents: moreParents ?? false,
        moreReplies,
        opThread: isOPThread,
        hiddenByThreadgate: false, // Hidden posts are handled by threadOtherV2
        mutedByViewer: false, // Hidden posts are handled by threadOtherV2
      }),
    }
  }

  private threadV2ItemNoUnauthenticated({
    uri,
    depth,
  }: {
    uri: AtUriString
    depth: number
  }): ThreadItemValueNoUnauthenticated {
    return {
      uri,
      depth,
      value: app.bsky.unspecced.defs.threadItemNoUnauthenticated.$build({}),
    }
  }

  private threadV2ItemNotFound({
    uri,
    depth,
  }: {
    uri: AtUriString
    depth: number
  }): ThreadItemValueNotFound {
    return {
      uri,
      depth,
      value: app.bsky.unspecced.defs.threadItemNotFound.$build({}),
    }
  }

  private threadV2ItemBlocked({
    uri,
    depth,
    authorDid,
    state,
  }: {
    uri: AtUriString
    depth: number
    authorDid: DidString
    state: HydrationState
  }): ThreadItemValueBlocked {
    return {
      uri,
      depth,
      value: app.bsky.unspecced.defs.threadItemBlocked.$build({
        author: {
          did: authorDid,
          viewer: this.blockedProfileViewer(authorDid, state),
        },
      }),
    }
  }

  threadOtherV2(
    skeleton: { anchor: AtUriString; uris: AtUriString[] },
    state: HydrationState,
    {
      below,
      branchingFactor,
    }: {
      below: number
      branchingFactor: number
    },
  ): ThreadOtherItem[] {
    const { anchor: anchorUri, uris } = skeleton

    // Not found.
    const postView = this.post(anchorUri, state)
    const post = state.posts?.get(anchorUri)
    if (!post || !postView) {
      return []
    }

    // Blocked (only 1p for anchor).
    if (this.viewerBlockExists(postView.author.did, state)) {
      return []
    }

    const childrenByParentUri = this.groupThreadChildrenByParent(
      anchorUri,
      uris,
      state,
    )
    const rootUri = getRootUri(anchorUri, post)
    const opDid = uriToDid(rootUri)

    const anchorTree: ThreadOtherAnchorPostNode = {
      type: 'hiddenAnchor',
      item: this.threadOtherV2ItemPostAnchor({ depth: 0, uri: anchorUri }),
      replies: this.threadOtherV2Replies(
        {
          parentUri: anchorUri,
          rootUri,
          childrenByParentUri,
          below,
          depth: 1,
        },
        state,
      ),
    }

    return sortTrimFlattenThreadTree(
      anchorTree,
      {
        opDid,
        branchingFactor,
        viewer: state.ctx?.viewer ?? null,
        threadTagsBumpDown: this.threadTagsBumpDown,
        threadTagsHide: this.threadTagsHide,
        visibilityTagRankPrefix: this.visibilityTagRankPrefix,
      },
      state.ctx?.features.checkGate(
        state.ctx.features.Gate.ThreadsReplyRankingExplorationEnable,
      ),
    )
  }

  private threadOtherV2Replies(
    {
      parentUri,
      rootUri,
      childrenByParentUri,
      below,
      depth,
    }: {
      parentUri: AtUriString
      rootUri: AtUriString
      childrenByParentUri: Record<AtUriString, AtUriString[]>
      below: number
      depth: number
    },
    state: HydrationState,
  ): ThreadOtherPostNode[] | undefined {
    // Reached the `below` limit.
    if (depth > below) {
      return undefined
    }

    const childrenUris: AtUriString[] = childrenByParentUri[parentUri] ?? []
    return mapDefined(childrenUris, (uri) => {
      const replyInclusion = this.checkThreadV2ReplyInclusion({
        uri,
        rootUri,
        state,
      })
      if (!replyInclusion) {
        return undefined
      }
      const { post, postView } = replyInclusion

      // Other posts to pull out
      const { isOther, hiddenByThreadgate, mutedByViewer } =
        this.isOtherThreadPost({ post, postView, rootUri, uri }, state)
      if (isOther) {
        // Only show hidden anchor replies, not all hidden.
        if (depth > 1) {
          return undefined
        }
      } else if (depth === 1) {
        // Don't include non-hidden anchor replies.
        return undefined
      }

      // Recurse down.
      const replies = this.threadOtherV2Replies(
        {
          parentUri: uri,
          rootUri,
          childrenByParentUri,
          below,
          depth: depth + 1,
        },
        state,
      )

      const item = this.threadOtherV2ItemPost({
        depth,
        hiddenByThreadgate,
        mutedByViewer,
        postView,
        uri,
      })

      const tree: ThreadOtherPostNode = {
        type: 'hiddenPost',
        item: item,
        tags: post.tags,
        replies,
      }

      return tree
    })
  }

  private threadOtherV2ItemPostAnchor({
    depth,
    uri,
  }: {
    depth: number
    uri: AtUriString
  }): ThreadOtherAnchorPostNode['item'] {
    return {
      uri,
      depth,
      // In hidden replies, the anchor value is undefined, so it doesn't include the anchor in the result.
      // This is helpful so we can use the same internal structure for hidden and non-hidden, while omitting anchor for hidden.
      value: undefined,
    }
  }

  private threadOtherV2ItemPost({
    depth,
    hiddenByThreadgate,
    mutedByViewer,
    postView,
    uri,
  }: {
    depth: number
    hiddenByThreadgate: boolean
    mutedByViewer: boolean
    postView: PostView
    uri: AtUriString
  }): ThreadOtherItemValuePost {
    const base = this.threadOtherV2ItemPostAnchor({ depth, uri })
    return {
      ...base,
      value: app.bsky.unspecced.defs.threadItemPost.$build({
        post: postView,
        hiddenByThreadgate,
        mutedByViewer,
        moreParents: false, // "Other" replies don't have parents.
        moreReplies: 0, // "Other" replies don't have replies hydrated.
        opThread: false, // "Other" replies don't contain OP threads.
      }),
    }
  }

  private checkThreadV2ReplyInclusion({
    uri,
    rootUri,
    state,
  }: {
    uri: AtUriString
    rootUri: string
    state: HydrationState
  }): {
    authorDid: string
    post: Post
    postView: PostView
  } | null {
    // Not found.
    const post = state.posts?.get(uri)
    if (post?.violatesThreadGate) {
      return null
    }
    const postView = this.post(uri, state)
    if (!post || !postView) {
      return null
    }
    const authorDid = postView.author.did
    if (rootUri !== getRootUri(uri, post)) {
      // outside thread boundary
      return null
    }

    // Blocked (1p and 3p for replies).
    const has1pBlock = this.viewerBlockExists(authorDid, state)
    const has3pBlock =
      !state.ctx?.include3pBlocks && state.postBlocks?.get(uri)?.parent
    if (has1pBlock || has3pBlock) {
      return null
    }
    if (!this.viewerSeesNeedsReview({ uri, did: authorDid }, state)) {
      return null
    }

    // No unauthenticated.
    if (this.noUnauthenticatedPost(state, postView)) {
      return null
    }

    return { authorDid, post, postView }
  }

  private isOtherThreadPost(
    {
      post,
      postView,
      rootUri,
      uri,
    }: {
      post: Post
      postView: PostView
      rootUri: AtUriString
      uri: AtUriString
    },
    state: HydrationState,
  ): {
    isOther: boolean
    hiddenByTag: boolean
    hiddenByThreadgate: boolean
    mutedByViewer: boolean
  } {
    const opDid = creatorFromUri(rootUri)
    const authorDid = creatorFromUri(uri)

    let hiddenByTag = false
    if (
      state.ctx?.features.checkGate(
        state.ctx.features.Gate.ThreadsReplyRankingExplorationEnable,
      )
    ) {
      hiddenByTag = authorDid !== opDid && post.tags.has(this.visibilityTagHide)
    } else {
      const showBecauseFollowing = !!postView.author.viewer?.following
      hiddenByTag =
        authorDid !== opDid &&
        authorDid !== state.ctx?.viewer &&
        !showBecauseFollowing &&
        this.threadTagsHide.some((t) => post.tags.has(t))
    }

    const hiddenByThreadgate =
      state.ctx?.viewer !== authorDid &&
      this.replyIsHiddenByThreadgate(uri, rootUri, state)

    const mutedByViewer = this.viewerMuteExists(authorDid, state)
    const isPushPin =
      isPostRecordType(post.record) && post.record.text.trim() === '📌'

    return {
      isOther: hiddenByTag || hiddenByThreadgate || mutedByViewer || isPushPin,
      hiddenByTag,
      hiddenByThreadgate,
      mutedByViewer,
    }
  }

  private groupThreadChildrenByParent(
    anchorUri: AtUriString,
    uris: AtUriString[],
    state: HydrationState,
  ): Record<AtUriString, AtUriString[]> {
    // Groups children of each parent.
    const includedPosts = new Set<AtUriString>([anchorUri])
    const childrenByParentUri: Record<AtUriString, AtUriString[]> = {}
    uris.forEach((uri) => {
      const post = state.posts?.get(uri)
      const parentUri = post?.record.reply?.parent.uri
      if (!parentUri) return
      if (includedPosts.has(uri)) return
      includedPosts.add(uri)
      childrenByParentUri[parentUri] ??= []
      childrenByParentUri[parentUri].push(uri)
    })
    return childrenByParentUri
  }

  // Embeds
  // ------------

  embed(
    postUri: AtUriString,
    embed: $Typed<Embed> | Unknown$TypedObject,
    state: HydrationState,
    depth: number,
  ): $Typed<EmbedView> | undefined {
    if (isImagesEmbedType(embed)) {
      return this.imagesEmbed(creatorFromUri(postUri), embed)
    } else if (isVideoEmbedType(embed)) {
      return this.videoEmbed(creatorFromUri(postUri), embed)
    } else if (isGalleryEmbedType(embed)) {
      return this.galleryEmbed(creatorFromUri(postUri), embed)
    } else if (isExternalEmbedType(embed)) {
      return this.externalEmbed(creatorFromUri(postUri), embed, state)
    } else if (isRecordEmbedType(embed)) {
      return this.recordEmbed(postUri, embed, state, depth)
    } else if (isRecordWithMediaType(embed)) {
      return this.recordWithMediaEmbed(postUri, embed, state, depth)
    } else {
      return undefined
    }
  }

  imagesEmbed(did: DidString, embed: ImagesEmbed): $Typed<ImagesEmbedView> {
    const imgViews = embed.images.map((img) => ({
      thumb: this.imgUriBuilder.getPresetUri(
        'feed_thumbnail',
        did,
        getBlobCidString(img.image),
      ),
      fullsize: this.imgUriBuilder.getPresetUri(
        'feed_fullsize',
        did,
        getBlobCidString(img.image),
      ),
      alt: img.alt,
      aspectRatio: img.aspectRatio,
    }))
    return app.bsky.embed.images.view.$build({
      images: imgViews,
    })
  }

  videoEmbed(did: DidString, embed: VideoEmbed): $Typed<VideoEmbedView> {
    const cid = getBlobCidString(embed.video)
    return app.bsky.embed.video.view.$build({
      cid,
      playlist: this.videoUriBuilder.playlist({ did, cid }),
      thumbnail: this.videoUriBuilder.thumbnail({ did, cid }),
      alt: embed.alt,
      aspectRatio: embed.aspectRatio,
      presentation: embed.presentation,
    })
  }

  galleryEmbed(did: DidString, embed: GalleryEmbed): $Typed<GalleryEmbedView> {
    // The lexicon's schema-level cap is 20, but clients are expected to
    // enforce a soft limit of 10. Trim defensively at the view boundary so
    // viewers see at most 10 items regardless of what was authored.
    const items = embed.items.slice(0, GALLERY_SOFT_LIMIT).flatMap((item) => {
      const view = this.galleryItemView(did, item)
      return view ? [view] : []
    })
    return app.bsky.embed.gallery.view.$build({ items })
  }

  private galleryItemView(
    did: DidString,
    item: GalleryEmbed['items'][number],
  ): $Typed<GalleryImageEmbedView> | undefined {
    if (isGalleryImageEmbedType(item)) {
      return this.galleryImageView(did, item)
    }
    return undefined
  }

  private galleryImageView(
    did: DidString,
    item: GalleryImageEmbed,
  ): $Typed<GalleryImageEmbedView> {
    return app.bsky.embed.gallery.viewImage.$build({
      thumbnail: this.imgUriBuilder.getPresetUri(
        'feed_thumbnail',
        did,
        getBlobCidString(item.image),
      ),
      fullsize: this.imgUriBuilder.getPresetUri(
        'feed_fullsize',
        did,
        getBlobCidString(item.image),
      ),
      alt: item.alt,
      aspectRatio: item.aspectRatio,
    })
  }

  externalEmbed(
    did: DidString,
    embed: ExternalEmbed,
    state: HydrationState,
  ): $Typed<ExternalEmbedView> {
    // Start from the post-author-supplied embed values, then spread the
    // SS-derived view on top so any field the hydrated doc/publication
    // supplies wins (title, description, thumb, source, etc). When no SS
    // records were hydrated `ssView` is `undefined` and the spread is a
    // no-op, leaving the base values in place. `associatedRefs` is set
    // last because the post is authoritative about what was pinned.
    const ssView = this.externalEmbedFromStandardSite({
      associatedRefs: embed.external.associatedRefs,
      state,
      assumedUrl: embed.external.uri,
    })
    // The author-supplied (scraped) thumbnail always wins when present —
    // it's the per-article OG image. Only when the embed has no thumb do
    // we fall back to whatever the SS overlay provides (the document's
    // `coverImage`). `thumb` is set after the `...ssView` spread so the
    // overlay's `coverImage`-derived thumb can't clobber the embed's.
    const embeddedThumb = embed.external.thumb
      ? this.imgUriBuilder.getPresetUri(
          'feed_thumbnail',
          did,
          getBlobCidString(embed.external.thumb),
        )
      : undefined
    return app.bsky.embed.external.view.$build({
      external: {
        uri: embed.external.uri,
        title: embed.external.title,
        description: embed.external.description,
        ...ssView,
        thumb: embeddedThumb ?? ssView?.thumb,
        associatedRefs: embed.external.associatedRefs,
      },
    })
  }

  /**
   * Read-path entry point: caller has the post's `external.associatedRefs[]`
   * and the global hydration state, and we resolve the matching SS records
   * by ref. Used by `externalEmbed`.
   *
   * Returns a fully-populated `viewExternal['external']` shape (including
   * the required `uri`/`title`/`description`), or `undefined` if the
   * records didn't hydrate, didn't pass URL validation, or couldn't
   * supply the required fields. Callers spread the result over a base
   * view to layer SS-derived fields on top of post-author-supplied ones.
   *
   * `assumedUrl` is the canonical web URL the embed claims to represent
   * (the post's `external.uri` on the read path, the request's `url` on
   * compose). Validation logic uses it to confirm the SS records actually
   * back that URL, and the same value is echoed back as `uri` on the
   * returned overlay.
   */
  externalEmbedFromStandardSite({
    associatedRefs,
    state,
    assumedUrl,
  }: {
    associatedRefs: ExternalEmbed['external']['associatedRefs']
    state: HydrationState
    assumedUrl: string
  }): ExternalEmbedView['external'] | undefined {
    const { document, publication } =
      getSiteStandardRecordsFromHydrationMapsByRefs(
        associatedRefs,
        state.siteStandardDocuments,
        state.siteStandardPublications,
      )
    return this.externalEmbedFromStandardSiteRecords({
      document,
      publication,
      state,
      assumedUrl,
    })
  }

  /**
   * Compose-path entry point: caller already knows which document and
   * publication backed the request and has them in hand (e.g. from
   * iterating the SS hydration maps directly). Skips the by-ref lookup
   * that `externalEmbedFromStandardSite` does. Used by
   * `getEmbedExternalView`.
   *
   * Returns a fully-populated `viewExternal['external']` shape (including
   * the required `uri`/`title`/`description`), or `undefined` if any of
   * the validation gates rejected the pair or the records couldn't
   * supply the required fields.
   *
   * `state` is still needed for label hydration. `assumedUrl` is the
   * canonical web URL the embed claims to represent (the post's
   * `external.uri` on the read path, the request's `url` on compose);
   * validation logic uses it to confirm the SS records actually back that
   * URL, and the same value is echoed back as `uri` on the returned
   * overlay.
   */
  externalEmbedFromStandardSiteRecords({
    document,
    publication,
    state,
    assumedUrl,
  }: {
    document: AssociatedSiteStandardRecord<SiteStandardDocument> | undefined
    publication:
      | AssociatedSiteStandardRecord<SiteStandardPublication>
      | undefined
    state: HydrationState
    assumedUrl: string
  }): ExternalEmbedView['external'] | undefined {
    // Three layers of validation gate this overlay:
    //
    //  1. Hydrator nulls taken-down records and mirrors the null across
    //     doc/pub pairs (see `actionSiteStandardTakedownLabels` in
    //     `hydration/hydrator.ts`).
    //  2. The lookups guarantee structural agreement between doc and pub
    //     — matching `site`/`uri`, no orphan doc claiming a missing
    //     publication (see `getSiteStandardRecordsFromHydrationMapsByRefs`
    //     and `…ByDocumentUri` in `hydration/external.ts`).
    //  3. `validateStandardSiteForUrl` below checks that the records back
    //     the URL the embed claims (see `util/standard-site.ts`).
    //
    // If any layer rejected, callers see `undefined` and fall back to the
    // bare embed rather than render partial / disagreeing enrichment.
    if (!document && !publication) return undefined
    if (!validateStandardSiteForUrl(document, publication, assumedUrl)) {
      viewsLogger.warn(
        {
          documentUri: document?.ref.uri,
          publicationUri: publication?.ref.uri,
        },
        'site.standard URL validation failed',
      )
      return undefined
    }

    // viewExternal requires `title` and `description`. If neither side of
    // the pair supplies usable values for both, there's no enrichment to
    // render — return undefined and let the caller fall back.
    let title: string
    let description: string
    if (document?.info.record) {
      // Treat the document as authoritative for both fields as a unit, so
      // we never blend a doc's title with a publication's description.
      title = document.info.record.title
      description = document.info.record.description ?? ''
    } else if (publication) {
      title = publication.info.record.name
      description = publication.info.record.description ?? ''
    } else {
      return undefined
    }

    // if we don't have a title at this point, something is wrong with the SS
    // record (it's a required field) and therefore the enrichment isn't worth
    // showing
    if (!title) return undefined

    const overlay: ExternalEmbedView['external'] = {
      // @ts-ignore this is mis-typed
      uri: assumedUrl,
      title,
      description,
    }

    const docCover = document?.info.record.coverImage
    if (docCover) {
      overlay.thumb = this.imgUriBuilder.getPresetUri(
        'feed_thumbnail',
        creatorFromUri(document.ref.uri),
        getBlobCidString(docCover),
      )
    }

    if (document?.info.record.publishedAt) {
      overlay.createdAt = document.info.record.publishedAt
    }
    if (document?.info.record.updatedAt) {
      overlay.updatedAt = document.info.record.updatedAt
    }
    const readingTime = document?.info.record.textContent
      ? estimateReadingTimeMinutes(document.info.record.textContent)
      : undefined
    if (readingTime !== undefined) overlay.readingTime = readingTime

    // Merge labels applied to either the document or the publication onto the
    // same `viewExternal.labels` array — clients moderate the embed as single
    // unit, so doc-scoped and publication-scoped labels end up in the same
    // bucket.
    const labels = [
      ...(document ? state.labels?.getBySubject(document.ref.uri) ?? [] : []),
      ...(publication
        ? state.labels?.getBySubject(publication.ref.uri) ?? []
        : []),
    ]
    if (labels.length) overlay.labels = labels

    if (publication) {
      overlay.source = this.externalEmbedSource(publication)
    }

    // Profiles of the owners of the records backing this embed. Hydrator
    // covers these DIDs alongside post-author profiles, so misses here
    // only happen when an actor is unavailable (suspended, deleted, etc.)
    // — drop those rather than emit `undefined` slots.
    const uniqueDids = dedupeStrs(
      mapDefined([document?.ref.uri, publication?.ref.uri], (uri) =>
        uri ? uriToDid(uri) : undefined,
      ) as DidString[],
    )
    const associatedProfiles = mapDefined(uniqueDids, (did) =>
      this.profileBasic(did, state),
    ) as ProfileViewBasic[]
    if (associatedProfiles.length)
      overlay.associatedProfiles = associatedProfiles

    return overlay
  }

  externalEmbedSource(
    publication: AssociatedSiteStandardRecord<SiteStandardPublication>,
  ): $Typed<ExternalEmbedSourceView> {
    const { record } = publication.info
    const pubDid = creatorFromUri(publication.ref.uri)
    return app.bsky.embed.external.viewExternalSource.$build({
      uri: record.url,
      icon: record.icon
        ? this.imgUriBuilder.getPresetUri(
            'avatar',
            pubDid,
            getBlobCidString(record.icon),
          )
        : undefined,
      title: record.name,
      description: record.description,
      theme: record.basicTheme
        ? externalEmbedSourceTheme(record.basicTheme)
        : undefined,
    })
  }

  embedNotFound(uri: AtUriString): $Typed<RecordEmbedView> {
    return app.bsky.embed.record.view.$build({
      record: app.bsky.embed.record.viewNotFound.$build({
        uri,
        notFound: true,
      }),
    })
  }

  embedDetached(uri: AtUriString): $Typed<RecordEmbedView> {
    return app.bsky.embed.record.view.$build({
      record: app.bsky.embed.record.viewDetached.$build({
        uri,
        detached: true,
      }),
    })
  }

  embedBlocked(
    uri: AtUriString,
    state: HydrationState,
  ): $Typed<RecordEmbedView> {
    const creator = creatorFromUri(uri)
    return app.bsky.embed.record.view.$build({
      record: app.bsky.embed.record.viewBlocked.$build({
        uri,
        blocked: true,
        author: {
          did: creator,
          viewer: this.blockedProfileViewer(creator, state),
        },
      }),
    })
  }

  embedPostView(
    uri: AtUriString,
    state: HydrationState,
    depth: number,
  ): $Typed<PostEmbedView> | undefined {
    const postView = this.post(uri, state, depth)
    if (!postView) return
    return app.bsky.embed.record.viewRecord.$build({
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
    })
  }

  recordEmbed(
    postUri: AtUriString,
    embed: RecordEmbed,
    state: HydrationState,
    depth: number,
    withTypeTag: false,
  ): RecordEmbedView
  recordEmbed(
    postUri: AtUriString,
    embed: RecordEmbed,
    state: HydrationState,
    depth: number,
    withTypeTag?: true,
  ): $Typed<RecordEmbedView>
  recordEmbed(
    postUri: AtUriString,
    embed: RecordEmbed,
    state: HydrationState,
    depth: number,
    withTypeTag = true,
  ): RecordEmbedView {
    const uri = embed.record.uri
    const parsedUri = new AtUri(uri)
    if (
      this.viewerBlockExists(parsedUri.did, state) ||
      (!state.ctx?.include3pBlocks && state.postBlocks?.get(postUri)?.embed)
    ) {
      return this.embedBlocked(uri, state)
    }

    const post = state.posts?.get(postUri)
    if (post?.violatesEmbeddingRules) {
      return this.embedDetached(uri)
    }

    if (parsedUri.collection === app.bsky.feed.post.$type) {
      const view = this.embedPostView(uri, state, depth)
      if (!view) return this.embedNotFound(uri)
      const postgateRecordUri = postUriToPostgateUri(parsedUri.toString())
      const postgate = state.postgates?.get(postgateRecordUri)
      if (postgate?.record?.detachedEmbeddingUris?.includes(postUri)) {
        return this.embedDetached(uri)
      }
      return this.recordEmbedWrapper(view, withTypeTag)
    } else if (parsedUri.collection === app.bsky.feed.generator.$type) {
      const view = this.feedGenerator(uri, state)
      if (!view) return this.embedNotFound(uri)
      return this.recordEmbedWrapper(
        app.bsky.feed.defs.generatorView.$build(view),
        withTypeTag,
      )
    } else if (parsedUri.collection === app.bsky.graph.list.$type) {
      const view = this.list(uri, state)
      if (!view) return this.embedNotFound(uri)
      return this.recordEmbedWrapper(
        app.bsky.graph.defs.listView.$build(view),
        withTypeTag,
      )
    } else if (parsedUri.collection === app.bsky.labeler.service.$type) {
      const view = this.labeler(parsedUri.did, state)
      if (!view) return this.embedNotFound(uri)
      return this.recordEmbedWrapper(
        app.bsky.labeler.defs.labelerView.$build(view),
        withTypeTag,
      )
    } else if (parsedUri.collection === app.bsky.graph.starterpack.$type) {
      const view = this.starterPackBasic(uri, state)
      if (!view) return this.embedNotFound(uri)
      return this.recordEmbedWrapper(
        app.bsky.graph.defs.starterPackViewBasic.$build(view),
        withTypeTag,
      )
    }
    return this.embedNotFound(uri)
  }

  private recordEmbedWrapper<T extends $Typed<RecordEmbedViewInternal>>(
    record: T,
    withTypeTag: boolean,
  ): RecordEmbedView {
    return withTypeTag
      ? app.bsky.embed.record.view.$build({ record })
      : { record }
  }

  recordWithMediaEmbed(
    postUri: AtUriString,
    embed: RecordWithMedia,
    state: HydrationState,
    depth: number,
  ): $Typed<RecordWithMediaView> | undefined {
    const creator = creatorFromUri(postUri)
    let mediaEmbed:
      | $Typed<ImagesEmbedView>
      | $Typed<VideoEmbedView>
      | $Typed<GalleryEmbedView>
      | $Typed<ExternalEmbedView>
    if (isImagesEmbedType(embed.media)) {
      mediaEmbed = this.imagesEmbed(creator, embed.media)
    } else if (isVideoEmbedType(embed.media)) {
      mediaEmbed = this.videoEmbed(creator, embed.media)
    } else if (isGalleryEmbedType(embed.media)) {
      mediaEmbed = this.galleryEmbed(creator, embed.media)
    } else if (isExternalEmbedType(embed.media)) {
      mediaEmbed = this.externalEmbed(creator, embed.media, state)
    } else {
      return
    }
    return app.bsky.embed.recordWithMedia.view.$build({
      media: mediaEmbed,
      record: this.recordEmbed(postUri, embed.record, state, depth, false),
    })
  }

  userReplyDisabled(
    uri: AtUriString,
    state: HydrationState,
  ): boolean | undefined {
    const post = state.posts?.get(uri)
    if (post?.violatesThreadGate) {
      return true
    }
    const rootUriStr = post?.record.reply?.root.uri ?? uri
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
    uri: AtUriString,
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

  viewerPinned(uri: AtUriString, state: HydrationState, authorDid: string) {
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

    const author = this.profile(uri.did, state)
    if (!author) return

    let recordInfo:
      | Post
      | Like
      | Repost
      | Follow
      | RecordInfo<ProfileRecord>
      | Verification
      | Pick<RecordInfo<Required<NotificationRecordDeleted>>, 'cid' | 'record'>
      | undefined
      | null

    if (uri.collection === app.bsky.feed.post.$type) {
      recordInfo = state.posts?.get(notif.uri as AtUriString)
    } else if (uri.collection === app.bsky.feed.like.$type) {
      recordInfo = state.likes?.get(notif.uri as AtUriString)
    } else if (uri.collection === app.bsky.feed.repost.$type) {
      recordInfo = state.reposts?.get(notif.uri as AtUriString)
    } else if (uri.collection === app.bsky.graph.follow.$type) {
      recordInfo = state.follows?.get(notif.uri as AtUriString)
    } else if (uri.collection === app.bsky.graph.verification.$type) {
      // When a verification record is removed, the record won't be found,
      // both for the `verified` and `unverified` notifications.
      recordInfo = state.verifications?.get(notif.uri as AtUriString) ?? {
        record: notificationDeletedRecord,
        cid: notificationDeletedRecordCid,
      }
    } else if (uri.collection === app.bsky.actor.profile.$type) {
      const actor = state.actors?.get(author.did)
      recordInfo =
        actor && actor.profile && actor.profileCid
          ? ({
              record: actor.profile,
              cid: actor.profileCid,
              sortedAt: actor.sortedAt ?? new Date(0), // @NOTE will be present since profile record is present
              indexedAt: actor.indexedAt ?? new Date(0), // @NOTE will be present since profile record is present
              takedownRef: actor.profileTakedownRef,
            } satisfies RecordInfo<ProfileRecord>)
          : undefined
    }
    if (!recordInfo) return

    const labels = state.labels?.getBySubject(notif.uri as AtUriString) ?? []
    const selfLabels = this.selfLabels({
      uri: parseString<AtUriString>(notif.uri),
      cid: recordInfo.cid,
      record: recordInfo.record,
    })
    const indexedAt = notif.timestamp.toDate().toISOString()
    return {
      uri: notif.uri as AtUriString,
      cid: recordInfo.cid,
      author,
      reason: notif.reason,
      reasonSubject: parseString<AtUriString>(notif.reasonSubject),
      record: recordInfo.record,
      // @NOTE works with a hack in listNotifications so that when there's no last-seen time,
      // the user's first notification is marked unread, and all previous read. in this case,
      // the last seen time will be equal to the first notification's indexed time.
      isRead: lastSeenAt ? lastSeenAt > indexedAt : true,
      indexedAt: notif.timestamp.toDate().toISOString() as DatetimeString,
      labels: [...labels, ...selfLabels],
    }
  }

  indexedAt({ sortedAt, indexedAt }: { sortedAt: Date; indexedAt: Date }) {
    if (!this.indexedAtEpoch) return sortedAt
    return indexedAt && indexedAt > this.indexedAtEpoch ? indexedAt : sortedAt
  }
}

const getRootUri = (uri: AtUriString, post: Post): AtUriString => {
  return post.record.reply?.root.uri ?? uri
}

const externalEmbedSourceTheme = (
  theme: SiteStandardPublicationRecord['basicTheme'],
): ExternalEmbedSourceThemeView | undefined => {
  if (!theme) return undefined
  const view: ExternalEmbedSourceThemeView = {}
  const background = colorRGB(theme.background)
  const foreground = colorRGB(theme.foreground)
  const accent = colorRGB(theme.accent)
  const accentForeground = colorRGB(theme.accentForeground)
  if (background) view.backgroundRGB = background
  if (foreground) view.foregroundRGB = foreground
  if (accent) view.accentRGB = accent
  if (accentForeground) view.accentForegroundRGB = accentForeground
  // No fields set -> don't decorate the view at all.
  return Object.keys(view).length === 0 ? undefined : view
}

const colorRGB = (
  color: { $type?: unknown } | undefined,
): ExternalEmbedColorRgb | undefined => {
  if (!color || !site.standard.theme.color.rgb.isTypeOf(color)) return undefined
  // `isTypeOf` narrows $type but not the shape; pull rgb fields off the
  // unchecked input. Records that fail full validation are dropped above
  // by the SS record parser, so by the time we get here the shape matches.
  const { r, g, b } = color as unknown as { r: number; g: number; b: number }
  return app.bsky.embed.external.colorRGB.$build({ r, g, b })
}
