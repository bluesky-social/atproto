import AppContext from '../context'
import { DAY, NotEmptyArray } from '@atproto/common'
import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AlgoHandler, AlgoResponse } from './types'
import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'

const NO_WHATS_HOT_LABELS: NotEmptyArray<string> = [
  '!no-promote',
  'corpse',
  'self-harm',
  'porn',
  'sexual',
  'nudity',
  'underwear',
]

const handler: AlgoHandler = async (
  ctx: AppContext,
  params: SkeletonParams,
  requester: string,
): Promise<AlgoResponse> => {
  if (ctx.db.dialect === 'sqlite') {
    throw new Error('what-hot algo not available in sqlite')
  }

  const { limit = 50, cursor } = params
  const accountService = ctx.services.account(ctx.db)
  const feedService = ctx.services.appView.feed(ctx.db)
  const graphService = ctx.services.appView.graph(ctx.db)

  const { ref } = ctx.db.db.dynamic

  // From: https://medium.com/hacking-and-gonzo/how-hacker-news-ranking-algorithm-works-1d9b0cf2c08d
  // Score = (P-1) / (T+2)^G
  // where,
  // P = points of an item (and -1 is to negate submitters vote)
  // T = time since submission (in hours)
  // G = Gravity, defaults to 1.8 in news.arc

  const computeScore = sql<number>`${ref(
    'post_agg.likeCount',
  )} / ((EXTRACT(epoch FROM AGE(CURRENT_TIMESTAMP, ${ref(
    'post.indexedAt',
  )}::timestamp))/3600 + 2) ^ 1.8)`

  const dayAgo = new Date(Date.now() - DAY).toISOString()

  // first reduce the number of candidate posts to go through
  // and calculate score for each candidate post
  const candidates = ctx.db.db
    .selectFrom('post')
    .innerJoin('post_agg', 'post_agg.uri', 'post.uri')
    .leftJoin('post_embed_record', 'post_embed_record.postUri', 'post.uri')
    .where('post.replyParent', 'is', null)
    .where('post.indexedAt', '>', dayAgo)
    .whereNotExists((qb) =>
      qb
        .selectFrom('label')
        .selectAll()
        .where('val', 'in', NO_WHATS_HOT_LABELS)
        .where('neg', '=', 0)
        .where((clause) =>
          clause
            .whereRef('label.uri', '=', ref('post.creator'))
            .orWhereRef('label.uri', '=', ref('post.uri'))
            .orWhereRef('label.uri', '=', ref('post_embed_record.embedUri')),
        ),
    )
    .whereNotExists(accountService.mutedQb(requester, [ref('post.creator')]))
    .whereNotExists(graphService.blockQb(requester, [ref('post.creator')]))
    .select('post.uri')
    .select(computeScore.as('score'))

  let builder = feedService
    .selectPostQb()
    .innerJoin(candidates.as('candidate'), 'candidate.uri', 'post.uri')
    .orderBy('candidate.score', 'desc')
    .limit(limit)
    .select('candidate.score')

  if (cursor !== undefined) {
    const [cursorScore, cursorCid] = cursor.split('::')
    const cursorInt = parseInt(cursorScore)
    if (isNaN(cursorInt)) {
      throw new InvalidRequestError('Malformed cursor')
    }
    const maxScore = cursorInt / 1e10
    builder = builder
      .where('candidate.score', '<', maxScore)
      .where('post.cid', '!=', cursorCid)
  }

  const feedItems = await builder.execute()

  const lowItem = feedItems.at(-1)
  let returnCursor: string | undefined
  if (lowItem) {
    const score = Math.floor(lowItem.score * 1e10)
    returnCursor = score.toString() + '::' + lowItem.cid
  }

  return {
    feedItems,
    cursor: returnCursor?.toString(),
  }
}

export default handler
