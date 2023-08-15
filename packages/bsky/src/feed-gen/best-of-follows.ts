import { InvalidRequestError } from '@atproto/xrpc-server'
import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AlgoHandler, AlgoResponse } from './types'
import { GenericKeyset, paginate } from '../db/pagination'
import AppContext from '../context'

const handler: AlgoHandler = async (
  ctx: AppContext,
  params: SkeletonParams,
  viewer: string,
): Promise<AlgoResponse> => {
  const { limit, cursor } = params
  const db = ctx.db.getReplica('feed')
  const feedService = ctx.services.feed(db)
  const graphService = ctx.services.graph(db)

  const { ref } = db.db.dynamic

  // candidates are ranked within a materialized view by like count, depreciated over time.

  let builder = feedService
    .selectPostQb()
    .innerJoin('algo_whats_hot_view as candidate', 'candidate.uri', 'post.uri')
    .where((qb) =>
      qb
        .where('post.creator', '=', viewer)
        .orWhereExists((inner) =>
          inner
            .selectFrom('follow')
            .where('follow.creator', '=', viewer)
            .whereRef('follow.subjectDid', '=', 'post.creator'),
        ),
    )
    .where((qb) =>
      graphService.whereNotMuted(qb, viewer, [ref('post.creator')]),
    )
    .whereNotExists(graphService.blockQb(viewer, [ref('post.creator')]))
    .select('candidate.score')
    .select('candidate.cid')

  const keyset = new ScoreKeyset(ref('candidate.score'), ref('candidate.cid'))
  builder = paginate(builder, { limit, cursor, keyset })

  const feedItems = await builder.execute()

  return {
    feedItems,
    cursor: keyset.packFromResult(feedItems),
  }
}

export default handler

type Result = { score: number; cid: string }
type LabeledResult = { primary: number; secondary: string }
export class ScoreKeyset extends GenericKeyset<Result, LabeledResult> {
  labelResult(result: Result) {
    return {
      primary: result.score,
      secondary: result.cid,
    }
  }
  labeledResultToCursor(labeled: LabeledResult) {
    return {
      primary: Math.round(labeled.primary).toString(),
      secondary: labeled.secondary,
    }
  }
  cursorToLabeledResult(cursor: { primary: string; secondary: string }) {
    const score = parseInt(cursor.primary, 10)
    if (isNaN(score)) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary: score,
      secondary: cursor.secondary,
    }
  }
}
