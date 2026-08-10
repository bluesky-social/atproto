import { Code, ConnectError, type HandlerContext } from '@connectrpc/connect'
import type { AppContext } from '../context.js'

const BEARER = 'Bearer '

export const authWithApiKey = (ctx: AppContext, handlerCtx: HandlerContext) => {
  const authorization = handlerCtx.requestHeader.get('authorization')
  if (!authorization?.startsWith(BEARER)) {
    throw new ConnectError('missing auth', Code.Unauthenticated)
  }
  const key = authorization.slice(BEARER.length)
  if (!ctx.cfg.auth.apiKeys.has(key)) {
    throw new ConnectError('invalid api key', Code.Unauthenticated)
  }
}
