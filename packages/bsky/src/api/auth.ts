import express from 'express'
import * as uint8arrays from 'uint8arrays'
import { AuthRequiredError } from '@atproto/xrpc-server'

const BASIC = 'Basic '
const BEARER = 'Bearer '

// @TODO(bsky) treating did as a bearer, just a placeholder for now.
export const authVerifier = (ctx: {
  req: express.Request
  res: express.Response
}) => {
  const { authorization = '' } = ctx.req.headers
  if (!authorization.startsWith(BEARER)) {
    throw new AuthRequiredError()
  }
  const did = authorization.replace(BEARER, '').trim()
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

export const adminVerifier =
  (adminPassword: string) =>
  (ctx: { req: express.Request; res: express.Response }) => {
    const { authorization = '' } = ctx.req.headers
    const parsed = parseBasicAuth(authorization)
    if (!parsed) {
      throw new AuthRequiredError()
    }
    const { username, password } = parsed
    if (username !== 'admin' || password !== adminPassword) {
      throw new AuthRequiredError()
    }
    return { credentials: { admin: true } }
  }

export const parseBasicAuth = (
  token: string,
): { username: string; password: string } | null => {
  if (!token.startsWith(BASIC)) return null
  const b64 = token.slice(BASIC.length)
  let parsed: string[]
  try {
    parsed = uint8arrays
      .toString(uint8arrays.fromString(b64, 'base64pad'), 'utf8')
      .split(':')
  } catch (err) {
    return null
  }
  const [username, password] = parsed
  if (!username || !password) return null
  return { username, password }
}
