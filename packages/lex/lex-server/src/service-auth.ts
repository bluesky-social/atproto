import * as crypto from '@atproto/crypto'
import {
  AtprotoDid,
  AtprotoDidDocument,
  Did,
  matchesIdentifier,
} from '@atproto/did'
import { fromBase64, isPlainObject, utf8FromBase64 } from '@atproto/lex-data'
import { DidString, isDidString } from '@atproto/lex-schema'
import {
  CreateDidResolverOptions,
  createDidResolver,
} from '@atproto-labs/did-resolver'
import { LexServerAuthError } from './errors.js'
import { LexRouterAuth } from './lex-server.js'

const BEARER_PREFIX = 'Bearer '

/**
 * A function to check and record nonce uniqueness.
 */
export type UniqueNonceChecker = (nonce: string) => Promise<boolean>

export type ServiceAuthOptions = CreateDidResolverOptions & {
  /**
   * Expected audience ("aud") claim in the JWT token. Set to `null` to skip
   * audience verification (not recommended).
   */
  audience: null | DidString
  /**
   * Function to check and record nonce uniqueness. The value checked here must
   * be unique within {@link ServiceAuthOptions.maxAge} seconds before and after
   * the current time.
   *
   * @param nonce - The nonce to check.
   */
  unique: UniqueNonceChecker
  /**
   * Maximum age of the JWT token in seconds.
   *
   * @default 300 (5 minutes)
   */
  maxAge?: number
}

export type ServiceAuthCredentials = {
  did: AtprotoDid
  didDocument: AtprotoDidDocument
  jwt: ParsedJwt
}

/**
 * Creates an authentication handler for LexRouter that verifies AT protocol
 * "service auth" JWT bearer tokens signed by decentralized identifiers (DIDs).
 */
export function serviceAuth({
  audience,
  maxAge = 5 * 60,
  unique,
  ...options
}: ServiceAuthOptions): LexRouterAuth<ServiceAuthCredentials> {
  const didResolver = createDidResolver(options)

  return async ({ request, method }) => {
    const { signal } = request
    const jwt = await parseJwtBearer(request, {
      lxm: method.nsid,
      maxAge,
      audience,
      unique,
    })

    let didDocument: AtprotoDidDocument = await didResolver
      .resolve(jwt.payload.iss, { signal })
      .catch((cause) => {
        throw new LexServerAuthError(
          'AuthenticationRequired',
          'Could not resolve DID document',
          { Bearer: { error: 'DidResolutionFailed' } },
          { cause },
        )
      })

    const key = getAtprotoSigningKey(didDocument)

    if (!key || !(await verifyJwt(jwt, key))) {
      signal.throwIfAborted()

      // Try refreshing the DID document in case it was updated
      didDocument = await didResolver
        .resolve(jwt.payload.iss, { signal, noCache: true })
        .catch((cause) => {
          throw new LexServerAuthError(
            'AuthenticationRequired',
            'Could not resolve DID document',
            { Bearer: { error: 'DidResolutionFailed' } },
            { cause },
          )
        })

      // Verify again with the fresh key (if it changed)
      const keyFresh = getAtprotoSigningKey(didDocument)
      if (!keyFresh || key === keyFresh || !(await verifyJwt(jwt, keyFresh))) {
        throw new LexServerAuthError(
          'AuthenticationRequired',
          'Invalid JWT signature',
          { Bearer: { error: 'BadJwtSignature' } },
        )
      }
    }

    return {
      did: didDocument.id,
      didDocument,
      jwt,
    }
  }
}

async function verifyJwt(jwt: ParsedJwt, key: Did<'key'>) {
  try {
    return await crypto.verifySignature(key, jwt.message, jwt.signature, {
      jwtAlg: jwt.header.alg,
      allowMalleableSig: true,
    })
  } catch (cause) {
    throw new LexServerAuthError(
      'AuthenticationRequired',
      'Could not verify JWT signature',
      { Bearer: { error: 'BadJwtSignature' } },
      { cause },
    )
  }
}

function getAtprotoSigningKey(
  didDocument: AtprotoDidDocument,
): null | Did<'key'> {
  try {
    const key = didDocument.verificationMethod?.find(
      isAtprotoVerificationMethod,
      didDocument,
    )

    if (key?.publicKeyMultibase) {
      if (key.type === 'EcdsaSecp256r1VerificationKey2019') {
        const keyBytes = crypto.multibaseToBytes(key.publicKeyMultibase)
        return crypto.formatDidKey(crypto.P256_JWT_ALG, keyBytes)
      } else if (key.type === 'EcdsaSecp256k1VerificationKey2019') {
        const keyBytes = crypto.multibaseToBytes(key.publicKeyMultibase)
        return crypto.formatDidKey(crypto.SECP256K1_JWT_ALG, keyBytes)
      } else if (key.type === 'Multikey') {
        const parsed = crypto.parseMultikey(key.publicKeyMultibase)
        return crypto.formatDidKey(parsed.jwtAlg, parsed.keyBytes)
      }
    }
  } catch {
    // Invalid key, ignore
  }

  return null
}

function isAtprotoVerificationMethod<
  V extends string | { id: string; type: string; publicKeyMultibase?: string },
>(
  this: AtprotoDidDocument,
  vm: V,
): vm is Exclude<V, string> & {
  id: `${string}#atproto`
} {
  return typeof vm === 'object' && matchesIdentifier(this.id, 'atproto', vm.id)
}

