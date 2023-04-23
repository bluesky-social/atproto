import * as duplicateRecords from './tables/duplicate-record'
import * as profile from './tables/profile'
import * as profileAgg from './tables/profile-agg'
import * as post from './tables/post'
import * as postAgg from './tables/post-agg'
import * as postEmbed from './tables/post-embed'
import * as postHierarchy from './tables/post-hierarchy'
import * as repost from './tables/repost'
import * as feedItem from './tables/feed-item'
import * as follow from './tables/follow'
import * as like from './tables/like'
import * as subscription from './tables/subscription'

// @NOTE app-view also shares did-handle, record, and repo-root tables w/ main pds
export type DatabaseSchemaType = duplicateRecords.PartialDB &
  profile.PartialDB &
  profileAgg.PartialDB &
  post.PartialDB &
  postAgg.PartialDB &
  postEmbed.PartialDB &
  postHierarchy.PartialDB &
  repost.PartialDB &
  feedItem.PartialDB &
  follow.PartialDB &
  like.PartialDB &
  subscription.PartialDB
