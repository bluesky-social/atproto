import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import Outbox from '../../../../sequencer/outbox'
import { httpLogger } from '../../../../logger'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.subscribeRepos(async function* ({ params, signal }) {
    const { cursor } = params
    const outbox = new Outbox(ctx.sequencer, {
      maxBufferSize: ctx.cfg.subscription.maxBuffer,
    })
    httpLogger.info({ cursor }, 'request to com.atproto.sync.subscribeRepos')

    const backfillTime = new Date(
      Date.now() - ctx.cfg.subscription.repoBackfillLimitMs,
    ).toISOString()
    let outboxCursor: number | undefined = undefined
    if (cursor !== undefined) {
      const [next, curr] = await Promise.all([
        ctx.sequencer.next(cursor),
        ctx.sequencer.curr(),
      ])
      if (cursor > (curr?.seq ?? 0)) {
        throw new InvalidRequestError('Cursor in the future.', 'FutureCursor')
      } else if (next && next.sequencedAt < backfillTime) {
        // if cursor is before backfill time, find earliest cursor from backfill window
        yield {
          $type: '#info',
          name: 'OutdatedCursor',
          message: 'Requested cursor exceeded limit. Possibly missing events',
        }
        const startEvt = await ctx.sequencer.earliestAfterTime(backfillTime)
        outboxCursor = startEvt?.seq ? startEvt.seq - 1 : undefined
      } else {
        outboxCursor = cursor
      }
    }

    for await (const evt of outbox.events(outboxCursor, signal)) {
      if (evt.type === 'commit') {
        yield {
          $type: '#commit',
          seq: evt.seq,
          time: evt.time,
          ...evt.evt,
        }
      } else if (evt.type === 'handle') {
        yield {
          $type: '#handle',
          seq: evt.seq,
          time: evt.time,
          ...evt.evt,
        }
      } else if (evt.type === 'tombstone') {
        yield {
          $type: '#tombstone',
          seq: evt.seq,
          time: evt.time,
          ...evt.evt,
        }
      }
    }
  })
}
