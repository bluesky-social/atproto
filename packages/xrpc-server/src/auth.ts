import * as common from '@atproto/common'
import { MINUTE } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import * as ui8 from 'uint8arrays'
import { AuthRequiredError } from './types'

type ServiceJwtPayload = {
  iss: string
  aud: string
  exp?: number
}

type ServiceJwtParams = ServiceJwtPayload & {
  keypair: crypto.Keypair
}

export const createServiceJwt = async (
  params: ServiceJwtParams,
): Promise<string> => {
  const { iss, aud, keypair } = params
  const exp = params.exp ?? Math.floor((Date.now() + MINUTE) / 1000)
  const header = {
    typ: 'JWT',
    alg: keypair.jwtAlg,
  }
  const payload = {
    iss,
    aud,
    exp,
  }
  const toSignStr = `${jsonToB64Url(header)}.${jsonToB64Url(payload)}`
  const toSign = ui8.fromString(toSignStr, 'utf8')
  const sig = await keypair.sign(toSign)
  return `${toSignStr}.${ui8.toString(sig, 'base64url')}`
}

export const createServiceAuthHeaders = async (params: ServiceJwtParams) => {
  const jwt = await createServiceJwt(params)
  return {
    headers: { authorization: `Bearer ${jwt}` },
  }
}

const jsonToB64Url = (json: Record<string, unknown>): string => {
  return common.utf8ToB64Url(JSON.stringify(json))
}

export const verifyJwt = async (
  jwtStr: string,
  ownDid: string | null, // null indicates to skip the audience check
  getSigningKey: (did: string, forceRefresh: boolean) => Promise<string>,
): Promise<ServiceJwtPayload> => {
  const parts = jwtStr.split('.')
  if (parts.length !== 3) {
    throw new AuthRequiredError('poorly formatted jwt', 'BadJwt')
  }
  const payload = parsePayload(parts[1])
  const sig = parts[2]

  if (Date.now() / 1000 > payload.exp) {
    throw new AuthRequiredError('jwt expired', 'JwtExpired')
  }
  if (ownDid !== null && payload.aud !== ownDid) {
    throw new AuthRequiredError(
      'jwt audience does not match service did',
      'BadJwtAudience',
    )
  }

  const msgBytes = ui8.fromString(parts.slice(0, 2).join('.'), 'utf8')
  const sigBytes = ui8.fromString(sig, 'base64url')
  const verifySignatureWithKey = (key: string) => {
    return crypto.verifySignature(key, msgBytes, sigBytes, {
      lowS: false,
    })
  }

  const signingKey = await getSigningKey(payload.iss, false)

  let validSig: boolean
  try {
    validSig = await verifySignatureWithKey(signingKey)
  } catch (err) {
    throw new AuthRequiredError(
      'could not verify jwt signature',
      'BadJwtSignature',
    )
  }

  if (!validSig) {
    // get fresh signing key in case it failed due to a recent rotation
    const freshSigningKey = await getSigningKey(payload.iss, true)
    try {
      validSig =
        freshSigningKey !== signingKey
          ? await verifySignatureWithKey(freshSigningKey)
          : false
    } catch (err) {
      throw new AuthRequiredError(
        'could not verify jwt signature',
        'BadJwtSignature',
      )
    }
  }

  if (!validSig) {
    throw new AuthRequiredError(
      'jwt signature does not match jwt issuer',
      'BadJwtSignature',
    )
  }

  return payload
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
  aud: string
  exp: number
}
