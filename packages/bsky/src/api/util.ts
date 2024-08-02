import { AtUri } from '@atproto/api'
import { FeedViewPost, isPostView } from '../lexicon/types/app/bsky/feed/defs'
import { ids } from '../lexicon/lexicons'
import { HydrationState } from '../hydration/hydrator'
import { ParsedLabelers, formatLabelerHeader } from '../util'

export const ATPROTO_CONTENT_LABELERS = 'Atproto-Content-Labelers'
export const ATPROTO_REPO_REV = 'Atproto-Repo-Rev'

type ResHeaderOpts = {
  labelers: ParsedLabelers
  repoRev: string | null
}

export const resHeaders = (
  opts: Partial<ResHeaderOpts>,
): Record<string, string> => {
  const headers = {}
  if (opts.labelers) {
    headers[ATPROTO_CONTENT_LABELERS] = formatLabelerHeader(opts.labelers)
  }
  if (opts.repoRev) {
    headers[ATPROTO_REPO_REV] = opts.repoRev
  }
  return headers
}

export const clearlyBadCursor = (cursor?: string) => {
  // hallmark of v1 cursor, highly unlikely in v2 cursors based on time or rkeys
  return !!cursor?.includes('::')
}

export function isFeedPostHiddenReply({
  post,
  hydration,
}: {
  post: FeedViewPost
  hydration: HydrationState
}) {
  if (post.reply && isPostView(post.reply.root)) {
    const urip = new AtUri(post.reply.root.uri)
    const threadgateUri = AtUri.make(
      urip.host,
      ids.AppBskyFeedThreadgate,
      urip.rkey,
    ).toString()
    const threadgate = hydration.threadgates?.get(threadgateUri)
    if (threadgate?.record?.hiddenReplies?.includes(post.post.uri)) {
      return true
    }
  }
  return false
}
