import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { Outbox } from '../../sequencer/outbox'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.label.subscribeLabels(async function* ({
    params,
    signal,
  }) {
    const { cursor } = params
    const outbox = new Outbox(ctx.sequencer)

    if (cursor !== undefined) {
      const curr = await ctx.sequencer.curr()
      if (cursor > (curr ?? 0)) {
        throw new InvalidRequestError('Cursor in the future.', 'FutureCursor')
      }
    }

    for await (const evt of outbox.events(cursor, signal)) {
      yield { $type: '#labels', ...evt }
    }
  })
}
