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
 * Callback function to check and record nonce uniqueness.
 *
 * Used to prevent replay attacks by ensuring each nonce is only used once.
 * The implementation must track nonces for at least the `maxAge` duration
 * (default 5 minutes before and after the current time).
 *
 * @param nonce - The nonce string from the JWT token
 * @returns Promise resolving to `true` if the nonce is unique (first time seen),
 *          `false` if it has been seen before
 *
 * @example
 * ```typescript
 * // Using Redis for nonce tracking
 * const checkNonce: UniqueNonceChecker = async (nonce) => {
 *   const key = `nonce:${nonce}`
 *   const result = await redis.setnx(key, '1')
 *   if (result === 1) {
 *     await redis.expire(key, 600) // 10 minutes TTL
 *     return true
 *   }
 *   return false
 * }
 * ```
 */
export type UniqueNonceChecker = (nonce: string) => Promise<boolean>

/**
 * Configuration options for AT Protocol service authentication.
 *
 * Service auth is used for server-to-server communication in the AT Protocol,
 * where one service authenticates to another using signed JWT tokens tied to
 * the caller's DID.
 *
 * @example
 * ```typescript
 * const options: ServiceAuthOptions = {
 *   audience: 'did:web:api.example.com',
 *   unique: async (nonce) => nonceStore.checkAndAdd(nonce),
 *   maxAge: 300, // 5 minutes
 *   // Optional DID resolver options
 *   plcDirectoryUrl: 'https://plc.directory'
 * }
 * ```
 */
export type ServiceAuthOptions = CreateDidResolverOptions & {
  /**
   * Expected audience ("aud") claim in the JWT token.
   *
   * This should be the DID of your service. The token must include this
   * value in its `aud` claim to be accepted. Set to `null` to skip
   * audience verification (not recommended for production).
   */
  audience: null | DidString
  /**
   * Function to check and record nonce uniqueness.
   *
   * This is critical for preventing replay attacks. The value checked here
   * must be unique within `maxAge` seconds before and after the current time.
   *
   * @param nonce - The nonce to check
   * @returns Promise resolving to `true` if unique, `false` if seen before
   */
  unique: UniqueNonceChecker
  /**
   * Maximum age of the JWT token in seconds.
   *
   * Tokens with `iat` (issued at) or `exp` (expiry) timestamps outside
   * this window from the current time will be rejected.
   *
   * @default 300 (5 minutes)
   */
  maxAge?: number
}

/**
 * Credentials returned after successful service authentication.
 *
 * Contains the verified DID, resolved DID document, and parsed JWT token.
 * These are available in handler context as `ctx.credentials`.
 *
 * @example
 * ```typescript
 * router.add(protectedMethod, {
 *   handler: async (ctx) => {
 *     const { did, didDocument, jwt } = ctx.credentials
 *     console.log('Request from:', did)
 *     console.log('Token expires:', new Date(jwt.payload.exp * 1000))
 *     return { body: { callerDid: did } }
 *   },
 *   auth: serviceAuth({ audience: myDid, unique: checkNonce })
 * })
 * ```
 */
export type ServiceAuthCredentials = {
  /** The verified AT Protocol DID of the caller. */
  did: AtprotoDid
  /** The resolved DID document of the caller. */
  didDocument: AtprotoDidDocument
  /** The parsed and validated JWT token. */
  jwt: ParsedJwt
}

/**
 * Creates an authentication handler for verifying AT Protocol service auth JWTs.
 *
 * Service auth is the standard authentication mechanism for server-to-server
 * communication in the AT Protocol. It uses JWT bearer tokens signed by the
 * caller's DID signing key, with the signature verified against the public
 * key in the caller's DID document.
 *
 * The handler performs the following validations:
 * - Extracts and parses the Bearer token from the Authorization header
 * - Validates JWT structure and claims (aud, exp, iat, lxm, nonce)
 * - Resolves the issuer's DID document
 * - Verifies the JWT signature against the `#atproto` verification method
 * - Checks nonce uniqueness to prevent replay attacks
 *
 * @param options - Configuration options for service auth
 * @returns An auth handler function for use with {@link LexRouter.add}
 *
 * @example Basic usage
 * ```typescript
 * import { LexRouter, serviceAuth } from '@atproto/lex-server'
 *
 * const router = new LexRouter()
 *
 * const auth = serviceAuth({
 *   audience: 'did:web:api.example.com',
 *   unique: async (nonce) => {
 *     // Check if nonce has been seen, return true if unique
 *     const isNew = await redis.setnx(`nonce:${nonce}`, '1')
 *     if (isNew) await redis.expire(`nonce:${nonce}`, 600)
 *     return isNew
 *   }
 * })
 *
 * router.add(myMethod, {
 *   handler: async (ctx) => {
 *     console.log('Authenticated as:', ctx.credentials.did)
 *     return { body: { success: true } }
 *   },
 *   auth
 * })
 * ```
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

/**
 * Options for parsing and validating a JWT token.
 */
export type ParseJwtOptions = {
  /** Maximum age in seconds for token validity window. */
  maxAge: number
  /** Expected audience claim, or null to skip audience verification. */
  audience: null | DidString
  /** Function to check nonce uniqueness. */
  unique: UniqueNonceChecker
  /** Expected lexicon method NSID for the `lxm` claim. */
  lxm: string
}

/**
 * A parsed and partially validated JWT token.
 *
 * Contains the decoded header and payload, along with the raw bytes
 * needed for signature verification.
 *
 * @example
 * ```typescript
 * const jwt: ParsedJwt = {
 *   header: { alg: 'ES256K', typ: 'JWT' },
 *   payload: {
 *     iss: 'did:plc:abc123',
 *     aud: 'did:web:api.example.com',
 *     exp: 1704067200,
 *     iat: 1704066900,
 *     lxm: 'com.atproto.sync.getBlob'
 *   },
 *   message: new Uint8Array([...]),
 *   signature: new Uint8Array([...])
 * }
 * ```
 */
export type ParsedJwt = {
  /** The decoded JWT header containing algorithm and type. */
  header: HeaderObject
  /** The decoded JWT payload containing claims. */
  payload: PayloadObject
  /** The raw header.payload bytes for signature verification. */
  message: Uint8Array
  /** The decoded signature bytes. */
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
