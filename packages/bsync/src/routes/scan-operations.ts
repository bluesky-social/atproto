import { once } from 'node:events'
import { create } from '@bufbuild/protobuf'
import { ServiceImpl } from '@connectrpc/connect'
import { AppContext } from '../context.js'
import { createOperationChannel } from '../db/schema/operation.js'
import { ScanOperationsResponseSchema, Service } from '../proto/bsync_pb.js'
import { authWithApiKey } from './auth.js'
import { combineSignals, validCursor } from './util.js'

export default (ctx: AppContext): Partial<ServiceImpl<typeof Service>> => ({
  async scanOperations(req, handlerCtx) {
    authWithApiKey(ctx, handlerCtx)
    const { db, events } = ctx
    const limit = req.limit || 1000
    const cursor = validCursor(req.cursor)
    const nextOpPromise = once(events, createOperationChannel, {
      signal: combineSignals(
        ctx.shutdown,
        AbortSignal.timeout(ctx.cfg.service.longPollTimeoutMs),
      ),
    })
    nextOpPromise.catch(() => null) // ensure timeout is always handled

    const nextOpPageQb = db.db
      .selectFrom('operation')
      .selectAll()
      .where('id', '>', cursor ?? -1)
      .orderBy('id', 'asc')
      .limit(limit)

    let ops = await nextOpPageQb.execute()

    if (!ops.length) {
      // if there were no ops on the page, wait for an event then try again.
      try {
        await nextOpPromise
      } catch (err) {
        ctx.shutdown.throwIfAborted()
        return create(ScanOperationsResponseSchema, {
          operations: [],
          cursor: req.cursor,
        })
      }
      ops = await nextOpPageQb.execute()
      if (!ops.length) {
        return create(ScanOperationsResponseSchema, {
          operations: [],
          cursor: req.cursor,
        })
      }
    }

    const lastOp = ops[ops.length - 1]

    return create(ScanOperationsResponseSchema, {
      operations: ops.map((op) => ({
        id: op.id.toString(),
        actorDid: op.actorDid,
        namespace: op.namespace,
        key: op.key,
        method: op.method,
        payload: op.payload,
      })),
      cursor: lastOp.id.toString(),
    })
  },
})
