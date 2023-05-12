import express from 'express'
import { AuthRequiredError, verifyJwt } from '@atproto/xrpc-server'
import { DidResolver } from '@atproto/did-resolver'

export const authVerifier =
  (serverDid: string, didResolver: DidResolver) =>
  async (reqCtx: { req: express.Request; res: express.Response }) => {
    const jwtStr = getJwtStrFromReq(reqCtx.req)
    if (!jwtStr) {
      throw new AuthRequiredError('missing jwt', 'MissingJwt')
    }
    const did = await verifyJwt(jwtStr, serverDid, async (did: string) => {
      const atprotoData = await didResolver.resolveAtprotoData(did)
      return atprotoData.signingKey
    })
    return { credentials: { did } }
  }

export const authOptionalVerifier =
  (serverDid: string, didResolver: DidResolver) =>
  async (reqCtx: { req: express.Request; res: express.Response }) => {
    if (!reqCtx.req.headers.authorization) {
      return { credentials: { did: null } }
    }
    return authVerifier(serverDid, didResolver)(reqCtx)
  }

export const getJwtStrFromReq = (req: express.Request): string | null => {
  const { authorization = '' } = req.headers
  if (!authorization.startsWith('Bearer ')) {
    return null
  }
  return authorization.replace('Bearer ', '').trim()
}
