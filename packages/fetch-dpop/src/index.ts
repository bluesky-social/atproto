import { b64uEncode } from '@atproto/b64'
import { GenericStore } from '@atproto/caching'
import { Fetch, Json } from '@atproto/fetch'
import { Key } from '@atproto/jwk'

export type DpopFetchWrapperOptions = {
  key: Key
  iss: string
  alg?: string
  sha256?: (input: string) => Promise<string>
  nonceCache?: GenericStore<string, string>

  /**
   * Is the intended server an authorization server (true) or a resource server
   * (false)? Setting this may allow to avoid parsing the response body to
   * determine the dpop-nonce.
   *
   * @default undefined
   */
  isAuthServer?: boolean
  fetch?: Fetch
}

export function dpopFetchWrapper({
  key,
  iss,
  alg,
  sha256 = typeof crypto !== 'undefined' && crypto.subtle != null
    ? subtleSha256
    : undefined,
  isAuthServer,
  nonceCache,
}: DpopFetchWrapperOptions): Fetch {
  if (!sha256) {
    throw new Error(
      `crypto.subtle is not available in this environment. Please provide a sha256 function.`,
    )
  }

  return async function (request) {
    return dpopFetch.call(
      this,
      request,
      key,
      iss,
      alg,
      sha256,
      nonceCache,
      isAuthServer,
      fetch,
    )
  }
}

export async function dpopFetch(
  this: ThisParameterType<Fetch>,
  request: Request,
  key: Key,
  iss: string,
  alg: string = key.alg || 'ES256',
  sha256: (input: string) => string | PromiseLike<string> = subtleSha256,
  nonceCache?: GenericStore<string, string>,
  isAuthServer?: boolean,
  fetch = globalThis.fetch as Fetch,
): Promise<Response> {
  const authorizationHeader = request.headers.get('Authorization')
  const ath = authorizationHeader?.startsWith('DPoP ')
    ? await sha256(authorizationHeader.slice(5))
    : undefined

  const { method, url } = request
  const { origin } = new URL(url)
  let nonce: string | undefined

  // Clone request for potential retry
  const clonedRequest = request.clone()

  // Use the cached nonce if available
  try {
    nonce = await nonceCache?.get(origin)
  } catch {
    // Ignore cache.get errors
  }

  // Make sure the clonedRequest body gets (finally) consumed.
  try {
    const dpopProof = await buildProof(key, alg, iss, method, url, nonce, ath)
    request.headers.set('DPoP', dpopProof)

    const response = await fetch(request)

    // Make sure the response body is consumed. Either by the caller (when the
    // response is returned), of if an error is thrown (catch block).
    try {
      nonce = response.headers.get('DPoP-Nonce') || undefined
      if (!nonce) {
        // We don't have a nonce, so we can't retry
        return response
      }

      // Store the fresh nonce for future requests
      try {
        await nonceCache?.set(origin, nonce)
      } catch {
        // Ignore cache.set errors
      }

      if (!(await isUseDpopNonceError(response, isAuthServer))) {
        // Not a use_dpop_nonce error, so there is no need to retry
        return response
      }

      // If the response was not returned to the caller, make sure the body is
      // consumed.
      await response.body?.cancel()

      const dpopProof = await buildProof(key, alg, iss, method, url, nonce, ath)
      clonedRequest.headers.set('DPoP', dpopProof)

      return await fetch(clonedRequest)
    } catch (err) {
      await response.body?.cancel(err)
      throw err
    }
  } finally {
    await clonedRequest.body?.cancel()
  }
}

async function buildProof(
  key: Key,
  alg: string,
  iss: string,
  htm: string,
  htu: string,
  nonce?: string,
  ath?: string,
) {
  if (!key.bareJwk) {
    throw new Error('Only asymetric keys can be used as DPoP proofs')
  }

  const now = Math.floor(Date.now() / 1e3)

  return key.createJwt(
    {
      alg,
      typ: 'dpop+jwt',
      jwk: key.bareJwk,
    },
    {
      iss,
      iat: now,
      exp: now + 10,
      // Any collision will cause the request to be rejected by the server. no biggie.
      jti: Math.random().toString(36).slice(2),
      htm,
      htu,
      nonce,
      ath,
    },
  )
}

async function isUseDpopNonceError(
  response: Response,
  isAuthServer?: boolean,
): Promise<boolean> {
  // https://datatracker.ietf.org/doc/html/rfc6750#section-3
  // https://datatracker.ietf.org/doc/html/rfc9449#name-resource-server-provided-no
  if (isAuthServer == null || isAuthServer === false) {
    const wwwAuth = response.headers.get('WWW-Authenticate')
    if (wwwAuth?.startsWith('DPoP')) {
      return wwwAuth.includes('error="use_dpop_nonce"')
    }
  }

  // https://datatracker.ietf.org/doc/html/rfc9449#name-authorization-server-provid
  if (isAuthServer == null || isAuthServer === true) {
    if (response.status === 400) {
      const mime = response.headers.get('Content-Type')?.split(';')[0]?.trim()
      if (mime === 'application/json') {
        try {
          const body: Json = await response.clone().json()
          return (
            typeof body === 'object' &&
            !Array.isArray(body) &&
            body?.['error'] === 'use_dpop_nonce'
          )
        } catch {
          return false
        }
      }
    }
  }

  return false
}

function subtleSha256(input: string): Promise<string> {
  if (typeof crypto === 'undefined' || crypto.subtle == null) {
    throw new Error(
      `crypto.subtle is not available in this environment. Please provide a sha256 function.`,
    )
  }

  return crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(input))
    .then((digest) => b64uEncode(new Uint8Array(digest)))
}
