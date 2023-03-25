import { Kysely } from 'kysely'
import * as duplicateRecord from './tables/duplicate-record'
import * as profile from './tables/profile'
import * as post from './tables/post'
import * as postEmbed from './tables/post-embed'
import * as postEntity from './tables/post-entity'
import * as postHierarchy from './tables/post-hierarchy'
import * as repost from './tables/repost'
import * as follow from './tables/follow'
import * as vote from './tables/vote'
import * as subscription from './tables/subscription'
import * as actor from './tables/actor'
import * as record from './tables/record'

export type DatabaseSchemaType = duplicateRecord.PartialDB &
  profile.PartialDB &
  post.PartialDB &
  postEmbed.PartialDB &
  postEntity.PartialDB &
  postHierarchy.PartialDB &
  repost.PartialDB &
  follow.PartialDB &
  vote.PartialDB &
  subscription.PartialDB &
  actor.PartialDB &
  record.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema
