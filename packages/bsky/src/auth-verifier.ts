import {
  AuthRequiredError,
  verifyJwt as verifyServiceJwt,
} from '@atproto/xrpc-server'
import * as ui8 from 'uint8arrays'
import express from 'express'
import {
  Code,
  DataPlaneClient,
  getKeyAsDidKey,
  isDataplaneError,
  unpackIdentityKeys,
} from './data-plane'
import { GetIdentityByDidResponse } from './proto/bsky_pb'

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
    type: 'none'
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
  }
}

type ModServiceOutput = {
  credentials: {
    type: 'mod_service'
    aud: string
    iss: string
  }
}

export type AuthVerifierOpts = {
  ownDid: string
  modServiceDid: string
  adminPasses: string[]
}

export class AuthVerifier {
  public ownDid: string
  public modServiceDid: string
  private adminPasses: Set<string>

  constructor(
    public dataplane: DataPlaneClient,
    opts: AuthVerifierOpts,
  ) {
    this.ownDid = opts.ownDid
    this.modServiceDid = opts.modServiceDid
    this.adminPasses = new Set(opts.adminPasses)
  }

  // verifiers (arrow fns to preserve scope)

  standard = async (ctx: ReqCtx): Promise<StandardOutput> => {
    // @TODO remove! basic auth + did supported just for testing.
    if (isBasicToken(ctx.req)) {
      const aud = this.ownDid
      const iss = ctx.req.headers['appview-as-did']
      if (typeof iss !== 'string' || !iss.startsWith('did:')) {
        throw new AuthRequiredError('bad issuer')
      }
      if (!this.parseRoleCreds(ctx.req).admin) {
        throw new AuthRequiredError('bad credentials')
      }
      return {
        credentials: { type: 'standard', iss, aud },
      }
    }
    const { iss, aud } = await this.verifyServiceJwt(ctx, {
      aud: this.ownDid,
      iss: null,
    })
    return {
      credentials: {
        type: 'standard',
        iss,
        aud,
      },
    }
  }

  standardOptional = async (
    ctx: ReqCtx,
  ): Promise<StandardOutput | NullOutput> => {
    if (isBearerToken(ctx.req) || isBasicToken(ctx.req)) {
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

  modService = async (reqCtx: ReqCtx): Promise<ModServiceOutput> => {
    const { iss, aud } = await this.verifyServiceJwt(reqCtx, {
      aud: this.ownDid,
      iss: [this.modServiceDid, `${this.modServiceDid}#atproto_labeler`],
    })
    return { credentials: { type: 'mod_service', aud, iss } }
  }

  roleOrModService = async (
    reqCtx: ReqCtx,
  ): Promise<RoleOutput | ModServiceOutput> => {
    if (isBearerToken(reqCtx.req)) {
      return this.modService(reqCtx)
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
    if (username === 'admin' && this.adminPasses.has(password)) {
      return { status: Valid, admin: true }
    }
    return { status: Invalid, admin: false }
  }

  async verifyServiceJwt(
    reqCtx: ReqCtx,
    opts: { aud: string | null; iss: string[] | null },
  ) {
    const getSigningKey = async (
      iss: string,
      _forceRefresh: boolean, // @TODO consider propagating to dataplane
    ): Promise<string> => {
      if (opts.iss !== null && !opts.iss.includes(iss)) {
        throw new AuthRequiredError('Untrusted issuer', 'UntrustedIss')
      }
      const [did, serviceId] = iss.split('#')
      const keyId =
        serviceId === 'atproto_labeler' ? 'atproto_label' : 'atproto'
      let identity: GetIdentityByDidResponse
      try {
        identity = await this.dataplane.getIdentityByDid({ did })
      } catch (err) {
        if (isDataplaneError(err, Code.NotFound)) {
          throw new AuthRequiredError('identity unknown')
        }
        throw err
      }
      const keys = unpackIdentityKeys(identity.keys)
      const didKey = getKeyAsDidKey(keys, { id: keyId })
      if (!didKey) {
        throw new AuthRequiredError('missing or bad key')
      }
      return didKey
    }

    const jwtStr = bearerTokenFromReq(reqCtx.req)
    if (!jwtStr) {
      throw new AuthRequiredError('missing jwt', 'MissingJwt')
    }
    const payload = await verifyServiceJwt(jwtStr, opts.aud, getSigningKey)
    return { iss: payload.iss, aud: payload.aud }
  }

  isModService(iss: string): boolean {
    return [
      this.modServiceDid,
      `${this.modServiceDid}#atproto_labeler`,
    ].includes(iss)
  }

  nullCreds(): NullOutput {
    return {
      credentials: {
        type: 'none',
        iss: null,
      },
    }
  }

  parseCreds(
    creds: StandardOutput | RoleOutput | ModServiceOutput | NullOutput,
  ) {
    const viewer =
      creds.credentials.type === 'standard' ? creds.credentials.iss : null
    const includeTakedowns =
      (creds.credentials.type === 'role' && creds.credentials.admin) ||
      creds.credentials.type === 'mod_service' ||
      (creds.credentials.type === 'standard' &&
        this.isModService(creds.credentials.iss))
    const canPerformTakedown =
      (creds.credentials.type === 'role' && creds.credentials.admin) ||
      creds.credentials.type === 'mod_service'

    return {
      viewer,
      includeTakedowns,
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

const isBasicToken = (req: express.Request): boolean => {
  return req.headers.authorization?.startsWith(BASIC) ?? false
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
