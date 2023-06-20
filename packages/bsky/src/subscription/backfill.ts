import PQueue from 'p-queue'
import { AtpAgent } from '@atproto/api'
import { Subscription } from '@atproto/xrpc-server'
import { OutputSchema as Message } from '../lexicon/types/com/atproto/sync/subscribeRepos'
import { ids, lexicons } from '../lexicon/lexicons'
import AppContext from '../context'
import { subLogger } from '../logger'
import { retryHttp } from '../util/retry'

const METHOD = ids.ComAtprotoSyncSubscribeRepos

export const doBackfill = async (ctx: AppContext) => {
  if (!ctx.cfg.repoProvider) {
    throw new Error('No repo provider for backfill')
  }
  // first, peek the stream to find the last event
  const cursor = await peekStream(ctx.cfg.repoProvider)
  const state = JSON.stringify({ cursor })

  // then run backfill
  await backfillRepos(ctx)

  // finally update our subscription state to reflect the fact that we're caught up with the previously peeked cursor
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

export const peekStream = async (
  repoProvider: string,
): Promise<number | null> => {
  const sub = new Subscription({
    service: repoProvider,
    method: METHOD,
    validate: (val) => {
      return lexicons.assertValidXrpcMessage<Message>(METHOD, val)
    },
  })
  let seq: number | undefined
  for await (const msg of sub) {
    if (msg.seq && typeof msg.seq === 'number') {
      seq = msg.seq
      break
    }
  }
  if (!seq) {
    throw new Error()
  }
  return seq
}

export const backfillRepos = async (ctx: AppContext) => {
  const concurrency = ctx.cfg.repoSubBackfillConcurrency
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
  let cursor: string | undefined
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
  } while (cursor)

  // Wait until final batch finishes processing then update cursor.
  await queue.onIdle()
  // await db.transaction(async (tx) => {
  //   await this.setState(tx, { cursor: seq - 1 })
  // })
}

function wsToHttp(url: string) {
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    return url
  }
  return url.replace('ws', 'http')
}
