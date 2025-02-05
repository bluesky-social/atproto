import { Code, ConnectError, HandlerContext } from '@connectrpc/connect'
import { AppContext } from '../context'

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
