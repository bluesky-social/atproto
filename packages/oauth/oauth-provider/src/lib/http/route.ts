import { SubCtx, subCtx } from './context.js'
import { MethodMatcherInput, createMethodMatcher } from './method.js'
import { combineMiddlewares } from './middleware.js'
import { Params, Path, createPathMatcher } from './path.js'
import { IncomingMessage, Middleware, ServerResponse } from './types.js'

export type RouteCtx<T, P extends Params> = SubCtx<T, { params: Readonly<P> }>
export type RouteMiddleware<
  T,
  P extends Params,
  Req = IncomingMessage,
  Res = ServerResponse,
> = Middleware<RouteCtx<T, P>, Req, Res>

/**
 * @example
 * ```ts
 * createRoute<{ foo: string }>('GET', '/foo/:foo', function (req, res) {
 *   console.log(this.params.foo) // OK
 *   console.log(this.params.bar) // Error
 * })
 *
 * createRoute<{ foo: string }>(['POST', 'PUT'], '/foo/:foo', function (req, res) {
 *   console.log(this.params.foo) // OK
 *   console.log(this.params.bar) // Error
 * })
 * ```
 */
export function createRoute<
  P extends Params,
  T = void,
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
>(
  method: MethodMatcherInput,
  path: Path<P>,
  ...mw: RouteMiddleware<T, P, Req, Res>[]
): Middleware<T, Req, Res> {
  const paramsMatcher = createPathMatcher<P>(path)
  const methodMatcher = createMethodMatcher(method)

  const middleware = combineMiddlewares(mw, { skipKeyword: 'route' })

  return function (req, res, next) {
    if (methodMatcher(req)) {
      const pathname = req.url?.split('?')[0] ?? '/'
      const params = paramsMatcher(pathname)
      if (params) {
        const context = subCtx(this, 'params', params)
        return middleware.call(context, req, res, next)
      }
    }

    return next()
  }
}
