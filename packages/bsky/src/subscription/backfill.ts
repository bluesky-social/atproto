import PQueue from 'p-queue'
import { AtpAgent } from '@atproto/api'
import { Subscription } from '@atproto/xrpc-server'
import { OutputSchema as Message } from '../lexicon/types/com/atproto/sync/subscribeRepos'
import { ids, lexicons } from '../lexicon/lexicons'
import AppContext from '../context'
import { subLogger } from '../logger'
import { retryHttp } from '../util/retry'

const METHOD = ids.ComAtprotoSyncSubscribeRepos

export const backfillRepos = async (ctx: AppContext, concurrency: number) => {
  if (!ctx.cfg.repoProvider) {
    throw new Error('No repo provider for backfill')
  }
  const res = await ctx.db.db
    .selectFrom('subscription')
    .where('service', '=', ctx.cfg.repoProvider)
    .where('method', '=', METHOD)
    .selectAll()
    .executeTakeFirst()
  const prevState = res ? JSON.parse(res.state) : undefined

  let cursor: number
  if (typeof prevState['peekedCursor'] === 'number') {
    cursor = prevState['peekedCursor']
  } else {
    // first, peek the stream to find the last event
    const peeked = await peekStream(ctx)
    if (peeked === null) {
      subLogger.info('already caught up, skipping backfill')
      console.log('SKIPPING backfill')
      return
    } else {
      cursor = peeked
    }
  }

  const backfillCursor =
    typeof prevState['backfillCursor'] === 'string'
      ? prevState['backfillCursor']
      : undefined

  // then run backfill
  await doBackfill(ctx, concurrency, cursor, backfillCursor)

  // finally update our subscription state to reflect the fact that we're caught up with the previously peeked cursor
  await setSubscriptionState(ctx, { cursor })
}

const setSubscriptionState = async (
  ctx: AppContext,
  subState: { cursor?: number; peekedCursor?: number; backfillCursor?: string },
) => {
  if (!ctx.cfg.repoProvider) {
    return
  }
  const state = JSON.stringify(subState)
  await ctx.db.db
    .insertInto('subscription')
    .values({
      service: ctx.cfg.repoProvider,
      method: METHOD,
      state,
    })
    .onConflict((oc) =>
      oc.columns(['service', 'method']).doUpdateSet({ state }),
    )
    .execute()
}

export const peekStream = async (ctx: AppContext): Promise<number | null> => {
  const repoProvider = ctx.cfg.repoProvider
  if (!repoProvider) {
    throw new Error('No repo provider for backfill')
  }

  const sub = new Subscription({
    service: repoProvider,
    method: METHOD,
    validate: (val) => {
      return lexicons.assertValidXrpcMessage<Message>(METHOD, val)
    },
    getParams: async () => {
      const lastSeenCursor = await ctx.db.db
        .selectFrom('subscription')
        .where('service', '=', repoProvider)
        .where('method', '=', METHOD)
        .selectAll()
        .executeTakeFirst()
      return lastSeenCursor ? JSON.parse(lastSeenCursor.state) : { cursor: 0 }
    },
  })
  const evts = sub[Symbol.asyncIterator]()
  const first = await evts.next()
  // first message should be an OutdatedCursor info msg
  if (first.done || first.value.name !== 'OutdatedCursor') {
    return null
  }
  // second message should be an event with a sequence number
  const second = await evts.next()
  if (second.done || typeof second.value.seq !== 'number') {
    throw new Error('Unexpected second event on stream', second.value)
  }
  return second.value.seq
}

export const doBackfill = async (
  ctx: AppContext,
  concurrency: number,
  peekedCursor: number,
  backfillCursor?: string,
) => {
  const repoProvider = ctx.cfg.repoProvider
  if (!concurrency || !repoProvider) {
    throw new Error('Repo subscription does not support backfill')
  }

  const { services, db } = ctx
  const agent = new AtpAgent({ service: wsToHttp(repoProvider) })
  const queue = new PQueue({ concurrency })
  const reposSeen = new Set()

  // Paginate through all repos and queue them for processing.
  // Fetch next page once all items on the queue are in progress.
  let cursor = backfillCursor
  let count = 0
  const start = Date.now()
  do {
    const { data: page } = await retryHttp(() =>
      agent.api.com.atproto.sync.listRepos({
        cursor,
        limit: Math.min(2 * concurrency, 1000),
      }),
    )
    page.repos.forEach((repo) => {
      if (reposSeen.has(repo.did)) {
        // If a host has a bug that appears to cause a loop or duplicate work, we can bail.
        throw new Error(
          `Backfill from ${repoProvider} failed because repo for ${repo.did} was seen twice`,
        )
      }
      reposSeen.add(repo.did)
      queue
        .add(async () => {
          const now = new Date().toISOString()
          const result = await Promise.allSettled([
            services.indexing(db).indexHandle(repo.did, now),
            services.indexing(db).indexRepo(repo.did, repo.head),
          ])
          for (const item of result) {
            if (item.status === 'rejected') {
              subLogger.error(
                { err: item.reason, provider: repoProvider, repo },
                'repo subscription backfill failed on a repository',
              )
            }
          }
          count++
          subLogger.info({ did: repo.did, count }, 'backfilled repo')
        })
        .catch((err) => {
          subLogger.error(
            { err, provider: repoProvider, repo },
            'repo subscription backfill failed on a repository',
          )
        })
    })
    cursor = page.cursor
    await queue.onEmpty() // Remaining items are in progress
    await setSubscriptionState(ctx, {
      peekedCursor,
      backfillCursor: cursor,
    })
  } while (cursor)

  // Wait until final batch finishes processing then update cursor.
  await queue.onIdle()

  subLogger.info({ duration: Date.now() - start }, 'backfill finished')
}

export async function backfillReposByDid(
  ctx: AppContext,
  opts: { concurrency: number; dids: string[] },
) {
  const { concurrency, dids } = opts
  const { services, db } = ctx
  const queue = new PQueue({ concurrency })
  const indexingService = services.indexing(db)
  let success = 0
  let failed = 0
  const total = dids.length
  for (const did of dids) {
    queue
      .add(async () => {
        const now = new Date().toISOString()
        const result = await Promise.allSettled([
          indexingService.indexHandle(did, now),
          indexingService.indexRepo(did),
        ])
        let err
        for (const item of result) {
          if (item.status === 'rejected') {
            err = item.reason
            console.warn('backfill failed on a repository', {
              err,
              did,
            })
          }
        }
        if (err) {
          failed++
          console.log(JSON.stringify({ succeeded: false, did })) // dids that need to be reprocessed
        } else {
          success++
          console.log(JSON.stringify({ succeeded: true, did })) // dids that do not need to be reprocessed
          console.warn('backfilled repo', { did, success, failed, total })
        }
      })
      .catch((err) => {
        // just to avoid a crash: the queue items should never throw
        console.error('unexpected error', { err, did })
      })
  }
  await queue.onIdle()
  console.warn('complete', { success, failed, total })
}

function wsToHttp(url: string) {
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    return url
  }
  return url.replace('ws', 'http')
}
