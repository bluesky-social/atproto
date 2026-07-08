import type { Kysely } from 'kysely'
import type * as activitySubscription from './tables/activity-subscription.js'
import type * as actorBlock from './tables/actor-block.js'
import type * as actorState from './tables/actor-state.js'
import type * as actorSync from './tables/actor-sync.js'
import type * as actor from './tables/actor.js'
import type * as algo from './tables/algo.js'
import type * as blobTakedown from './tables/blob-takedown.js'
import type * as bookmark from './tables/bookmark.js'
import type * as didCache from './tables/did-cache.js'
import type * as draft from './tables/draft.js'
import type * as duplicateRecord from './tables/duplicate-record.js'
import type * as feedGenerator from './tables/feed-generator.js'
import type * as feedItem from './tables/feed-item.js'
import type * as follow from './tables/follow.js'
import type * as label from './tables/label.js'
import type * as labeler from './tables/labeler.js'
import type * as like from './tables/like.js'
import type * as listBlock from './tables/list-block.js'
import type * as listItem from './tables/list-item.js'
import type * as listMute from './tables/list-mute.js'
import type * as list from './tables/list.js'
import type * as mute from './tables/mute.js'
import type * as notificationPushToken from './tables/notification-push-token.js'
import type * as notification from './tables/notification.js'
import type * as postAgg from './tables/post-agg.js'
import type * as postEmbed from './tables/post-embed.js'
import type * as postgate from './tables/post-gate.js'
import type * as post from './tables/post.js'
import type * as privateData from './tables/private-data.js'
import type * as profileAgg from './tables/profile-agg.js'
import type * as profile from './tables/profile.js'
import type * as quote from './tables/quote.js'
import type * as record from './tables/record.js'
import type * as repost from './tables/repost.js'
import type * as starterPack from './tables/starter-pack.js'
import type * as subscription from './tables/subscription.js'
import type * as suggestedFeed from './tables/suggested-feed.js'
import type * as suggestedFollow from './tables/suggested-follow.js'
import type * as taggedSuggestion from './tables/tagged-suggestion.js'
import type * as threadgate from './tables/thread-gate.js'
import type * as threadMute from './tables/thread-mute.js'
import type * as verification from './tables/verification.js'
import type * as viewParam from './tables/view-param.js'

export type DatabaseSchemaType = duplicateRecord.PartialDB &
  profile.PartialDB &
  profileAgg.PartialDB &
  post.PartialDB &
  postEmbed.PartialDB &
  postAgg.PartialDB &
  repost.PartialDB &
  threadgate.PartialDB &
  postgate.PartialDB &
  feedItem.PartialDB &
  follow.PartialDB &
  like.PartialDB &
  list.PartialDB &
  listItem.PartialDB &
  listMute.PartialDB &
  listBlock.PartialDB &
  mute.PartialDB &
  actorBlock.PartialDB &
  threadMute.PartialDB &
  feedGenerator.PartialDB &
  subscription.PartialDB &
  actor.PartialDB &
  actorState.PartialDB &
  actorSync.PartialDB &
  record.PartialDB &
  notification.PartialDB &
  notificationPushToken.PartialDB &
  didCache.PartialDB &
  label.PartialDB &
  algo.PartialDB &
  viewParam.PartialDB &
  suggestedFollow.PartialDB &
  suggestedFeed.PartialDB &
  blobTakedown.PartialDB &
  labeler.PartialDB &
  starterPack.PartialDB &
  taggedSuggestion.PartialDB &
  quote.PartialDB &
  verification.PartialDB &
  privateData.PartialDB &
  activitySubscription.PartialDB &
  bookmark.PartialDB &
  draft.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>
