import type { IncomingMessage, ServerResponse } from 'node:http'
import { mediaType } from '@hapi/accept'
import { SubCtx, subCtx } from './context.js'
import { Middleware, NextFunction } from './types.js'

type View<
  T extends object | void,
  D,
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
> = (
  this: SubCtx<T, { data: D }>,
  req: Req,
  res: Res,
  next: NextFunction,
) => void | PromiseLike<void>

/**
 * @example
 * ```ts
 *  app.use(
 *    acceptMiddleware(
 *      async function (req, res) {
 *        return { hello: 'world' }
 *      },
 *      {
 *        '': 'application/json', // Fallback to JSON
 *        'text/plain': function (req, res) {
 *           res.writeHead(200).end(this.data.hello)
 *         },
 *        'application/json': function (req, res) {
 *          res.writeHead(200).end(JSON.stringify(this.data))
 *        }
 *      }
 *    )
 *  )
 * ```
 */
export function acceptMiddleware<
  D,
  T extends object | void = void,
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
>(
  controller: (this: T, req: Req, res: Res) => D | PromiseLike<D>,
  views: Record<string, string | View<T, D, Req, Res>>,
  fallback: Middleware<T> = (req, res, _next) => void res.writeHead(406).end(),
): (this: T, req: Req, res: Res, next: NextFunction) => Promise<void> {
  const viewsMap = new Map(Object.entries(views))
  const preferences = Array.from(viewsMap.keys()).filter(Boolean)

  // Make sure that every view is either a function or a string that points to a
  // function.
  for (const type of viewsMap.keys()) {
    const view = viewsMap.get(type)
    if (typeof view === 'string' && typeof viewsMap.get(view) !== 'function') {
      throw new Error(`Invalid view "${view}" for media type "${type}"`)
    }
  }

  return async function (req, res, next) {
    try {
      const type = req.headers['accept']
        ? mediaType(req.headers['accept'], preferences) || undefined
        : '' // indicate that the client accepts anything

      let view = type != null ? viewsMap.get(type) : undefined

      if (typeof view === 'string') view = viewsMap.get(view)
      if (typeof view === 'string') throw new Error('Invalid view') // should not happen

      if (view) {
        const data = await controller.call(this, req, res)
        const ctx = subCtx(this, { data })
        if (type) res.setHeader('Content-Type', type)

        await view.call(ctx, req, res, next)
      } else {
        // media negotiation failed
        await fallback.call(this, req, res, next)
      }
    } catch (err) {
      if (!res.headersSent) res.removeHeader('Content-Type')
      next(err)
    }
  }
}
