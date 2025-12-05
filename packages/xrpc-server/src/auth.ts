import * as common from '@atproto/common'
import { MINUTE } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import { AuthRequiredError } from './errors'

type ServiceJwtParams = {
  iss: string
  aud: string
  iat?: number
  exp?: number
  lxm: string | null
  keypair: crypto.Keypair
}

type ServiceJwtHeaders = {
  alg: string
} & Record<string, unknown>

type ServiceJwtPayload = {
  iss: string
  aud: string
  exp: number
  lxm?: string
  jti?: string
}

export const createServiceJwt = async (
  params: ServiceJwtParams,
): Promise<string> => {
  const { iss, aud, keypair } = params
  const iat = params.iat ?? Math.floor(Date.now() / 1e3)
  const exp = params.exp ?? iat + MINUTE / 1e3
  const lxm = params.lxm ?? undefined
  const jti = await crypto.randomStr(16, 'hex')
  const header = {
    typ: 'JWT',
    alg: keypair.jwtAlg,
  }
  const payload = common.noUndefinedVals({
    iat,
    iss,
    aud,
    exp,
    lxm,
    jti,
  })
  const toSignStr = `${jsonToB64Url(header)}.${jsonToB64Url(payload)}`
  const toSign = Buffer.from(toSignStr, 'utf8')
  const sig = Buffer.from(await keypair.sign(toSign))
  return `${toSignStr}.${sig.toString('base64url')}`
}

export const createServiceAuthHeaders = async (params: ServiceJwtParams) => {
  const jwt = await createServiceJwt(params)
  return {
    headers: { authorization: `Bearer ${jwt}` },
  }
}

const jsonToB64Url = (json: Record<string, unknown>): string => {
  return Buffer.from(JSON.stringify(json)).toString('base64url')
}

export type VerifySignatureWithKeyFn = (
  key: string,
  msgBytes: Uint8Array,
  sigBytes: Uint8Array,
  alg: string,
) => Promise<boolean>

export const verifyJwt = async (
  jwtStr: string,
  ownDid: string | null, // null indicates to skip the audience check
  lxm: string | null, // null indicates to skip the lxm check
  getSigningKey: (iss: string, forceRefresh: boolean) => Promise<string>,
  verifySignatureWithKey: VerifySignatureWithKeyFn = cryptoVerifySignatureWithKey,
): Promise<ServiceJwtPayload> => {
  const parts = jwtStr.split('.')
  if (parts.length !== 3) {
    throw new AuthRequiredError('poorly formatted jwt', 'BadJwt')
  }

  const header = parseHeader(parts[0])

  // The spec does not describe what to do with the "typ" claim. We can,
  // however, forbid some values that are not compatible with our use case.
  if (
    // service tokens are not OAuth 2.0 access tokens
    // https://datatracker.ietf.org/doc/html/rfc9068
    header['typ'] === 'at+jwt' ||
    // "refresh+jwt" is a non-standard type used by the @atproto packages
    header['typ'] === 'refresh+jwt' ||
    // "DPoP" proofs are not meant to be used as service tokens
    // https://datatracker.ietf.org/doc/html/rfc9449
    header['typ'] === 'dpop+jwt'
  ) {
    throw new AuthRequiredError(
      `Invalid jwt type "${header['typ']}"`,
      'BadJwtType',
    )
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
  if (lxm !== null && payload.lxm !== lxm) {
    throw new AuthRequiredError(
      payload.lxm !== undefined
        ? `bad jwt lexicon method ("lxm"). must match: ${lxm}`
        : `missing jwt lexicon method ("lxm"). must match: ${lxm}`,
      'BadJwtLexiconMethod',
    )
  }

  const msgBytes = Buffer.from(parts.slice(0, 2).join('.'), 'utf8')
  const sigBytes = Buffer.from(sig, 'base64url')

  const signingKey = await getSigningKey(payload.iss, false)
  const { alg } = header

  let validSig: boolean
  try {
    validSig = await verifySignatureWithKey(signingKey, msgBytes, sigBytes, alg)
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
          ? await verifySignatureWithKey(
              freshSigningKey,
              msgBytes,
              sigBytes,
              alg,
            )
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

export const cryptoVerifySignatureWithKey: VerifySignatureWithKeyFn = async (
  key: string,
  msgBytes: Uint8Array,
  sigBytes: Uint8Array,
  alg: string,
) => {
  return crypto.verifySignature(key, msgBytes, sigBytes, {
    jwtAlg: alg,
    allowMalleableSig: true,
  })
}

const parseB64UrlToJson = (b64: string) => {
  return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'))
}

const parseHeader = (b64: string): ServiceJwtHeaders => {
  const header = parseB64UrlToJson(b64)
  if (!header || typeof header !== 'object' || typeof header.alg !== 'string') {
    throw new AuthRequiredError('poorly formatted jwt', 'BadJwt')
  }
  return header
}

const parsePayload = (b64: string): ServiceJwtPayload => {
  const payload = parseB64UrlToJson(b64)
  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof payload.iss !== 'string' ||
    typeof payload.aud !== 'string' ||
    typeof payload.exp !== 'number' ||
    (payload.lxm && typeof payload.lxm !== 'string') ||
    (payload.nonce && typeof payload.nonce !== 'string')
  ) {
    throw new AuthRequiredError('poorly formatted jwt', 'BadJwt')
  }
  return payload
}
