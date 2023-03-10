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
  // Below are pds holdovers
  didHandle.PartialDB & // Used to present handles
  repoRoot.PartialDB & // Used to check takedown
  record.PartialDB & // Used to check takedown
  ipldBlock.PartialDB // Used to get record contents

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema
