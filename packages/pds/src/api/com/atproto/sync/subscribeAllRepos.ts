import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import Outbox from '../../../../sequencer/outbox'
import { RepoAppend } from '../../../../lexicon/types/com/atproto/sync/subscribeAllRepos'
import { InvalidRequestError } from '@atproto/xrpc-server'

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
      yield { time, repo, commit, prev, blocks, blobs } as RepoAppend
    }
  })
}
