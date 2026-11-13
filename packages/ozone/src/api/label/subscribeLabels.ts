import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { com } from '../../lexicons/index.js'
import { labelStreamLogger as log } from '../../logger.js'
import { BackfillRateLimiter } from '../../sequencer/backfill-rate-limiter.js'
import { Outbox } from '../../sequencer/outbox.js'

export default function (server: Server, ctx: AppContext) {
  const backfillLimiter = new BackfillRateLimiter(
    ctx.cfg.service.labelStreamBackfillRate,
  )
  server.add(
    com.atproto.label.subscribeLabels,
    async function* ({
      req,
      params,
      signal,
    }): AsyncGenerator<com.atproto.label.subscribeLabels.$Message> {
      const { cursor } = params
      const outbox = new Outbox(ctx.sequencer, {
        backfillLimiter,
        onOverflow: () => req.socket.destroy(),
      })

      if (cursor !== undefined) {
        const curr = await ctx.sequencer.curr()
        if (cursor > (curr ?? 0)) {
          throw new InvalidRequestError('Cursor in the future.', 'FutureCursor')
        }
      }

      const forwardedFor = req.headers['x-forwarded-for']
      const connection = {
        connectionId: randomUUID(),
        cursor,
        remoteAddress: req.socket.remoteAddress,
        remotePort: req.socket.remotePort,
        userAgent: req.headers['user-agent']?.slice(0, 256),
        // @NOTE These headers aid attribution but are not authenticated identity.
        forwardedFor: (Array.isArray(forwardedFor)
          ? forwardedFor.join(',')
          : forwardedFor
        )?.slice(0, 512),
      }
      const startedAt = performance.now()
      let eventsSent = 0
      let lastSeq = cursor
      log.info(connection, 'label subscription started')
      try {
        for await (const evt of outbox.events(cursor, signal)) {
          eventsSent++
          lastSeq = evt.seq
          yield com.atproto.label.subscribeLabels.labels.$build(evt)
        }
      } finally {
        log.info(
          {
            ...connection,
            eventsSent,
            lastSeq,
            durationMs: Math.round(performance.now() - startedAt),
          },
          'label subscription closed',
        )
      }
    },
  )
}
