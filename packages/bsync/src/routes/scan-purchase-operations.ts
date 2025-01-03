import { once } from 'node:events'
import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../proto/bsync_connect'
import AppContext from '../context'
import { authWithApiKey } from './auth'
import { combineSignals, validCursor } from './util'
import { createPurchaseOpChannel } from '../db/schema/purchase_op'
import { ScanPurchaseOperationsResponse } from '../proto/bsync_pb'

export default (ctx: AppContext): Partial<ServiceImpl<typeof Service>> => ({
  async scanPurchaseOperations(req, handlerCtx) {
    authWithApiKey(ctx, handlerCtx)
    const { db, events } = ctx
    const limit = req.limit || 1000
    const cursor = validCursor(req.cursor)
    const nextPurchaseOpPromise = once(events, createPurchaseOpChannel, {
      signal: combineSignals(
        ctx.shutdown,
        AbortSignal.timeout(ctx.cfg.service.longPollTimeoutMs),
      ),
    })
    nextPurchaseOpPromise.catch(() => null) // ensure timeout is always handled

    const nextPurchaseOpPageQb = db.db
      .selectFrom('purchase_op')
      .selectAll()
      .where('id', '>', cursor ?? -1)
      .orderBy('id', 'asc')
      .limit(limit)

    let ops = await nextPurchaseOpPageQb.execute()

    if (!ops.length) {
      // if there were no ops on the page, wait for an event then try again.
      try {
        await nextPurchaseOpPromise
      } catch (err) {
        ctx.shutdown.throwIfAborted()
        return new ScanPurchaseOperationsResponse({
          operations: [],
          cursor: req.cursor,
        })
      }
      ops = await nextPurchaseOpPageQb.execute()
      if (!ops.length) {
        return new ScanPurchaseOperationsResponse({
          operations: [],
          cursor: req.cursor,
        })
      }
    }

    const lastOp = ops[ops.length - 1]

    return new ScanPurchaseOperationsResponse({
      operations: ops.map((op) => ({
        id: op.id.toString(),
        actorDid: op.actorDid,
        entitlements: op.entitlements,
      })),
      cursor: lastOp.id.toString(),
    })
  },
})
