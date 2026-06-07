import { Kysely } from 'kysely'
import * as actor from './tables/actor'
import * as follow from './tables/follow'
import * as like from './tables/like'
import * as post from './tables/post'
import * as subscriptionCursor from './tables/subscription-cursor'

export type DatabaseSchemaType = actor.PartialDB &
  post.PartialDB &
  follow.PartialDB &
  like.PartialDB &
  subscriptionCursor.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>
