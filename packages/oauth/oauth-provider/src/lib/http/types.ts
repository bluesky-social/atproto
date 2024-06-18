import type { IncomingMessage, ServerResponse } from 'node:http'
export { IncomingMessage, ServerResponse }

export type NextFunction = (err?: unknown) => void

export type Middleware<
  T = void,
  Req = IncomingMessage,
  Res = ServerResponse,
> = (
  this: T,
  req: Req,
  res: Res,
  next: NextFunction,
) => void | PromiseLike<void>

export type Handler<T = void, Req = IncomingMessage, Res = ServerResponse> = (
  this: T,
  req: Req,
  res: Res,
  next?: NextFunction,
) => void
