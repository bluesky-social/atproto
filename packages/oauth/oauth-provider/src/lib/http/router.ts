import type { IncomingMessage, ServerResponse } from 'node:http'
import { SubCtx, subCtx } from './context.js'
import { MethodMatcherInput } from './method.js'
import { asHandler, combineMiddlewares } from './middleware.js'
import { Params, Path } from './path.js'
import { RouteMiddleware, createRoute } from './route.js'
import { Middleware } from './types.js'

export type RouterCtx<T> = SubCtx<T, { url: Readonly<URL> }>
export type RouterMiddleware<
  T = void,
  Req = IncomingMessage,
  Res = ServerResponse,
> = Middleware<RouterCtx<T>, Req, Res>

export class Router<
  T = void,
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
> {
  private readonly middlewares: RouterMiddleware<T, Req, Res>[] = []

  constructor(
    private readonly url?: {
      /** Used to build the origin of the {@link RouterCtx['url']} context property */
      protocol?: string
      /** Used to build the origin of the {@link RouterCtx['url']} context property */
      host?: string
    },
  ) {}

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
  buildHandler() {
    const routerUrl = this.url

    // Calling next('router') from a middleware will skip all the remaining
    // middlewares in the stack.
    const middleware = combineMiddlewares(this.middlewares, {
      skipKeyword: 'router',
    })

    return asHandler<Middleware<T, Req, Res>>(function (this, req, res, next) {
      // Make sure that the context contains a "url". This will allow the add()
      // method to match routes based on the pathname and will allow routes to
      // access the query params (through this.url.searchParams).
      let url: URL

      if (
        !routerUrl &&
        this != null &&
        typeof this === 'object' &&
        'url' in this &&
        this.url instanceof URL
      ) {
        // If the context already contains a "url" (router inside router), let's
        // use it.
        url = this.url
      } else {
        // Parse the URL using node's URL parser.
        try {
          const protocol = routerUrl?.protocol || 'https:'
          const host = req.headers.host || routerUrl?.host || 'localhost'
          const pathname = req.url || '/'
          url = new URL(pathname, `${protocol}//${host}`)
        } catch (cause) {
          const error =
            cause instanceof Error ? cause : new Error('Invalid URL', { cause })
          return next(Object.assign(error, { status: 400, statusCode: 400 }))
        }
      }

      const context = subCtx(this, 'url', url)
      middleware.call(context, req, res, next)
    })
  }
}
