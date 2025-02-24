import { once } from 'node:events'
import { ServiceImpl } from '@connectrpc/connect'
import { AppContext } from '../context'
import { createNotifOpChannel } from '../db/schema/notif_op'
import { Service } from '../proto/bsync_connect'
import { ScanNotifOperationsResponse } from '../proto/bsync_pb'
import { authWithApiKey } from './auth'
import { combineSignals, validCursor } from './util'

export default (ctx: AppContext): Partial<ServiceImpl<typeof Service>> => ({
  async scanNotifOperations(req, handlerCtx) {
    authWithApiKey(ctx, handlerCtx)
    const { db, events } = ctx
    const limit = req.limit || 1000
    const cursor = validCursor(req.cursor)
    const nextNotifOpPromise = once(events, createNotifOpChannel, {
      signal: combineSignals(
        ctx.shutdown,
        AbortSignal.timeout(ctx.cfg.service.longPollTimeoutMs),
      ),
    })
    nextNotifOpPromise.catch(() => null) // ensure timeout is always handled

    const nextNotifOpPageQb = db.db
      .selectFrom('notif_op')
      .selectAll()
      .where('id', '>', cursor ?? -1)
      .orderBy('id', 'asc')
      .limit(limit)

    let ops = await nextNotifOpPageQb.execute()

    if (!ops.length) {
      // if there were no ops on the page, wait for an event then try again.
      try {
        await nextNotifOpPromise
      } catch (err) {
        ctx.shutdown.throwIfAborted()
        return new ScanNotifOperationsResponse({
          operations: [],
          cursor: req.cursor,
        })
      }
      ops = await nextNotifOpPageQb.execute()
      if (!ops.length) {
        return new ScanNotifOperationsResponse({
          operations: [],
          cursor: req.cursor,
        })
      }
    }

    const lastOp = ops[ops.length - 1]

    return new ScanNotifOperationsResponse({
      operations: ops.map((op) => ({
        id: op.id.toString(),
        actorDid: op.actorDid,
        priority: op.priority ?? undefined,
      })),
      cursor: lastOp.id.toString(),
    })
  },
})
