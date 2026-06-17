import { once } from 'node:events'
import { ServiceImpl } from '@connectrpc/connect'
import { AppContext } from '../context.js'
import { createMuteOpChannel } from '../db/schema/mute_op.js'
import { Service } from '../proto/bsync_connect.js'
import { ScanMuteOperationsResponse } from '../proto/bsync_pb.js'
import { authWithApiKey } from './auth.js'
import { combineSignals, validCursor } from './util.js'

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
