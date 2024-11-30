import { Fetch, FetchContext, cancelBody, peekJson } from '@atproto-labs/fetch'
import { SimpleStore } from '@atproto-labs/simple-store'
import { Key } from '@atproto/jwk'
import { base64url } from 'multiformats/bases/base64'

// "undefined" in non https environments or environments without crypto
const subtle = globalThis.crypto?.subtle as SubtleCrypto | undefined

const ReadableStream = globalThis.ReadableStream as
  | typeof globalThis.ReadableStream
  | undefined

export type DpopFetchWrapperOptions<C = FetchContext> = {
  key: Key
  iss: string
  nonces: SimpleStore<string, string>
  supportedAlgs?: string[]
  sha256?: (input: string) => Promise<string>

  /**
   * Is the intended server an authorization server (true) or a resource server
   * (false)? Setting this may allow to avoid parsing the response body to
   * determine the dpop-nonce.
   *
   * @default undefined
   */
  isAuthServer?: boolean
  fetch?: Fetch<C>
}

export function dpopFetchWrapper<C = FetchContext>({
  key,
  iss,
  supportedAlgs,
  nonces,
  sha256 = typeof subtle !== 'undefined' ? subtleSha256 : undefined,
  isAuthServer,
  fetch = globalThis.fetch,
}: DpopFetchWrapperOptions<C>): Fetch<C> {
  if (!sha256) {
    throw new TypeError(
      `crypto.subtle is not available in this environment. Please provide a sha256 function.`,
    )
  }

  const alg = negotiateAlg(key, supportedAlgs)

  return async function (this: C, input, init) {
    if (!key.algorithms.includes(alg)) {
      throw new TypeError(`Key does not support the algorithm ${alg}`)
    }

    const request: Request =
      init == null && input instanceof Request
        ? input
        : new Request(input, init)

    const authorizationHeader = request.headers.get('Authorization')
    const ath = authorizationHeader?.startsWith('DPoP ')
      ? await sha256(authorizationHeader.slice(5))
      : undefined

    const { method, url } = request
    const { origin } = new URL(url)

    let initNonce: string | undefined
    try {
      initNonce = await nonces.get(origin)
    } catch {
      // Ignore get errors, we will just not send a nonce
    }

    const initProof = await buildProof(
      key,
      alg,
      iss,
      method,
      url,
      initNonce,
      ath,
    )
    request.headers.set('DPoP', initProof)

    const initResponse = await fetch.call(this, request)

    // Make sure the response body is consumed. Either by the caller (when the
    // response is returned), of if an error is thrown (catch block).

    const nextNonce = initResponse.headers.get('DPoP-Nonce')
    if (!nextNonce || nextNonce === initNonce) {
      // No nonce was returned or it is the same as the one we sent. No need to
      // update the nonce store, or retry the request.
      return initResponse
    }

    // Store the fresh nonce for future requests
    try {
      await nonces.set(origin, nextNonce)
    } catch {
      // Ignore set errors
    }

    const shouldRetry = await isUseDpopNonceError(initResponse, isAuthServer)
    if (!shouldRetry) {
      // Not a "use_dpop_nonce" error, so there is no need to retry
      return initResponse
    }

    // If the input stream was already consumed, we cannot retry the request. A
    // solution would be to clone() the request but that would bufferize the
    // entire stream in memory which can lead to memory starvation. Instead, we
    // will return the original response and let the calling code handle retries.

    if (input === request) {
      // The input request body was consumed. We cannot retry the request.
      return initResponse
    }

    if (ReadableStream && init?.body instanceof ReadableStream) {
      // The init body was consumed. We cannot retry the request.
      return initResponse
    }

    // We will now retry the request with the fresh nonce.

    // The initial response body must be consumed (see cancelBody's doc).
    await cancelBody(initResponse, 'log')

    const nextProof = await buildProof(
      key,
      alg,
      iss,
      method,
      url,
      nextNonce,
      ath,
    )
    const nextRequest = new Request(input, init)
    nextRequest.headers.set('DPoP', nextProof)

    return fetch.call(this, nextRequest)
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
    throw new Error('Only asymmetric keys can be used as DPoP proofs')
  }

  const now = Math.floor(Date.now() / 1e3)

  return key.createJwt(
    // https://datatracker.ietf.org/doc/html/rfc9449#section-4.2
    {
      alg,
      typ: 'dpop+jwt',
      jwk: key.bareJwk,
    },
    {
      iss,
      iat: now,
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
  if (isAuthServer === undefined || isAuthServer === false) {
    if (response.status === 401) {
      const wwwAuth = response.headers.get('WWW-Authenticate')
      if (wwwAuth?.startsWith('DPoP')) {
        return wwwAuth.includes('error="use_dpop_nonce"')
      }
    }
  }

  // https://datatracker.ietf.org/doc/html/rfc9449#name-authorization-server-provid
  if (isAuthServer === undefined || isAuthServer === true) {
    if (response.status === 400) {
      try {
        const json = await peekJson(response, 10 * 1024)
        return typeof json === 'object' && json?.['error'] === 'use_dpop_nonce'
      } catch {
        // Response too big (to be "use_dpop_nonce" error) or invalid JSON
        return false
      }
    }
  }

  return false
}

function negotiateAlg(key: Key, supportedAlgs: string[] | undefined): string {
  if (supportedAlgs) {
    // Use order of supportedAlgs as preference
    const alg = supportedAlgs.find((a) => key.algorithms.includes(a))
    if (alg) return alg
  } else {
    const [alg] = key.algorithms
    if (alg) return alg
  }

  throw new Error('Key does not match any alg supported by the server')
}

async function subtleSha256(input: string): Promise<string> {
  if (subtle == null) {
    throw new Error(
      `crypto.subtle is not available in this environment. Please provide a sha256 function.`,
    )
  }

  const bytes = new TextEncoder().encode(input)
  const digest = await subtle.digest('SHA-256', bytes)
  const digestBytes = new Uint8Array(digest)
  return base64url.baseEncode(digestBytes)
}
