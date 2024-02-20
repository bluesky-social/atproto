import { once } from 'node:events'
import { Code, ConnectError, ServiceImpl } from '@connectrpc/connect'
import { Service } from '../proto/bsync_connect'
import { ScanMuteOperationsResponse } from '../proto/bsync_pb'
import AppContext from '../context'
import { createMuteOpChannel } from '../db/schema/mute_op'
import { authWithApiKey } from './auth'

export default (ctx: AppContext): Partial<ServiceImpl<typeof Service>> => ({
  async scanMuteOperations(req, handlerCtx) {
    authWithApiKey(ctx, handlerCtx)
    const { db, events } = ctx
    const limit = req.limit || 1000
    const cursor = validCursor(req.cursor)
    const nextMuteOpPromise = once(events, createMuteOpChannel, {
      signal: combineSignals(
        ctx.shutdown,
        AbortSignal.timeout(ctx.cfg.service.longPollTimeoutMs),
      ),
    })
    nextMuteOpPromise.catch(() => null) // ensure timeout is always handled

    const nextMuteOpPageQb = db.db
      .selectFrom('mute_op')
      .selectAll()
      .where('id', '>', cursor ?? -1)
      .orderBy('id', 'asc')
      .limit(limit)

    let ops = await nextMuteOpPageQb.execute()

    if (!ops.length) {
      // if there were no ops on the page, wait for an event then try again.
      try {
        await nextMuteOpPromise
      } catch (err) {
        ctx.shutdown.throwIfAborted()
        return new ScanMuteOperationsResponse({
          operations: [],
          cursor: req.cursor,
        })
      }
      ops = await nextMuteOpPageQb.execute()
      if (!ops.length) {
        return new ScanMuteOperationsResponse({
          operations: [],
          cursor: req.cursor,
        })
      }
    }

    const lastOp = ops[ops.length - 1]

    return new ScanMuteOperationsResponse({
      operations: ops.map((op) => ({
        id: op.id.toString(),
        type: op.type,
        actorDid: op.actorDid,
        subject: op.subject,
      })),
      cursor: lastOp.id.toString(),
    })
  },
})

const validCursor = (cursor: string): number | null => {
  if (cursor === '') return null
  const int = parseInt(cursor, 10)
  if (isNaN(int) || int < 0) {
    throw new ConnectError('invalid cursor', Code.InvalidArgument)
  }
  return int
}

const combineSignals = (a: AbortSignal, b: AbortSignal) => {
  const controller = new AbortController()
  for (const signal of [a, b]) {
    if (signal.aborted) {
      controller.abort()
      return signal
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      // @ts-ignore https://github.com/DefinitelyTyped/DefinitelyTyped/pull/68625
      signal: controller.signal,
    })
  }
  return controller.signal
}
