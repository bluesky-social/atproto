import { Kysely } from 'kysely'
import * as duplicateRecords from './tables/duplicate-record'
import * as assertion from './tables/assertion'
import * as profile from './tables/profile'
import * as post from './tables/post'
import * as postEmbed from './tables/post-embed'
import * as postEntity from './tables/post-entity'
import * as postHierarchy from './tables/post-hierarchy'
import * as repost from './tables/repost'
import * as follow from './tables/follow'
import * as vote from './tables/vote'
import * as subscription from './tables/subscription'
import * as didHandle from './tables/did-handle'
import * as repoRoot from './tables/repo-root'
import * as record from './tables/record'
import * as ipldBlock from './tables/ipld-block'
import * as mute from './tables/mute'

export type DatabaseSchemaType = duplicateRecords.PartialDB &
  assertion.PartialDB &
  profile.PartialDB &
  post.PartialDB &
  postEmbed.PartialDB &
  postEntity.PartialDB &
  postHierarchy.PartialDB &
  repost.PartialDB &
  follow.PartialDB &
  vote.PartialDB &
  subscription.PartialDB &
  didHandle.PartialDB & // Here and below are pds holdovers
  repoRoot.PartialDB &
  record.PartialDB &
  ipldBlock.PartialDB &
  mute.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema
