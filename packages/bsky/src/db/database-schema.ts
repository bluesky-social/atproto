import { Kysely } from 'kysely'
import * as duplicateRecord from './tables/duplicate-record'
import * as profile from './tables/profile'
import * as profileAgg from './tables/profile-agg'
import * as post from './tables/post'
import * as postEmbed from './tables/post-embed'
import * as postHierarchy from './tables/post-hierarchy'
import * as postAgg from './tables/post-agg'
import * as repost from './tables/repost'
import * as feedItem from './tables/feed-item'
import * as follow from './tables/follow'
import * as like from './tables/like'
import * as feedGenerator from './tables/feed-generator'
import * as subscription from './tables/subscription'
import * as actor from './tables/actor'
import * as actorSync from './tables/actor-sync'
import * as record from './tables/record'
import * as notification from './tables/notification'
import * as didCache from './tables/did-cache'
import * as moderation from './tables/moderation'
import * as label from './tables/label'

export type DatabaseSchemaType = duplicateRecord.PartialDB &
  profile.PartialDB &
  profileAgg.PartialDB &
  post.PartialDB &
  postEmbed.PartialDB &
  postHierarchy.PartialDB &
  postAgg.PartialDB &
  repost.PartialDB &
  feedItem.PartialDB &
  follow.PartialDB &
  like.PartialDB &
  feedGenerator.PartialDB &
  subscription.PartialDB &
  actor.PartialDB &
  actorSync.PartialDB &
  record.PartialDB &
  notification.PartialDB &
  didCache.PartialDB &
  moderation.PartialDB &
  label.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema
