import { NotEmptyArray } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AlgoHandler, AlgoResponse } from './types'
import { GenericKeyset, paginate } from '../db/pagination'
import AppContext from '../context'
import { notSoftDeletedClause, valuesList } from '../db/util'
import { sql } from 'kysely'
import { FeedItemType } from '../app-view/services/feed'

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

  const { limit, cursor } = params
  const accountService = ctx.services.account(ctx.db)
  const graphService = ctx.services.appView.graph(ctx.db)

  const { ref } = ctx.db.db.dynamic

  // candidates are ranked within a materialized view by like count, depreciated over time.

  let builder = ctx.db.db
    .selectFrom('algo_whats_hot_view as candidate')
    .innerJoin('post', 'post.uri', 'candidate.uri')
    .innerJoin('repo_root as author_repo', 'author_repo.did', 'post.creator')
    .innerJoin('record', 'record.uri', 'post.uri')
    .leftJoin('post_embed_record', 'post_embed_record.postUri', 'candidate.uri')
    .where(notSoftDeletedClause(ref('author_repo')))
    .where(notSoftDeletedClause(ref('record')))
    .whereNotExists((qb) =>
      qb
        .selectFrom('label')
        .selectAll()
        .whereRef('val', 'in', valuesList(NO_WHATS_HOT_LABELS))
        .where('neg', '=', 0)
        .where((clause) =>
          clause
            .whereRef('label.uri', '=', ref('post.creator'))
            .orWhereRef('label.uri', '=', ref('post.uri'))
            .orWhereRef('label.uri', '=', ref('post_embed_record.embedUri')),
        ),
    )
    .where((qb) =>
      accountService.whereNotMuted(qb, requester, [ref('post.creator')]),
    )
    .whereNotExists(graphService.blockQb(requester, [ref('post.creator')]))
    .select([
      sql<FeedItemType>`${'post'}`.as('type'),
      'post.uri as uri',
      'post.cid as cid',
      'post.uri as postUri',
      'post.creator as originatorDid',
      'post.creator as postAuthorDid',
      'post.replyParent as replyParent',
      'post.replyRoot as replyRoot',
      'post.indexedAt as sortAt',
      'candidate.score',
      'candidate.cid',
    ])

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
