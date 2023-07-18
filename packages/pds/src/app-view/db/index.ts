import * as duplicateRecords from './tables/duplicate-record'
import * as profile from './tables/profile'
import * as profileAgg from './tables/profile-agg'
import * as post from './tables/post'
import * as postAgg from './tables/post-agg'
import * as postEmbed from './tables/post-embed'
import * as repost from './tables/repost'
import * as feedItem from './tables/feed-item'
import * as follow from './tables/follow'
import * as list from './tables/list'
import * as listItem from './tables/list-item'
import * as actorBlock from './tables/actor-block'
import * as like from './tables/like'
import * as feedGenerator from './tables/feed-generator'
import * as subscription from './tables/subscription'
import * as algo from './tables/algo'
import * as viewParam from './tables/view-param'
import * as suggestedFollow from './tables/suggested-follow'

// @NOTE app-view also shares did-handle, record, and repo-root tables w/ main pds
export type DatabaseSchemaType = duplicateRecords.PartialDB &
  profile.PartialDB &
  profileAgg.PartialDB &
  post.PartialDB &
  postAgg.PartialDB &
  postEmbed.PartialDB &
  repost.PartialDB &
  feedItem.PartialDB &
  follow.PartialDB &
  list.PartialDB &
  listItem.PartialDB &
  actorBlock.PartialDB &
  like.PartialDB &
  feedGenerator.PartialDB &
  subscription.PartialDB &
  algo.PartialDB &
  viewParam.PartialDB &
  suggestedFollow.PartialDB
