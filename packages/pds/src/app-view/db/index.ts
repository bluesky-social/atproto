import * as duplicateRecords from './tables/duplicate-record'
import * as assertion from './tables/assertion'
import * as profile from './tables/profile'
import * as post from './tables/post'
import * as postHierarchy from './tables/post-hierarchy'
import * as postEntity from './tables/post-entity'
import * as postEmbedImage from './tables/post-embed-image'
import * as postEmbedExternal from './tables/post-embed-external'
import * as repost from './tables/repost'
import * as follow from './tables/follow'
import * as vote from './tables/vote'

// @NOTE app-view also shares did-handle, record, repo-root, and vote tables w/ main pds
export type DatabaseSchemaType = duplicateRecords.PartialDB &
  assertion.PartialDB &
  profile.PartialDB &
  post.PartialDB &
  postHierarchy.PartialDB &
  postEntity.PartialDB &
  postEmbedImage.PartialDB &
  postEmbedExternal.PartialDB &
  repost.PartialDB &
  follow.PartialDB &
  vote.PartialDB
