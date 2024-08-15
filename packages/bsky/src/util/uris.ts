import assert from 'node:assert'
import { AtUri } from '@atproto/syntax'
import { ids } from '../lexicon/lexicons'

export function postUriToThreadgateUri(postUri: string) {
  const urip = new AtUri(postUri)
  assert(urip.collection === ids.AppBskyFeedPost)
  urip.collection = ids.AppBskyFeedThreadgate
  return urip.toString()
}

export function postUriToPostgateUri(postUri: string) {
  const urip = new AtUri(postUri)
  assert(urip.collection === ids.AppBskyFeedPost)
  urip.collection = ids.AppBskyFeedPostgate
  return urip.toString()
}
