import type { IncomingMessage, ServerResponse } from 'node:http'

export type ErrorHandler<
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
> = (req: Req, res: Res, err: unknown, message: string) => void

export type RouterOptions<
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
> = {
  onError?: ErrorHandler<Req, Res>
}
