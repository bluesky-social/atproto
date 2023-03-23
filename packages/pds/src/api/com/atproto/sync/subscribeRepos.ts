import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import Outbox from '../../../../sequencer/outbox'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.subscribeRepos(async function* ({ params }) {
    const { cursor } = params
    const outbox = new Outbox(ctx.sequencer, {
      maxBufferSize: ctx.cfg.maxSubscriptionBuffer,
    })

    const backfillTime = new Date(
      Date.now() - ctx.cfg.repoBackfillLimitMs,
    ).toISOString()
    if (cursor !== undefined) {
      const [next, curr] = await Promise.all([
        ctx.sequencer.next(cursor),
        ctx.sequencer.curr(),
      ])
      if (next && next.sequencedAt < backfillTime) {
        yield {
          $type: '#info',
          name: 'OutdatedCursor',
          message: 'Requested cursor exceeded limit. Possibly missing events',
        }
      }
      if (curr && cursor > curr.seq) {
        throw new InvalidRequestError('Cursor in the future.', 'FutureCursor')
      }
    }

    for await (const evt of outbox.events(cursor, backfillTime)) {
      if (evt.type === 'commit') {
        // @TODO clean this up after lex-refactor lands
        const { rebase, tooBig, repo, blocks } = evt.evt
        const commit = evt.evt.commit.toString()
        const prev = evt.evt.prev?.toString() ?? null
        const ops = evt.evt.ops.map((op) => ({
          action: op.action,
          path: op.path,
          cid: op.cid?.toString() ?? null,
        }))
        const blobs = evt.evt.blobs.map((blob) => blob.toString())
        yield {
          $type: '#commit',
          seq: evt.seq,
          rebase,
          tooBig,
          repo,
          commit,
          prev,
          blocks,
          ops,
          blobs,
          time: evt.time,
        }
      } else if (evt.type === 'handle') {
        const { handle, did } = evt.evt
        yield {
          $type: '#handle',
          seq: evt.seq,
          handle,
          did,
          time: evt.time,
        }
      }
    }
  })
}
