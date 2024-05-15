import { type RequestHandler } from 'express'
import AppContext from './context'

export const createRouter = (ctx: AppContext): RequestHandler => {
  if (ctx.authProvider) {
    return ctx.authProvider.createRouter()
  } else {
    // No authProvider means we are in "entryway" mode. APTROTO 's OAuth spec
    // requires to redirect to the OAuth Authorization Server when requesting
    // Authorization Server Metadata.
    const oauthAuthorizationServer = new URL(
      '/.well-known/oauth-authorization-server',
      ctx.cfg.entryway!.url, // Throws if entryway is not defined
    )
    return (req, res, next) => {
      if (req.url === oauthAuthorizationServer.pathname) {
        res.statusCode = 303
        res.setHeader('Location', oauthAuthorizationServer.href)
        res.end()
      } else {
        next()
      }
    }
  }
}
