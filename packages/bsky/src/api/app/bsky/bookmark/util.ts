import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../..'
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

export const getExistingKey = async (
  ctx: AppContext,
  actorDid: string,
  uri: string,
): Promise<string | null> => {
  const res = await ctx.dataplane.getBookmarksByActorAndUris({
    actorDid,
    uris: [uri],
  })
  const [existing] = res.bookmarks
  const key = existing.key
  return key || null
}