async function parseJwtBearer(
  request: Request,
  options: ParseJwtOptions,
): Promise<ParsedJwt> {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    throw new LexServerAuthError(
      'AuthenticationRequired',
      'Bearer token required',
      { Bearer: { error: 'MissingBearer' } },
    )
  }

  const token = authorization.slice(BEARER_PREFIX.length).trim()

  return parseJwt(token, options)
}

export type ParseJwtOptions = {
  maxAge: number
  audience: null | DidString
  unique: UniqueNonceChecker
  lxm: string
}

export type ParsedJwt = {
  header: HeaderObject
  payload: PayloadObject
  message: Uint8Array
  signature: Uint8Array
}

async function parseJwt(
  token: string,
  options: ParseJwtOptions,
): Promise<ParsedJwt> {
  const {
    length,
    0: headerB64,
    1: payloadB64,
    2: signatureB64,
  } = token.split('.')
  if (length !== 3) {
    throw new LexServerAuthError(
      'AuthenticationRequired',
      'Invalid JWT token',
      { Bearer: { error: 'BadJwt' } },
    )
  }

  let header: HeaderObject
  try {
    header = jsonFromBase64(headerB64, isHeaderObject)
  } catch (cause) {
    throw new LexServerAuthError(
      'AuthenticationRequired',
      'Invalid JWT token',
      { Bearer: { error: 'BadJwt' } },
      { cause },
    )
  }

  if (
    header.alg === 'none' ||
    // service tokens are not OAuth 2.0 access tokens
    // https://datatracker.ietf.org/doc/html/rfc9068
    header.typ === 'at+jwt' ||
    // "refresh+jwt" is a non-standard type used by the @atproto packages
    header.typ === 'refresh+jwt' ||
    // "DPoP" proofs are not meant to be used as service tokens
    // https://datatracker.ietf.org/doc/html/rfc9449
    header.typ === 'dpop+jwt'
  ) {
    throw new LexServerAuthError(
      'AuthenticationRequired',
      'Invalid JWT token',
      { Bearer: { error: 'BadJwt' } },
    )
  }

  let payload: PayloadObject
  try {
    payload = jsonFromBase64(payloadB64, isPayloadObject)
  } catch (cause) {
    throw new LexServerAuthError(
      'AuthenticationRequired',
      'Invalid JWT token',
      { Bearer: { error: 'BadJwt' } },
      { cause },
    )
  }

  if (options.audience !== null && options.audience !== payload.aud) {
    throw new LexServerAuthError('AuthenticationRequired', 'Invalid audience', {
      Bearer: { error: 'InvalidAudience' },
    })
  }

  const now = Math.floor(Date.now() / 1000)

  if (payload.nbf != null && now < payload.nbf) {
    throw new LexServerAuthError(
      'AuthenticationRequired',
      'JWT token not yet valid',
      { Bearer: { error: 'JwtNotYetValid' } },
    )
  }

  if (now > payload.exp) {
    throw new LexServerAuthError(
      'AuthenticationRequired',
      'JWT token expired',
      { Bearer: { error: 'JwtExpired' } },
    )
  }

  // Prevent issuer from generating very long-lived tokens
  if (
    timeDiff(now, payload.exp) > options.maxAge ||
    timeDiff(now, payload.iat) > options.maxAge
  ) {
    throw new LexServerAuthError(
      'AuthenticationRequired',
      'JWT token too old',
      { Bearer: { error: 'JwtTooOld' } },
    )
  }

  if (payload.lxm != null && typeof payload.lxm !== options.lxm) {
    throw new LexServerAuthError(
      'AuthenticationRequired',
      'Invalid JWT lexicon method ("lxm")',
      { Bearer: { error: 'BadJwtLexiconMethod' } },
    )
  }

  if (payload.nonce != null && !(await (0, options.unique)(payload.nonce))) {
    throw new LexServerAuthError(
      'AuthenticationRequired',
      'Replay attack detected: nonce is not unique',
      { Bearer: { error: 'NonceNotUnique' } },
    )
  }

  return {
    header,
    payload,
    message: textEncoder.encode(`${headerB64}.${payloadB64}`),
    signature: fromBase64(signatureB64, 'base64url'),
  }
}

const textEncoder = /*#__PURE__*/ new TextEncoder()

type HeaderObject = { alg: string; typ?: string }
function isHeaderObject(obj: unknown): obj is HeaderObject {
  return (
    isPlainObject(obj) &&
    typeof obj.alg === 'string' &&
    (obj.typ === undefined || typeof obj.typ === 'string')
  )
}

type PayloadObject = {
  iss: DidString
  aud: DidString
  exp: number
  iat?: number
  nbf?: number
  lxm?: string
  nonce?: string
}
export function isPayloadObject(obj: unknown): obj is PayloadObject {
  return (
    isPlainObject(obj) &&
    typeof obj.iss === 'string' &&
    typeof obj.aud === 'string' &&
    (obj.lxm === undefined || typeof obj.lxm === 'string') &&
    (obj.nonce === undefined || typeof obj.nonce === 'string') &&
    (obj.iat === undefined || isPositiveInt(obj.iat)) &&
    (obj.nbf === undefined || isPositiveInt(obj.nbf)) &&
    isPositiveInt(obj.exp) &&
    isDidString(obj.iss) &&
    isDidString(obj.aud)
  )
}

function timeDiff(t1: number, t2?: number): number {
  if (t2 === undefined) return 0
  return Math.abs(t1 - t2)
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function jsonFromBase64<T>(b64: string, isType: (obj: unknown) => obj is T): T {
  const obj = JSON.parse(utf8FromBase64(b64, 'base64url'))
  if (isType(obj)) return obj
  throw new Error('Invalid type')
}
