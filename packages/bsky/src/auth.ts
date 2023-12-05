import express from 'express'
import * as uint8arrays from 'uint8arrays'
import { AuthRequiredError, verifyJwt } from '@atproto/xrpc-server'
import { IdResolver } from '@atproto/identity'
import { ServerConfig } from './config'

const BASIC = 'Basic '
const BEARER = 'Bearer '

export const authVerifier = (
  idResolver: IdResolver,
  opts: { aud: string | null },
) => {
  const getSigningKey = async (
    did: string,
    forceRefresh: boolean,
  ): Promise<string> => {
    const atprotoData = await idResolver.did.resolveAtprotoData(
      did,
      forceRefresh,
    )
    return atprotoData.signingKey
  }

  return async (reqCtx: { req: express.Request; res: express.Response }) => {
    const jwtStr = getJwtStrFromReq(reqCtx.req)
    if (!jwtStr) {
      throw new AuthRequiredError('missing jwt', 'MissingJwt')
    }
    const payload = await verifyJwt(jwtStr, opts.aud, getSigningKey)
    return { credentials: { did: payload.iss }, artifacts: { aud: opts.aud } }
  }
}

export const authOptionalVerifier = (
  idResolver: IdResolver,
  opts: { aud: string | null },
) => {
  const verifyAccess = authVerifier(idResolver, opts)
  return async (reqCtx: { req: express.Request; res: express.Response }) => {
    if (!reqCtx.req.headers.authorization) {
      return { credentials: { did: null } }
    }
    return verifyAccess(reqCtx)
  }
}

export const authOptionalAccessOrRoleVerifier = (
  idResolver: IdResolver,
  cfg: ServerConfig,
) => {
  const verifyAccess = authVerifier(idResolver, { aud: cfg.serverDid })
  const verifyRole = roleVerifier(cfg)
  return async (ctx: { req: express.Request; res: express.Response }) => {
    const defaultUnAuthorizedCredentials = {
      credentials: { did: null, type: 'unauthed' as const },
    }
    if (!ctx.req.headers.authorization) {
      return defaultUnAuthorizedCredentials
    }
    // For non-admin tokens, we don't want to consider alternative verifiers and let it fail if it fails
    const isRoleAuthToken = ctx.req.headers.authorization?.startsWith(BASIC)
    if (isRoleAuthToken) {
      const result = await verifyRole(ctx)
      return {
        ...result,
        credentials: {
          type: 'role' as const,
          ...result.credentials,
        },
      }
    }
    const result = await verifyAccess(ctx)
    return {
      ...result,
      credentials: {
        type: 'access' as const,
        ...result.credentials,
      },
    }
  }
}

export const roleVerifier =
  (cfg: ServerConfig) =>
  async (reqCtx: { req: express.Request; res: express.Response }) => {
    const credentials = getRoleCredentials(cfg, reqCtx.req)
    if (!credentials.valid) {
      throw new AuthRequiredError()
    }
    return { credentials }
  }

export const getRoleCredentials = (cfg: ServerConfig, req: express.Request) => {
  const parsed = parseBasicAuth(req.headers.authorization || '')
  const { username, password } = parsed ?? {}
  if (username === 'admin' && password === cfg.triagePassword) {
    return { valid: true, admin: false, moderator: false, triage: true }
  }
  if (username === 'admin' && password === cfg.moderatorPassword) {
    return { valid: true, admin: false, moderator: true, triage: true }
  }
  if (username === 'admin' && password === cfg.adminPassword) {
    return { valid: true, admin: true, moderator: true, triage: true }
  }
  return { valid: false, admin: false, moderator: false, triage: false }
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

export const buildBasicAuth = (username: string, password: string): string => {
  return (
    BASIC +
    uint8arrays.toString(
      uint8arrays.fromString(`${username}:${password}`, 'utf8'),
      'base64pad',
    )
  )
}

export const getJwtStrFromReq = (req: express.Request): string | null => {
  const { authorization } = req.headers
  if (!authorization?.startsWith(BEARER)) {
    return null
  }
  return authorization.slice(BEARER.length).trim()
}
