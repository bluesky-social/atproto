import { TimeCidKeyset } from '../../../../db/pagination'
import { Main as FeedViewPost } from '../../../../lexicon/types/app/bsky/feed/feedViewPost'
import { FeedRow, FeedService } from '../../../../services/feed'

// Present post and repost results into FeedViewPosts
// Including links to embedded media
export const composeFeed = async (
  feedService: FeedService,
  rows: FeedRow[],
  requester: string,
): Promise<FeedViewPost[]> => {
  const actorDids = new Set<string>()
  const postUris = new Set<string>()
  for (const row of rows) {
    actorDids.add(row.originatorDid)
    actorDids.add(row.authorDid)
    postUris.add(row.postUri)
    if (row.replyParent) postUris.add(row.replyParent)
    if (row.replyRoot) postUris.add(row.replyRoot)
  }
  const [actors, posts, embeds] = await Promise.all([
    feedService.getActorViews(Array.from(actorDids)),
    feedService.getPostViews(Array.from(postUris), requester),
    feedService.embedsForPosts(Array.from(postUris)),
  ])

  const feed: FeedViewPost[] = []
  for (const row of rows) {
    const post = feedService.formatPostView(row.postUri, actors, posts, embeds)
    const originator = actors[row.originatorDid]
    if (post && originator) {
      let reasonType: string | undefined
      if (row.type === 'trend') {
        reasonType = 'app.bsky.feed.feedViewPost#reasonTrend'
      } else if (row.type === 'repost') {
        reasonType = 'app.bsky.feed.feedViewPost#reasonRepost'
      }
      const replyParent = row.replyParent
        ? feedService.formatPostView(row.replyParent, actors, posts, embeds)
        : undefined
      const replyRoot = row.replyRoot
        ? feedService.formatPostView(row.replyRoot, actors, posts, embeds)
        : undefined

      feed.push({
        post,
        reason: reasonType
          ? {
              $type: reasonType,
              by: actors[row.originatorDid],
              indexedAt: 'blah', //@TODO fix
            }
          : undefined,
        reply:
          replyRoot && replyParent
            ? {
                root: replyRoot,
                parent: replyParent,
              }
            : undefined,
      })
    }
  }
  return feed
}

export enum FeedAlgorithm {
  ReverseChronological = 'reverse-chronological',
}

export class FeedKeyset extends TimeCidKeyset<FeedRow> {
  labelResult(result: FeedRow) {
    return { primary: result.cursor, secondary: result.postCid }
  }
}
