import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { com } from '../../lexicons/index.js'
import { Outbox } from '../../sequencer/outbox.js'

export default function (server: Server, ctx: AppContext) {
  server.add(
    com.atproto.label.subscribeLabels,
    async function* ({ params, signal }) {
      const { cursor } = params
      const outbox = new Outbox(ctx.sequencer)

      if (cursor !== undefined) {
        const curr = await ctx.sequencer.curr()
        if (cursor > (curr ?? 0)) {
          throw new InvalidRequestError('Cursor in the future.', 'FutureCursor')
        }
      }

      for await (const evt of outbox.events(cursor, signal)) {
        yield {
          $type: 'com.atproto.label.subscribeLabels#labels' as const,
          ...evt,
        }
      }
    },
  )
}
