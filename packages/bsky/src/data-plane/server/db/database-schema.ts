import { Kysely } from 'kysely'
import * as duplicateRecord from './tables/duplicate-record'
import * as profile from './tables/profile'
import * as profileAgg from './tables/profile-agg'
import * as post from './tables/post'
import * as postEmbed from './tables/post-embed'
import * as postAgg from './tables/post-agg'
import * as repost from './tables/repost'
import * as threadgate from './tables/thread-gate'
import * as postgate from './tables/post-gate'
import * as feedItem from './tables/feed-item'
import * as follow from './tables/follow'
import * as like from './tables/like'
import * as list from './tables/list'
import * as listItem from './tables/list-item'
import * as listMute from './tables/list-mute'
import * as listBlock from './tables/list-block'
import * as mute from './tables/mute'
import * as actorBlock from './tables/actor-block'
import * as threadMute from './tables/thread-mute'
import * as feedGenerator from './tables/feed-generator'
import * as subscription from './tables/subscription'
import * as actor from './tables/actor'
import * as actorState from './tables/actor-state'
import * as actorSync from './tables/actor-sync'
import * as record from './tables/record'
import * as notification from './tables/notification'
import * as notificationPushToken from './tables/notification-push-token'
import * as didCache from './tables/did-cache'
import * as label from './tables/label'
import * as algo from './tables/algo'
import * as viewParam from './tables/view-param'
import * as suggestedFollow from './tables/suggested-follow'
import * as suggestedFeed from './tables/suggested-feed'
import * as taggedSuggestion from './tables/tagged-suggestion'
import * as blobTakedown from './tables/blob-takedown'
import * as labeler from './tables/labeler'
import * as starterPack from './tables/starter-pack'
import * as quote from './tables/quote'

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

export default DatabaseSchema
