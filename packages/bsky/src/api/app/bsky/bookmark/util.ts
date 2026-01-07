import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { app } from '../../../../lexicons/index.js'

export const validateUri = (uri: string) => {
  const atUri = new AtUri(uri)
  if (atUri.collection !== app.bsky.feed.post.$type) {
    throw new InvalidRequestError(
      `Only '${app.bsky.feed.post.$type}' records can be bookmarked`,
      'UnsupportedCollection',
    )
  }
}
