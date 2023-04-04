import express from 'express'
import { AuthRequiredError } from '@atproto/xrpc-server'

// @TODO(bsky) treating did as a bearer, just a placeholder for now.
export const authVerifier = (ctx: {
  req: express.Request
  res: express.Response
}) => {
  const { authorization = '' } = ctx.req.headers
  if (!authorization.startsWith('Bearer ')) {
    throw new AuthRequiredError()
  }
  const did = authorization.replace('Bearer ', '').trim()
  if (!did.startsWith('did:')) {
    throw new AuthRequiredError()
  }
  return { credentials: { did } }
}

export const authOptionalVerifier = (ctx: {
  req: express.Request
  res: express.Response
}) => {
  if (!ctx.req.headers.authorization) {
    return { credentials: { did: null } }
  }
  return authVerifier(ctx)
}
