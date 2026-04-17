import { app, chat, com } from '../lexicons/index.js'

// app.bsky.actor

export type ProfileRecord = app.bsky.actor.profile.Main
export const isProfileRecordType = app.bsky.actor.profile.$isTypeOf

export type ProfileViewer = app.bsky.actor.defs.ViewerState
export type KnownFollowers = app.bsky.actor.defs.KnownFollowers
export type ProfileAssociatedActivitySubscription =
  app.bsky.actor.defs.ProfileAssociatedActivitySubscription
export type ProfileAssociatedChat = app.bsky.actor.defs.ProfileAssociatedChat
export type ProfileView = app.bsky.actor.defs.ProfileView
export type ProfileViewBasic = app.bsky.actor.defs.ProfileViewBasic
export type ProfileViewDetailed = app.bsky.actor.defs.ProfileViewDetailed
export type StatusView = app.bsky.actor.defs.StatusView
export type VerificationState = app.bsky.actor.defs.VerificationState
export type VerificationView = app.bsky.actor.defs.VerificationView

export type StatusRecord = app.bsky.actor.status.Main

// app.bsky.bookmark

export type BookmarkView = app.bsky.bookmark.defs.BookmarkView

// app.bsky.embed

export const isImagesEmbedType = app.bsky.embed.images.$isTypeOf
export type ImagesEmbed = app.bsky.embed.images.Main
export type ImagesEmbedView = app.bsky.embed.images.View

export const isVideoEmbedType = app.bsky.embed.video.$isTypeOf
export type VideoEmbed = app.bsky.embed.video.Main
export type VideoEmbedView = app.bsky.embed.video.View

export const isExternalEmbedType = app.bsky.embed.external.$isTypeOf
export type ExternalEmbed = app.bsky.embed.external.Main
export type ExternalEmbedView = app.bsky.embed.external.View

export const isRecordEmbedType = app.bsky.embed.record.$isTypeOf
export type RecordEmbed = app.bsky.embed.record.Main
export type RecordEmbedView = app.bsky.embed.record.View
export type EmbedBlocked = app.bsky.embed.record.ViewBlocked
export type EmbedDetached = app.bsky.embed.record.ViewDetached
export type EmbedNotFound = app.bsky.embed.record.ViewNotFound
export type PostEmbedView = app.bsky.embed.record.ViewRecord

export const isRecordWithMediaType = app.bsky.embed.recordWithMedia.$isTypeOf
export type RecordWithMedia = app.bsky.embed.recordWithMedia.Main
export type RecordWithMediaView = app.bsky.embed.recordWithMedia.View
export type RecordWithMediaEmbedView = app.bsky.embed.recordWithMedia.View

export type Embed =
  | ImagesEmbed
  | VideoEmbed
  | ExternalEmbed
  | RecordEmbed
  | RecordWithMedia

export type EmbedView =
  | ImagesEmbedView
  | VideoEmbedView
  | ExternalEmbedView
  | RecordEmbedView
  | RecordWithMediaView

export type MaybePostView = PostView | NotFoundPost | BlockedPost

export type RecordEmbedViewInternal =
  | PostEmbedView
  | GeneratorView
  | ListView
  | LabelerView
  | StarterPackViewBasic

// app.bsky.feed

export type LikeRecord = app.bsky.feed.like.Main
export type RepostRecord = app.bsky.feed.repost.Main

export type PostRecord = app.bsky.feed.post.Main
export const isPostRecordType = app.bsky.feed.post.$isTypeOf

export type PostgateRecord = app.bsky.feed.postgate.Main
export const isPostgateDisableRuleType =
  app.bsky.feed.postgate.disableRule.$isTypeOf

