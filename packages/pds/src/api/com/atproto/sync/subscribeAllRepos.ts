import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import Outbox from '../../../../sequencer/outbox'
import { RepoAppend } from '../../../../lexicon/types/com/atproto/sync/subscribeAllRepos'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.subscribeAllRepos(async function* ({ params }) {
    const outbox = new Outbox(ctx.sequencer, {
      maxBufferSize: ctx.cfg.maxSubscriptionBuffer,
    })
    const backfillFrom = params.backfillFrom
    if (backfillFrom) {
      const now = Date.now()
      const backfillUnix = new Date(backfillFrom).getTime()
      if (isNaN(backfillUnix)) {
        throw new InvalidRequestError('Invalid "backfillFrom"')
      }
      if (now - backfillUnix > ctx.cfg.repoBackfillLimitMs) {
        throw new InvalidRequestError('Backfill request too long')
      }
    }
    for await (const evt of outbox.events(backfillFrom)) {
      const { time, repo, commit, prev, blocks, blobs } = evt
      const append: RepoAppend = Object.assign(
        { time, repo, commit, blocks, blobs },
        prev !== undefined ? { prev } : {}, // Undefineds not allowed by dag-cbor encoding
      )
      yield append
    }
  })
}
