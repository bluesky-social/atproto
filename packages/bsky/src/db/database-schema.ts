import { Kysely } from 'kysely'
import * as duplicateRecord from './tables/duplicate-record'
import * as profile from './tables/profile'
import * as profileAgg from './tables/profile-agg'
import * as post from './tables/post'
import * as postEmbed from './tables/post-embed'
import * as postAgg from './tables/post-agg'
import * as repost from './tables/repost'
import * as feedItem from './tables/feed-item'
import * as follow from './tables/follow'
import * as like from './tables/like'
import * as list from './tables/list'
import * as listItem from './tables/list-item'
import * as listMute from './tables/list-mute'
import * as listBlock from './tables/list-block'
import * as mute from './tables/mute'
import * as actorBlock from './tables/actor-block'
import * as feedGenerator from './tables/feed-generator'
import * as subscription from './tables/subscription'
import * as actor from './tables/actor'
import * as actorState from './tables/actor-state'
import * as actorSync from './tables/actor-sync'
import * as record from './tables/record'
import * as notification from './tables/notification'
import * as notificationPushToken from './tables/notification-push-token'
import * as didCache from './tables/did-cache'
import * as moderation from './tables/moderation'
import * as label from './tables/label'
import * as algo from './tables/algo'
import * as viewParam from './tables/view-param'
import * as suggestedFollow from './tables/suggested-follow'
import * as suggestedFeed from './tables/suggested-feed'

export type DatabaseSchemaType = duplicateRecord.PartialDB &
  profile.PartialDB &
  profileAgg.PartialDB &
  post.PartialDB &
  postEmbed.PartialDB &
  postAgg.PartialDB &
  repost.PartialDB &
  feedItem.PartialDB &
  follow.PartialDB &
  like.PartialDB &
  list.PartialDB &
  listItem.PartialDB &
  listMute.PartialDB &
  listBlock.PartialDB &
  mute.PartialDB &
  actorBlock.PartialDB &
  feedGenerator.PartialDB &
  subscription.PartialDB &
  actor.PartialDB &
  actorState.PartialDB &
  actorSync.PartialDB &
  record.PartialDB &
  notification.PartialDB &
  notificationPushToken.PartialDB &
  didCache.PartialDB &
  moderation.PartialDB &
  label.PartialDB &
  algo.PartialDB &
  viewParam.PartialDB &
  suggestedFollow.PartialDB &
  suggestedFeed.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema
