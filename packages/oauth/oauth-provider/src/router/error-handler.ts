import type { IncomingMessage, ServerResponse } from 'node:http'

export type ErrorHandler<
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
> = (req: Req, res: Res, err: unknown, message: string) => void
