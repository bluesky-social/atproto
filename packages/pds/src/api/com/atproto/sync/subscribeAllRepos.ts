import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import Outbox from '../../../../sequencer/outbox'
import { RepoAppend } from '../../../../lexicon/types/com/atproto/sync/subscribeAllRepos'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.subscribeAllRepos(async function* ({ params }) {
    const outbox = new Outbox(ctx.sequencer, {
      maxBufferSize: ctx.cfg.maxSubscriptionBuffer,
    })
    for await (const evt of outbox.events(params.backfillFrom)) {
      const { time, repo, commit, prev, blocks, blobs } = evt
      yield { time, repo, commit, prev, blocks, blobs } as RepoAppend
    }
  })
}
