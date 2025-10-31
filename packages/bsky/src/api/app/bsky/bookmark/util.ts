import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { ids } from '../../../../lexicon/lexicons'

export const validateUri = (uri: string) => {
  const atUri = new AtUri(uri)
  if (atUri.collection !== ids.AppBskyFeedPost) {
    throw new InvalidRequestError(
      `Only '${ids.AppBskyFeedPost}' records can be bookmarked`,
      'UnsupportedCollection',
    )
  }
}
