import express from 'express'
import * as ui8 from 'uint8arrays'
import * as crypto from '@atproto/crypto'
import { AuthRequiredError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'

export const authVerifier = (ctx: {
  req: express.Request
  res: express.Response
}) => {
  const { authorization = '' } = ctx.req.headers
  if (!authorization.startsWith('Bearer ')) {
    throw new AuthRequiredError()
  }
  const jwtStr = authorization.replace('Bearer ', '').trim()
  if (!did.startsWith('did:')) {
    throw new AuthRequiredError()
  }
  return { credentials: { did } }
}

const parseJwt = async (
  ctx: AppContext,
  jwtStr: string,
): { header: JwtHeader; payload: JwtPayload; sig: string } => {
  const parts = jwtStr.split('.')
  if (parts.length !== 3) {
    throw new AuthRequiredError()
  }
  const header = parseB64UrlToJson(parts[0]) as JwtHeader
  const payload = parseB64UrlToJson(parts[1]) as JwtPayload
  const sig = parts[2]

  const msgBytes = ui8.fromString(parts.slice(0, 2).join('.'), 'utf8')
  const sigBytes = ui8.fromString(sig, 'base64url')

  const atpData = await ctx.didResolver.resolveAtpData(payload.iss)
  const validSig = await crypto.verifySignature(
    atpData.signingKey,
    msgBytes,
    sigBytes,
  )
  if (!validSig) {
    throw new AuthRequiredError()
  }

  return {
    header,
    payload,
    sig,
  }
}

const parseB64UrlToJson = (b64: string) => {
  return JSON.parse(ui8.toString(ui8.fromString(b64, 'utf8')))
}

type JwtHeader = {
  typ: string
  alg: string
}

type JwtPayload = {
  iss: string
  aud: string
  exp: number
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
