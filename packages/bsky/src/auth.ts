import express from 'express'
import * as ui8 from 'uint8arrays'
import * as crypto from '@atproto/crypto'
import * as common from '@atproto/common'
import { AuthRequiredError } from '@atproto/xrpc-server'
import { DidResolver } from '@atproto/did-resolver'

export const authVerifier =
  (didResolver: DidResolver) =>
  async (reqCtx: { req: express.Request; res: express.Response }) => {
    const jwtStr = getJwtStrFromReq(reqCtx.req)
    if (!jwtStr) {
      throw new AuthRequiredError('missing jwt', 'MissingJwt')
    }
    const did = await verifyJwt(didResolver, jwtStr)
    return { credentials: { did } }
  }

export const authOptionalVerifier =
  (didResolver: DidResolver) =>
  async (reqCtx: { req: express.Request; res: express.Response }) => {
    if (!reqCtx.req.headers.authorization) {
      return { credentials: { did: null } }
    }
    return authVerifier(didResolver)(reqCtx)
  }

const verifyJwt = async (
  didResolver: DidResolver,
  jwtStr: string,
): Promise<string> => {
  const parts = jwtStr.split('.')
  if (parts.length !== 3) {
    throw new AuthRequiredError('poorly formatted jwt', 'BadJwt')
  }
  const payload = parsePayload(parts[1])
  const sig = parts[2]

  if (Date.now() / 1000 > payload.exp) {
    throw new AuthRequiredError('jwt expired', 'JwtExpired')
  }

  const msgBytes = ui8.fromString(parts.slice(0, 2).join('.'), 'utf8')
  const sigBytes = ui8.fromString(sig, 'base64url')

  const atpData = await didResolver.resolveAtprotoData(payload.iss)
  let validSig: boolean
  try {
    validSig = await crypto.verifySignature(
      atpData.signingKey,
      msgBytes,
      sigBytes,
    )
  } catch (err) {
    throw new AuthRequiredError(
      'could not verify jwt signature',
      'BadJwtSignature',
    )
  }
  if (!validSig) {
    throw new AuthRequiredError(
      'jwt signature does not match jwt issuer',
      'BadJwtSignature',
    )
  }

  return payload.iss
}

export const getJwtStrFromReq = (req: express.Request): string | null => {
  const { authorization = '' } = req.headers
  if (!authorization.startsWith('Bearer ')) {
    return null
  }
  return authorization.replace('Bearer ', '').trim()
}

const parseB64UrlToJson = (b64: string) => {
  return JSON.parse(common.b64UrlToUtf8(b64))
}

const parsePayload = (b64: string): JwtPayload => {
  const payload = parseB64UrlToJson(b64)
  if (!payload || typeof payload !== 'object') {
    throw new AuthRequiredError('poorly formatted jwt', 'BadJwt')
  } else if (typeof payload.exp !== 'number') {
    throw new AuthRequiredError('poorly formatted jwt', 'BadJwt')
  } else if (typeof payload.iss !== 'string') {
    throw new AuthRequiredError('poorly formatted jwt', 'BadJwt')
  }
  return payload
}

type JwtPayload = {
  iss: string
  exp: number
}
