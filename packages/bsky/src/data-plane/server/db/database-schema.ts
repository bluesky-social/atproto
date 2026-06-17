import { Kysely } from 'kysely'
import * as activitySubscription from './tables/activity-subscription.js'
import * as actorBlock from './tables/actor-block.js'
import * as actorState from './tables/actor-state.js'
import * as actorSync from './tables/actor-sync.js'
import * as actor from './tables/actor.js'
import * as algo from './tables/algo.js'
import * as blobTakedown from './tables/blob-takedown.js'
import * as bookmark from './tables/bookmark.js'
import * as didCache from './tables/did-cache.js'
import * as draft from './tables/draft.js'
import * as duplicateRecord from './tables/duplicate-record.js'
import * as feedGenerator from './tables/feed-generator.js'
import * as feedItem from './tables/feed-item.js'
import * as follow from './tables/follow.js'
import * as label from './tables/label.js'
import * as labeler from './tables/labeler.js'
import * as like from './tables/like.js'
import * as listBlock from './tables/list-block.js'
import * as listItem from './tables/list-item.js'
import * as listMute from './tables/list-mute.js'
import * as list from './tables/list.js'
import * as mute from './tables/mute.js'
import * as notificationPushToken from './tables/notification-push-token.js'
import * as notification from './tables/notification.js'
import * as postAgg from './tables/post-agg.js'
import * as postEmbed from './tables/post-embed.js'
import * as postgate from './tables/post-gate.js'
import * as post from './tables/post.js'
import * as privateData from './tables/private-data.js'
import * as profileAgg from './tables/profile-agg.js'
import * as profile from './tables/profile.js'
import * as quote from './tables/quote.js'
import * as record from './tables/record.js'
import * as repost from './tables/repost.js'
import * as starterPack from './tables/starter-pack.js'
import * as subscription from './tables/subscription.js'
import * as suggestedFeed from './tables/suggested-feed.js'
import * as suggestedFollow from './tables/suggested-follow.js'
import * as taggedSuggestion from './tables/tagged-suggestion.js'
import * as threadgate from './tables/thread-gate.js'
import * as threadMute from './tables/thread-mute.js'
import * as verification from './tables/verification.js'
import * as viewParam from './tables/view-param.js'

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
