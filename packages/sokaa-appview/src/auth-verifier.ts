import crypto, { KeyObject } from 'node:crypto'
import express from 'express'
import KeyEncoder from 'key-encoder'
import * as ui8 from 'uint8arrays'
import { SECP256K1_JWT_ALG, parseDidKey } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import {
  AuthRequiredError,
  VerifySignatureWithKeyFn,
  cryptoVerifySignatureWithKey,
  parseReqNsid,
  verifyJwt as verifyServiceJwt,
} from '@atproto/xrpc-server'

type ReqCtx = {
  req: express.Request
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

export enum RoleStatus {
  Valid,
  Invalid,
  Missing,
}

export type AuthVerifierOpts = {
  ownDid: string
  alternateAudienceDids: string[]
  adminPasswords: string[]
}

export class AuthVerifier {
  public ownDid: string
  public standardAudienceDids: Set<string>
  private adminPasswords: Set<string>

  constructor(
    public idResolver: IdResolver,
    opts: AuthVerifierOpts,
  ) {
    this.ownDid = opts.ownDid
    this.standardAudienceDids = new Set([
      opts.ownDid,
      ...opts.alternateAudienceDids,
    ])
    this.adminPasswords = new Set(opts.adminPasswords)
  }

  standard = async (ctx: ReqCtx): Promise<StandardOutput> => {
    const output = await this.optionalStandardOrRole(ctx)
    if (output.credentials.type === 'none') {
      throw new AuthRequiredError(undefined, 'AuthMissing')
    }
    if (output.credentials.type === 'role') {
      throw new AuthRequiredError(undefined, 'AuthMissing')
    }
    return output as StandardOutput
  }

  optionalStandardOrRole = async (
    ctx: ReqCtx,
  ): Promise<StandardOutput | RoleOutput | NullOutput> => {
    if (isBearerToken(ctx.req)) {
      return this.standardFromBearer(ctx)
    }
    const creds = this.parseRoleCreds(ctx.req)
    if (creds.status === RoleStatus.Valid) {
      return {
        credentials: {
          ...creds,
          type: 'role',
        },
      }
    }
    if (creds.status === RoleStatus.Missing) {
      return this.nullCreds()
    }
    throw new AuthRequiredError()
  }

  private standardFromBearer = async (ctx: ReqCtx): Promise<StandardOutput> => {
    const { iss, aud } = await this.verifyServiceJwt(ctx, {
      iss: null,
      aud: null,
    })
    if (!this.standardAudienceDids.has(aud)) {
      throw new AuthRequiredError(
        'jwt audience does not match service did',
        'BadJwtAudience',
      )
    }
    return {
      credentials: {
        type: 'standard',
        iss,
        aud,
      },
    }
  }

  parseRoleCreds(req: express.Request) {
    const parsed = parseBasicAuth(req.headers.authorization || '')
    const { Missing, Valid, Invalid } = RoleStatus
    if (!parsed) {
      return { status: Missing, admin: false }
    }
    const { username, password } = parsed
    if (username === 'admin' && this.adminPasswords.has(password)) {
      return { status: Valid, admin: true }
    }
    return { status: Invalid, admin: false }
  }

  async verifyServiceJwt(
    reqCtx: ReqCtx,
    opts: {
      iss: string[] | null
      aud: string | null
    },
  ) {
    const getSigningKey = async (
      iss: string,
      forceRefresh: boolean,
    ): Promise<string> => {
      if (opts.iss !== null && !opts.iss.includes(iss)) {
        throw new AuthRequiredError('Untrusted issuer', 'UntrustedIss')
      }
      const [did] = iss.split('#')
      return this.idResolver.did.resolveAtprotoKey(did, forceRefresh)
    }

    const jwtStr = bearerTokenFromReq(reqCtx.req)
    if (!jwtStr) {
      throw new AuthRequiredError('missing jwt', 'MissingJwt')
    }

    const lxm = parseReqNsid(reqCtx.req)
    const payload = await verifyServiceJwt(
      jwtStr,
      opts.aud,
      lxm,
      getSigningKey,
      verifySignatureWithKey,
    )

    if (payload.lxm !== lxm) {
      throw new AuthRequiredError(
        payload.lxm !== undefined
          ? `bad jwt lexicon method ("lxm"). must match: ${lxm}`
          : `missing jwt lexicon method ("lxm"). must match: ${lxm}`,
        'BadJwtLexiconMethod',
      )
    }

    return { iss: payload.iss, aud: payload.aud }
  }

  nullCreds(): NullOutput {
    return {
      credentials: {
        type: 'none',
        iss: null,
      },
    }
  }

  parseCreds(creds: StandardOutput | RoleOutput | NullOutput) {
    const viewer =
      creds.credentials.type === 'standard' ? creds.credentials.iss : null
    const includeTakedowns =
      creds.credentials.type === 'role' && creds.credentials.admin
    return {
      viewer,
      includeTakedowns,
    }
  }
}

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
  } catch {
    return null
  }
  const [username, password] = parsed
  if (!username || !password) return null
  return { username, password }
}

const keyEncoder = new KeyEncoder('secp256k1')

const verifySig = (
  publicKey: Uint8Array,
  data: Uint8Array,
  sig: Uint8Array,
) => {
  const pemKey = keyEncoder.encodePublic(
    ui8.toString(publicKey, 'hex'),
    'raw',
    'pem',
  )
  const key = crypto.createPublicKey({ format: 'pem', key: pemKey })

  return crypto.verify(
    'sha256',
    data,
    {
      key,
      dsaEncoding: 'ieee-p1363',
    },
    sig,
  )
}

export const verifySignatureWithKey: VerifySignatureWithKeyFn = async (
  didKey: string,
  msgBytes: Uint8Array,
  sigBytes: Uint8Array,
  alg: string,
) => {
  if (alg === SECP256K1_JWT_ALG) {
    const parsed = parseDidKey(didKey)
    if (alg !== parsed.jwtAlg) {
      throw new Error(`Expected key alg ${alg}, got ${parsed.jwtAlg}`)
    }
    return verifySig(parsed.keyBytes, msgBytes, sigBytes)
  }

  return cryptoVerifySignatureWithKey(didKey, msgBytes, sigBytes, alg)
}

export type { KeyObject }
