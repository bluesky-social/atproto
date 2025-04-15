import type { IncomingMessage, ServerResponse } from 'node:http'
import { SubCtx, subCtx } from './context.js'
import { MethodMatcherInput } from './method.js'
import { combineMiddlewares } from './middleware.js'
import { Params, Path } from './path.js'
import { RouteMiddleware, createRoute } from './route.js'
import { Middleware } from './types.js'

export type RouterCtx<T extends object | void = void> = SubCtx<
  T,
  { url: Readonly<URL> }
>

export type RouterMiddleware<
  T extends object | void = void,
  Req = IncomingMessage,
  Res = ServerResponse,
> = Middleware<RouterCtx<T>, Req, Res>

export type RouterConfig = {
  /** Used to build the origin of the {@link RouterCtx['url']} context property */
  protocol?: string
  /** Used to build the origin of the {@link RouterCtx['url']} context property */
  host?: string
}

export class Router<
  T extends object | void = void,
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
> {
  private readonly middlewares: RouterMiddleware<T, Req, Res>[] = []

  constructor(private readonly config?: RouterConfig) {}

  use(...middlewares: RouterMiddleware<T, Req, Res>[]) {
    this.middlewares.push(...middlewares)
    return this
  }

  all<P extends Params = Params>(
    path: Path<P>,
    ...mw: RouteMiddleware<RouterCtx<T>, P, Req, Res>[]
  ) {
    return this.addRoute<P>('*', path, ...mw)
  }

  get<P extends Params = Params>(
    path: Path<P>,
    ...mw: RouteMiddleware<RouterCtx<T>, P, Req, Res>[]
  ) {
    return this.addRoute<P>('GET', path, ...mw)
  }

  post<P extends Params = Params>(
    path: Path<P>,
    ...mw: RouteMiddleware<RouterCtx<T>, P, Req, Res>[]
  ) {
    return this.addRoute<P>('POST', path, ...mw)
  }

  options<P extends Params = Params>(
    path: Path<P>,
    ...mw: RouteMiddleware<RouterCtx<T>, P, Req, Res>[]
  ) {
    return this.addRoute<P>('OPTIONS', path, ...mw)
  }

  addRoute<P extends Params>(
    method: MethodMatcherInput,
    path: Path<P>,
    ...mw: RouteMiddleware<RouterCtx<T>, P, Req, Res>[]
  ) {
    return this.use(createRoute(method, path, ...mw))
  }

  /**
   * @returns router middleware which dispatches a route matching the request.
   */
  buildMiddleware(): Middleware<T, Req, Res> {
    const { config } = this

    // Calling next('router') from a middleware will skip all the remaining
    // middlewares in the stack.
    const middleware = combineMiddlewares(this.middlewares, {
      skipKeyword: 'router',
    })

    return function (this, req, res, next) {
      // Parse the URL using node's URL parser.
      const url = extractUrl(req, config)
      if (url instanceof Error) return next(url)

      // Any error thrown here will be uncaught/unhandled (a middleware should
      // never throw)
      const context = subCtx(this, { url })
      middleware.call(context, req, res, next)
    }
  }
}

function extractUrl(req: IncomingMessage, config?: RouterConfig): URL | Error {
  try {
    const protocol = config?.protocol || 'https:'
    const host = config?.host || req.headers.host || 'localhost'
    const pathname = req.url || '/'
    return new URL(pathname, `${protocol}//${host}`)
  } catch (cause) {
    const error =
      cause instanceof Error ? cause : new Error('Invalid URL', { cause })
    return Object.assign(error, { status: 400, statusCode: 400 })
  }
}
