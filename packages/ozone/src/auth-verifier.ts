import express from 'express'
import * as ui8 from 'uint8arrays'
import { IdResolver } from '@atproto/identity'
import {
  AuthRequiredError,
  parseReqNsid,
  verifyJwt,
} from '@atproto/xrpc-server'
import { TeamService } from './team'

type ReqCtx = {
  req: express.Request
}

export type AdminTokenOutput = {
  credentials: {
    type: 'admin_token'
    isAdmin: true
    isModerator: true
    isTriage: true
    isVerifier: true
  }
}

export type ModeratorOutput = {
  credentials: {
    type: 'moderator'
    aud: string
    iss: string
    isAdmin: boolean
    isModerator: boolean
    isTriage: boolean
    isVerifier: boolean
  }
}

type StandardOutput = {
  credentials: {
    type: 'standard'
    aud: string
    iss: string
    isAdmin: boolean
    isModerator: boolean
    isTriage: boolean
    isVerifier: boolean
  }
}

type NullOutput = {
  credentials: {
    type: 'none'
    iss: null
  }
}

export type AuthVerifierOpts = {
  serviceDid: string
  adminPassword: string
  teamService: TeamService
}

export class AuthVerifier {
  serviceDid: string
  teamService: TeamService
  private adminPassword: string

  constructor(
    public idResolver: IdResolver,
    opts: AuthVerifierOpts,
  ) {
    this.serviceDid = opts.serviceDid
    this.adminPassword = opts.adminPassword
    this.teamService = opts.teamService
  }

  modOrAdminToken = async (
    reqCtx: ReqCtx,
  ): Promise<ModeratorOutput | AdminTokenOutput> => {
    if (isBasicToken(reqCtx.req)) {
      return this.adminToken(reqCtx)
    } else {
      return this.moderator(reqCtx)
    }
  }

  moderator = async (reqCtx: ReqCtx): Promise<ModeratorOutput> => {
    const creds = await this.standard(reqCtx)
    if (!creds.credentials.isTriage && !creds.credentials.isVerifier) {
      throw new AuthRequiredError('not a moderator account')
    }
    return {
      credentials: {
        ...creds.credentials,
        type: 'moderator',
      },
    }
  }

  standard = async (reqCtx: ReqCtx): Promise<StandardOutput> => {
    const getSigningKey = async (
      did: string,
      forceRefresh: boolean,
    ): Promise<string> => {
      const atprotoData = await this.idResolver.did.resolveAtprotoData(
        did,
        forceRefresh,
      )
      return atprotoData.signingKey
    }

    const jwtStr = getJwtStrFromReq(reqCtx.req)
    if (!jwtStr) {
      throw new AuthRequiredError('missing jwt', 'MissingJwt')
    }
    const nsid = parseReqNsid(reqCtx.req)
    const payload = await verifyJwt(
      jwtStr,
      this.serviceDid,
      nsid,
      getSigningKey,
    )
    const iss = payload.iss

    const member = await this.teamService.getMember(iss)

    if (member?.disabled) {
      throw new AuthRequiredError('member is disabled', 'MemberDisabled')
    }

    const { isAdmin, isModerator, isTriage, isVerifier } =
      this.teamService.getMemberRole(member)

    return {
      credentials: {
        type: 'standard',
        iss,
        aud: payload.aud,
        isAdmin,
        isModerator,
        isTriage,
        isVerifier,
      },
    }
  }

  standardOptional = async (
    reqCtx: ReqCtx,
  ): Promise<StandardOutput | NullOutput> => {
    if (isBearerToken(reqCtx.req)) {
      return this.standard(reqCtx)
    }
    return this.nullCreds()
  }

  standardOptionalOrAdminToken = async (
    reqCtx: ReqCtx,
  ): Promise<StandardOutput | AdminTokenOutput | NullOutput> => {
    if (isBearerToken(reqCtx.req)) {
      return this.standard(reqCtx)
    } else if (isBasicToken(reqCtx.req)) {
      return this.adminToken(reqCtx)
    } else {
      return this.nullCreds()
    }
  }

  adminToken = async (reqCtx: ReqCtx): Promise<AdminTokenOutput> => {
    const parsed = parseBasicAuth(reqCtx.req.headers.authorization ?? '')
    const { username, password } = parsed ?? {}
    if (username !== 'admin' || password !== this.adminPassword) {
      throw new AuthRequiredError()
    }
    return {
      credentials: {
        type: 'admin_token',
        isAdmin: true,
        isModerator: true,
        isTriage: true,
        isVerifier: true,
      },
    }
  }

  nullCreds(): NullOutput {
    return {
      credentials: {
        type: 'none',
        iss: null,
      },
    }
  }
}

const BEARER = 'Bearer '
const BASIC = 'Basic '

const isBearerToken = (req: express.Request): boolean => {
  return req.headers.authorization?.startsWith(BEARER) ?? false
}

const isBasicToken = (req: express.Request): boolean => {
  return req.headers.authorization?.startsWith(BASIC) ?? false
}

export const getJwtStrFromReq = (req: express.Request): string | null => {
  const { authorization } = req.headers
  if (!authorization?.startsWith(BEARER)) {
    return null
  }
  return authorization.slice(BEARER.length).trim()
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
