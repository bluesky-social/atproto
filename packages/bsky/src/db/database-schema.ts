import { Kysely } from 'kysely'
import * as duplicateRecord from './tables/duplicate-record'
import * as profile from './tables/profile'
import * as post from './tables/post'
import * as postEmbed from './tables/post-embed'
import * as postHierarchy from './tables/post-hierarchy'
import * as repost from './tables/repost'
import * as feedItem from './tables/feed-item'
import * as follow from './tables/follow'
import * as like from './tables/like'
import * as subscription from './tables/subscription'
import * as actor from './tables/actor'
import * as actorSync from './tables/actor-sync'
import * as record from './tables/record'
import * as notification from './tables/notification'
import * as moderation from './tables/moderation'
import * as label from './tables/label'

export type DatabaseSchemaType = duplicateRecord.PartialDB &
  profile.PartialDB &
  post.PartialDB &
  postEmbed.PartialDB &
  postHierarchy.PartialDB &
  repost.PartialDB &
  feedItem.PartialDB &
  follow.PartialDB &
  like.PartialDB &
  subscription.PartialDB &
  actor.PartialDB &
  actorSync.PartialDB &
  record.PartialDB &
  notification.PartialDB &
  moderation.PartialDB &
  label.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema
