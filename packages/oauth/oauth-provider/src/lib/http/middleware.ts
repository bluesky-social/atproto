import type { IncomingMessage, ServerResponse } from 'node:http'
import { writeJson } from './response.js'
import { Middleware, Handler, NextFunction } from './types.js'

export function combineMiddlewares<M extends Middleware<any, any, any>>(
  middlewares: Iterable<null | undefined | M>,
  options?: { skipKeyword?: string },
): M

/**
 * Combine express/connect like middlewares (that can be async) into a single
 * middleware.
 */
export function combineMiddlewares(
  middlewares: Iterable<null | undefined | Middleware<unknown>>,
  { skipKeyword }: { skipKeyword?: string } = {},
): Middleware<unknown> {
  const middlewaresArray = Array.from(middlewares).filter(
    (x): x is NonNullable<typeof x> => x != null,
  )

  // Optimization: if there are no middlewares, return a noop middleware.
  if (middlewaresArray.length === 0) return (req, res, next) => void next()

  return function (req, res, next) {
    let i = 0
    const nextMiddleware = (err?: unknown) => {
      if (err) {
        if (skipKeyword && err === skipKeyword) next()
        else next(err)
      } else if (i >= middlewaresArray.length) {
        next()
      } else {
        const currentMiddleware = middlewaresArray[i++]!
        const currentNext = once(nextMiddleware)
        try {
          const result = currentMiddleware.call(this, req, res, currentNext)
          Promise.resolve(result).catch(currentNext)
        } catch (err) {
          currentNext(err)
        }
      }
    }
    nextMiddleware()
  }
}

export type AsHandler<M extends Middleware<any, any, any>> =
  M extends Middleware<infer T, infer Req, infer Res>
    ? Handler<T, Req, Res>
    : never

/**
 * Convert a middleware in a function that can be used as both a middleware and
 * and handler.
 */
export function asHandler<M extends Middleware<any, any, any>>(
  middleware: M,
  options?: FinalHandlerOptions,
) {
  return function (
    this,
    req,
    res,
    next = once(createFinalHandler(req, res, options)),
  ) {
    return middleware.call(this, req, res, next)
  } as AsHandler<M>
}

export type FinalHandlerOptions = {
  debug?: boolean
}

export function createFinalHandler(
  req: IncomingMessage,
  res: ServerResponse,
  options?: FinalHandlerOptions,
): NextFunction {
  return (err) => {
    if (err && (options?.debug ?? process.env['NODE_ENV'] === 'development')) {
      console.error(err)
    }

    if (res.headersSent) {
      // If an error occurred, and headers were sent, we can't know that the
      // whole response body was sent. So we can't safely reuse the socket.
      if (err) req.socket.destroy()

      return
    }

    const { status, ...payload } = buildFallbackPayload(req, err)

    res.setHeader('Content-Security-Policy', "default-src 'none'")
    res.setHeader('X-Content-Type-Options', 'nosniff')

    writeJson(res, payload, { status })
  }
}

function buildFallbackPayload(
  req: IncomingMessage,
  err: unknown,
): {
  status: number
  error: string
  error_description: string
  stack?: undefined | string
} {
  const status = err ? getErrorStatusCode(err) : 404
  const expose = getProp(err, 'expose', 'boolean') ?? status < 500

  return {
    status,
    error: err
      ? expose
        ? getProp(err, 'code', 'string') ??
          getProp(err, 'error', 'string') ??
          'unknown_error'
        : 'system_error'
      : 'not_found',
    error_description:
      err instanceof Error
        ? expose
          ? getProp(err, 'error_description', 'string') ||
            String(err.message) ||
            'Unknown error'
          : 'System error'
        : `Cannot ${req.method} ${req.url}`,
    stack:
      err instanceof Error && process.env['NODE_ENV'] === 'development'
        ? err.stack
        : undefined,
  }
}

function getErrorStatusCode(err: NonNullable<unknown>): number {
  const status =
    getProp(err, 'status', 'number') ?? getProp(err, 'statusCode', 'number')
  return status != null && status >= 400 && status < 600 ? status : 500
}

export function once<T extends NextFunction>(next: T): T {
  let nextNullable: T | null = next
  return function (err) {
    if (!nextNullable) throw new Error('next() called multiple times')
    const next = nextNullable
    nextNullable = null
    return next(err)
  } as T
}

// eslint-disable-next-line
function getProp(obj: unknown, key: string, t: 'function'): Function | undefined
function getProp(obj: unknown, key: string, t: 'string'): string | undefined
function getProp(obj: unknown, key: string, t: 'number'): number | undefined
function getProp(obj: unknown, key: string, t: 'boolean'): boolean | undefined
function getProp(obj: unknown, key: string, t: 'object'): object | undefined
function getProp(obj: unknown, key: string, t: 'symbol'): symbol | undefined
function getProp(obj: unknown, key: string, t: 'bigint'): bigint | undefined
function getProp(obj: unknown, key: string, t: 'undefined'): undefined
function getProp(
  obj: unknown,
  key: string,
  type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'object'
    | 'function'
    | 'symbol'
    | 'bigint'
    | 'undefined',
): unknown

function getProp(obj: unknown, key: string, type: string): unknown {
  if (obj != null && typeof obj === 'object' && key in obj) {
    const value = (obj as Record<string, unknown>)[key]
    if (typeof value === type) return value
  }
  return undefined
}
