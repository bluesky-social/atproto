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

// @NOTE app-view also shares did-handle, record, repo-root, and vote tables w/ main pds
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
  subscription.PartialDB
