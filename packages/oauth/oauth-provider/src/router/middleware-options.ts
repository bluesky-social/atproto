import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ErrorHandler } from './error-handler.js'

export type MiddlewareOptions<
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
> = {
  onError?: ErrorHandler<Req, Res>
}
