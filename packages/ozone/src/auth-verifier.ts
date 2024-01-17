import { IdResolver } from '@atproto/identity'
import { AuthRequiredError, verifyJwt } from '@atproto/xrpc-server'
import express from 'express'

type ReqCtx = {
  req: express.Request
}

type AdminOutput = {
  credentials: {
    type: 'admin'
    aud: string
    iss: string
    isModerator: boolean
    isTriage: true
  }
}

type StandardOutput = {
  credentials: {
    type: 'standard'
    aud: string
    iss: string
    isModerator: boolean
    isTriage: boolean
  }
}

type NullOutput = {
  credentials: {
    type: 'null'
    iss: null
  }
}

export class AuthVerifier {
  idResolver: IdResolver
  serviceDid: string
  moderators: string[]
  triage: string[]

  admin = async (reqCtx: ReqCtx): Promise<AdminOutput> => {
    const creds = await this.standard(reqCtx)
    if (!creds.credentials.isTriage) {
      throw new AuthRequiredError('not a moderator account')
    }
    return {
      credentials: {
        ...creds.credentials,
        type: 'admin',
        isTriage: true,
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
    const payload = await verifyJwt(jwtStr, this.serviceDid, getSigningKey)
    const iss = payload.iss
    const isModerator = this.moderators.includes(iss)
    const isTriage = isModerator || this.triage.includes(iss)
    return {
      credentials: {
        type: 'standard',
        iss,
        aud: payload.aud,
        isModerator,
        isTriage,
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

  nullCreds(): NullOutput {
    return {
      credentials: {
        type: 'null',
        iss: null,
      },
    }
  }
}

const BEARER = 'Bearer '

const isBearerToken = (req: express.Request): boolean => {
  return req.headers.authorization?.startsWith(BEARER) ?? false
}

export const getJwtStrFromReq = (req: express.Request): string | null => {
  const { authorization } = req.headers
  if (!authorization?.startsWith(BEARER)) {
    return null
  }
  return authorization.slice(BEARER.length).trim()
}
