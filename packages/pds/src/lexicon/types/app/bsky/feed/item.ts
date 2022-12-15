/**
 * GENERATED CODE - DO NOT MODIFY
 */
import * as AppBskyActorRef from '../actor/ref'
import * as AppBskyEmbedImages from '../embed/images'
import * as AppBskyEmbedExternal from '../embed/external'
import * as AppBskyFeedMyState from './myState'

export interface Main {
  uri: string
  cid: string
  author: AppBskyActorRef.WithInfo
  trendedBy?: AppBskyActorRef.WithInfo
  repostedBy?: AppBskyActorRef.WithInfo
  record: {}
  embed?:
    | AppBskyEmbedImages.Presented
    | AppBskyEmbedExternal.Presented
    | { $type: string; [k: string]: unknown }
  replyCount: number
  repostCount: number
  upvoteCount: number
  downvoteCount: number
  indexedAt: string
  myState?: AppBskyFeedMyState.Main
  [k: string]: unknown
}