export type FeedViewPost = app.bsky.feed.defs.FeedViewPost
export type ReasonPin = app.bsky.feed.defs.ReasonPin
export type ReasonRepost = app.bsky.feed.defs.ReasonRepost
export type ReplyRef = app.bsky.feed.defs.ReplyRef
export type PostReplyRef = app.bsky.feed.post.ReplyRef
export type ThreadViewPost = app.bsky.feed.defs.ThreadViewPost
export type ThreadgateView = app.bsky.feed.defs.ThreadgateView
export type BlockedPost = app.bsky.feed.defs.BlockedPost
export type GeneratorView = app.bsky.feed.defs.GeneratorView
export type NotFoundPost = app.bsky.feed.defs.NotFoundPost
export type PostView = app.bsky.feed.defs.PostView
export const isPostViewType = app.bsky.feed.defs.postView.$isTypeOf

export type GateRecord = app.bsky.feed.threadgate.Main
export const isFollowerRuleType =
  app.bsky.feed.threadgate.followerRule.$isTypeOf
export const isFollowingRuleType =
  app.bsky.feed.threadgate.followingRule.$isTypeOf
export const isListRuleType = app.bsky.feed.threadgate.listRule.$isTypeOf
export const isMentionRuleType = app.bsky.feed.threadgate.mentionRule.$isTypeOf

export type FeedGenRecord = app.bsky.feed.generator.Main

// app.bsky.graph

export type BlockRecord = app.bsky.graph.block.Main
export type FollowRecord = app.bsky.graph.follow.Main
export type ListItemRecord = app.bsky.graph.listitem.Main
export type ListItemView = app.bsky.graph.defs.ListItemView
export type ListRecord = app.bsky.graph.list.Main
export type ListView = app.bsky.graph.defs.ListView
export type ListViewBasic = app.bsky.graph.defs.ListViewBasic
export type StarterPackRecord = app.bsky.graph.starterpack.Main
export type StarterPackView = app.bsky.graph.defs.StarterPackView
export type StarterPackViewBasic = app.bsky.graph.defs.StarterPackViewBasic
export type VerificationRecord = app.bsky.graph.verification.Main

// app.bsky.labeler

export type LabelerRecord = app.bsky.labeler.service.Main
export const isLabelerRecordType = app.bsky.labeler.service.$isTypeOf
export type LabelerView = app.bsky.labeler.defs.LabelerView
export type LabelerViewDetailed = app.bsky.labeler.defs.LabelerViewDetailed

// app.bsky.notification

export type NotificationDeclarationRecord =
  app.bsky.notification.declaration.Main
export type ActivitySubscription =
  app.bsky.notification.defs.ActivitySubscription
export type NotificationRecordDeleted = app.bsky.notification.defs.RecordDeleted
export type NotificationView =
  app.bsky.notification.listNotifications.Notification

// app.bsky.richtext

export const isMentionFacetType = app.bsky.richtext.facet.mention.$isTypeOf

// app.bsky.unspecced

export type ThreadItemBlocked = app.bsky.unspecced.defs.ThreadItemBlocked
export type ThreadItemNoUnauthenticated =
  app.bsky.unspecced.defs.ThreadItemNoUnauthenticated
export type ThreadItemNotFound = app.bsky.unspecced.defs.ThreadItemNotFound
export type ThreadItemPost = app.bsky.unspecced.defs.ThreadItemPost

export type ThreadOtherItem = app.bsky.unspecced.getPostThreadOtherV2.ThreadItem
export type GetPostThreadV2QueryParams =
  app.bsky.unspecced.getPostThreadV2.$Params
export type ThreadItem = app.bsky.unspecced.getPostThreadV2.ThreadItem

// chat.bsky.actor

export type ChatDeclarationRecord = chat.bsky.actor.declaration.Main

// com.atproto.label

export type Label = com.atproto.label.defs.Label
export const isSelfLabelsType = com.atproto.label.defs.selfLabels.$isTypeOf

// com.atproto.label

export type StrongRef = com.atproto.repo.strongRef.Main
export const validateStrongRef = com.atproto.repo.strongRef.$safeValidate

// com.germnetwork.declaration

export type GermDeclarationRecord = com.germnetwork.declaration.Main
