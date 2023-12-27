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

export enum RoleStatus {
  Valid,
  Invalid,
  Missing,
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
  }
}

type RoleOutput = {
  credentials: {
    type: 'role'
    admin: boolean
    moderator: boolean
    triage: boolean
  }
}

type AdminServiceOutput = {
  credentials: {
    type: 'admin_service'
    aud: string
    iss: string
  }
}

export type AuthVerifierOpts = {
  ownDid: string
  adminDid: string
  adminPass: string
  moderatorPass: string
  triagePass: string
}

export class AuthVerifier {
  private _adminPass: string
  private _moderatorPass: string
  private _triagePass: string
  public ownDid: string
  public adminDid: string

  constructor(public idResolver: IdResolver, opts: AuthVerifierOpts) {
    this._adminPass = opts.adminPass
    this._moderatorPass = opts.moderatorPass
    this._triagePass = opts.triagePass
    this.ownDid = opts.ownDid
    this.adminDid = opts.adminDid
  }

  // verifiers (arrow fns to preserve scope)

  standard = async (ctx: ReqCtx): Promise<StandardOutput> => {
    const { iss, aud } = await this.verifyServiceJwt(ctx, {
      aud: this.ownDid,
      iss: null,
    })
    return { credentials: { type: 'standard', iss, aud } }
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
    return { credentials: { type: 'standard', iss, aud } }
  }

  role = (ctx: ReqCtx): RoleOutput => {
    const creds = this.parseRoleCreds(ctx.req)
    if (creds.status !== RoleStatus.Valid) {
      throw new AuthRequiredError()
    }
    return {
      credentials: {
        ...creds,
        type: 'role',
      },
    }
  }

  standardOrRole = async (
    ctx: ReqCtx,
  ): Promise<StandardOutput | RoleOutput> => {
    if (isBearerToken(ctx.req)) {
      return this.standard(ctx)
    } else {
      return this.role(ctx)
    }
  }

  optionalStandardOrRole = async (
    ctx: ReqCtx,
  ): Promise<StandardOutput | RoleOutput | NullOutput> => {
    if (isBearerToken(ctx.req)) {
      return await this.standard(ctx)
    } else {
      const creds = this.parseRoleCreds(ctx.req)
      if (creds.status === RoleStatus.Valid) {
        return {
          credentials: {
            ...creds,
            type: 'role',
          },
        }
      } else if (creds.status === RoleStatus.Missing) {
        return this.nullCreds()
      } else {
        throw new AuthRequiredError()
      }
    }
  }

  adminService = async (reqCtx: ReqCtx): Promise<AdminServiceOutput> => {
    const { iss, aud } = await this.verifyServiceJwt(reqCtx, {
      aud: this.ownDid,
      iss: [this.adminDid],
    })
    return { credentials: { type: 'admin_service', aud, iss } }
  }

  roleOrAdminService = async (
    reqCtx: ReqCtx,
  ): Promise<RoleOutput | AdminServiceOutput> => {
    if (isBearerToken(reqCtx.req)) {
      return this.adminService(reqCtx)
    } else {
      return this.role(reqCtx)
    }
  }

  parseRoleCreds(req: express.Request) {
    const parsed = parseBasicAuth(req.headers.authorization || '')
    const { Missing, Valid, Invalid } = RoleStatus
    if (!parsed) {
      return { status: Missing, admin: false, moderator: false, triage: false }
    }
    const { username, password } = parsed
    if (username === 'admin' && password === this._adminPass) {
      return { status: Valid, admin: true, moderator: true, triage: true }
    }
    if (username === 'admin' && password === this._moderatorPass) {
      return { status: Valid, admin: false, moderator: true, triage: true }
    }
    if (username === 'admin' && password === this._triagePass) {
      return { status: Valid, admin: false, moderator: false, triage: true }
    }
    return { status: Invalid, admin: false, moderator: false, triage: false }
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
    creds: StandardOutput | RoleOutput | AdminServiceOutput | NullOutput,
  ) {
    const viewer =
      creds.credentials.type === 'standard' ? creds.credentials.iss : null
    const canViewTakedowns =
      (creds.credentials.type === 'role' && creds.credentials.triage) ||
      creds.credentials.type === 'admin_service'
    const canPerformTakedown =
      (creds.credentials.type === 'role' && creds.credentials.moderator) ||
      creds.credentials.type === 'admin_service'
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
