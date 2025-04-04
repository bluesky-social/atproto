import { Kysely } from 'kysely'
import * as actor from './tables/actor'
import * as actorBlock from './tables/actor-block'
import * as actorState from './tables/actor-state'
import * as actorSync from './tables/actor-sync'
import * as algo from './tables/algo'
import * as blobTakedown from './tables/blob-takedown'
import * as didCache from './tables/did-cache'
import * as duplicateRecord from './tables/duplicate-record'
import * as feedGenerator from './tables/feed-generator'
import * as feedItem from './tables/feed-item'
import * as follow from './tables/follow'
import * as label from './tables/label'
import * as labeler from './tables/labeler'
import * as like from './tables/like'
import * as list from './tables/list'
import * as listBlock from './tables/list-block'
import * as listItem from './tables/list-item'
import * as listMute from './tables/list-mute'
import * as mute from './tables/mute'
import * as notification from './tables/notification'
import * as notificationPushToken from './tables/notification-push-token'
import * as post from './tables/post'
import * as postAgg from './tables/post-agg'
import * as postEmbed from './tables/post-embed'
import * as postgate from './tables/post-gate'
import * as profile from './tables/profile'
import * as profileAgg from './tables/profile-agg'
import * as quote from './tables/quote'
import * as record from './tables/record'
import * as repost from './tables/repost'
import * as starterPack from './tables/starter-pack'
import * as subscription from './tables/subscription'
import * as suggestedFeed from './tables/suggested-feed'
import * as suggestedFollow from './tables/suggested-follow'
import * as taggedSuggestion from './tables/tagged-suggestion'
import * as threadgate from './tables/thread-gate'
import * as threadMute from './tables/thread-mute'
import * as viewParam from './tables/view-param'

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
  quote.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>
