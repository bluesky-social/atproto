import {
  AuthRequiredError,
  verifyJwt as verifyServiceJwt,
} from '@atproto/xrpc-server'
import { IdResolver } from '@atproto/identity'
import * as ui8 from 'uint8arrays'
import express from 'express'

type ReqCtx = {
  req: express.Request
}

type NullOutput = {
  credentials: {
    type: 'null'
    iss: null
  }
}

type StandardOutput = {
  credentials: {
    type: 'standard'
    aud: string
    iss: string
    includeTakedowns: boolean
  }
}

type AdminServiceOutput = {
  credentials: {
    type: 'admin_service'
    aud: string
    iss: string
  }
}

type AdminTokenOutput = {
  credentials: {
    type: 'admin_token'
  }
}

export type AuthVerifierOpts = {
  ownDid: string
  modServiceDid: string
  adminPass: string
}

export class AuthVerifier {
  private _adminPass: string
  public ownDid: string
  public modServiceDid: string

  constructor(public idResolver: IdResolver, opts: AuthVerifierOpts) {
    this._adminPass = opts.adminPass
    this.ownDid = opts.ownDid
    this.modServiceDid = opts.modServiceDid
  }

  // verifiers (arrow fns to preserve scope)

  standard = async (ctx: ReqCtx): Promise<StandardOutput> => {
    const { iss, aud } = await this.verifyServiceJwt(ctx, {
      aud: this.ownDid,
      iss: null,
    })
    const includeTakedowns = iss === this.modServiceDid
    return { credentials: { type: 'standard', iss, aud, includeTakedowns } }
  }

  standardOptional = async (
    ctx: ReqCtx,
  ): Promise<StandardOutput | NullOutput> => {
    if (isBearerToken(ctx.req)) {
      return this.standard(ctx)
    }
    return this.nullCreds()
  }

  standardOptionalAnyAud = async (
    ctx: ReqCtx,
  ): Promise<StandardOutput | NullOutput> => {
    if (!isBearerToken(ctx.req)) {
      return this.nullCreds()
    }
    const { iss, aud } = await this.verifyServiceJwt(ctx, {
      aud: null,
      iss: null,
    })
    const includeTakedowns = iss === this.modServiceDid
    return { credentials: { type: 'standard', iss, aud, includeTakedowns } }
  }

  moderator = async (
    reqCtx: ReqCtx,
  ): Promise<AdminServiceOutput | AdminTokenOutput> => {
    if (isBearerToken(reqCtx.req)) {
      return this.modService(reqCtx)
    } else {
      return this.adminToken(reqCtx)
    }
  }

  modService = async (reqCtx: ReqCtx): Promise<AdminServiceOutput> => {
    const { iss, aud } = await this.verifyServiceJwt(reqCtx, {
      aud: this.ownDid,
      iss: [this.modServiceDid],
    })
    return { credentials: { type: 'admin_service', aud, iss } }
  }

  adminToken = (reqCtx: ReqCtx): AdminTokenOutput => {
    const parsed = parseBasicAuth(reqCtx.req.headers.authorization || '')
    if (
      !parsed ||
      parsed.username !== 'admin' ||
      parsed.password !== this._adminPass
    ) {
      throw new AuthRequiredError()
    }
    return { credentials: { type: 'admin_token' } }
  }

  async verifyServiceJwt(
    reqCtx: ReqCtx,
    opts: { aud: string | null; iss: string[] | null },
  ) {
    const getSigningKey = async (
      did: string,
      forceRefresh: boolean,
    ): Promise<string> => {
      if (opts.iss !== null && !opts.iss.includes(did)) {
        throw new AuthRequiredError('Untrusted issuer', 'UntrustedIss')
      }
      return this.idResolver.did.resolveAtprotoKey(did, forceRefresh)
    }

    const jwtStr = bearerTokenFromReq(reqCtx.req)
    if (!jwtStr) {
      throw new AuthRequiredError('missing jwt', 'MissingJwt')
    }
    const payload = await verifyServiceJwt(jwtStr, opts.aud, getSigningKey)
    return { iss: payload.iss, aud: payload.aud }
  }

  nullCreds(): NullOutput {
    return {
      credentials: {
        type: 'null',
        iss: null,
      },
    }
  }

  parseCreds(
    creds: StandardOutput | AdminServiceOutput | AdminTokenOutput | NullOutput,
  ) {
    const viewer =
      creds.credentials.type === 'standard' ? creds.credentials.iss : null
    const canViewTakedowns =
      (creds.credentials.type === 'standard' &&
        creds.credentials.includeTakedowns) ||
      creds.credentials.type === 'admin_token' ||
      creds.credentials.type === 'admin_service'
    const canPerformTakedown =
      creds.credentials.type === 'admin_service' ||
      creds.credentials.type === 'admin_token'
    return {
      viewer,
      canViewTakedowns,
      canPerformTakedown,
    }
  }
}

// HELPERS
// ---------

const BEARER = 'Bearer '
const BASIC = 'Basic '

const isBearerToken = (req: express.Request): boolean => {
  return req.headers.authorization?.startsWith(BEARER) ?? false
}

const bearerTokenFromReq = (req: express.Request) => {
  const header = req.headers.authorization || ''
  if (!header.startsWith(BEARER)) return null
  return header.slice(BEARER.length).trim()
}

export const parseBasicAuth = (
  token: string,
): { username: string; password: string } | null => {
  if (!token.startsWith(BASIC)) return null
  const b64 = token.slice(BASIC.length)
  let parsed: string[]
  try {
    parsed = ui8.toString(ui8.fromString(b64, 'base64pad'), 'utf8').split(':')
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
    ui8.toString(ui8.fromString(`${username}:${password}`, 'utf8'), 'base64pad')
  )
}
