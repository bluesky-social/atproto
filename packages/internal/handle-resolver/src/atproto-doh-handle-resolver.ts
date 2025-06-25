import {
  AtprotoHandleResolver,
  AtprotoHandleResolverOptions,
} from './atproto-handle-resolver.js'
import { HandleResolverError } from './handle-resolver-error.js'
import { ResolveTxt } from './internal-resolvers/dns-handle-resolver.js'
import { HandleResolver } from './types.js'

export type AtprotoDohHandleResolverOptions = Omit<
  AtprotoHandleResolverOptions,
  'resolveTxt' | 'resolveTxtFallback'
> & {
  dohEndpoint: string | URL
}

export class AtprotoDohHandleResolver
  extends AtprotoHandleResolver
  implements HandleResolver
{
  constructor(options: AtprotoDohHandleResolverOptions) {
    super({
      ...options,
      resolveTxt: dohResolveTxtFactory(options),
      resolveTxtFallback: undefined,
    })
  }
}

/**
 * Resolver for DNS-over-HTTPS (DoH) handles. Only works with servers supporting
 * Google Flavoured "application/dns-json" queries.
 *
 * @see {@link https://developers.google.com/speed/public-dns/docs/doh/json}
 * @see {@link https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/}
 * @todo Add support for DoH using application/dns-message (?)
 */
function dohResolveTxtFactory({
  dohEndpoint,
  fetch = globalThis.fetch,
}: AtprotoDohHandleResolverOptions): ResolveTxt {
  return async (hostname) => {
    const url = new URL(dohEndpoint)
    url.searchParams.set('type', 'TXT')
    url.searchParams.set('name', hostname)

    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/dns-json' },
      redirect: 'follow',
    })
    try {
      const contentType = response.headers.get('content-type')?.trim()
      if (!response.ok) {
        const message = contentType?.startsWith('text/plain')
          ? await response.text()
          : `Failed to resolve ${hostname}`
        throw new HandleResolverError(message)
      } else if (contentType?.match(/application\/(dns-)?json/i) == null) {
        throw new HandleResolverError('Unexpected response from DoH server')
      }

      const result = asResult(await response.json())
      return result.Answer?.filter(isAnswerTxt).map(extractTxtData) ?? null
    } finally {
      // Make sure to always cancel the response body as some engines (Node 👀)
      // do not do this automatically.
      // https://undici.nodejs.org/#/?id=garbage-collection
      if (response.bodyUsed === false) {
        // Handle rejection asynchronously
        void response.body?.cancel().catch(onCancelError)
      }
    }
  }
}

function onCancelError(err: unknown) {
  if (!(err instanceof DOMException) || err.name !== 'AbortError') {
    console.error('An error occurred while cancelling the response body:', err)
  }
}

type Result = { Status: number; Answer?: Answer[] }
function isResult(result: unknown): result is Result {
  if (typeof result !== 'object' || result === null) return false
  if (!('Status' in result) || typeof result.Status !== 'number') return false
  if ('Answer' in result && !isArrayOf(result.Answer, isAnswer)) return false
  return true
}
function asResult(result: unknown): Result {
  if (isResult(result)) return result
  throw new HandleResolverError('Invalid DoH response')
}

function isArrayOf<T>(
  value: unknown,
  predicate: (v: unknown) => v is T,
): value is T[] {
  return Array.isArray(value) && value.every(predicate)
}

type Answer = { name: string; type: number; data: string; TTL: number }
function isAnswer(answer: unknown): answer is Answer {
  return (
    typeof answer === 'object' &&
    answer !== null &&
    'name' in answer &&
    typeof answer.name === 'string' &&
    'type' in answer &&
    typeof answer.type === 'number' &&
    'data' in answer &&
    typeof answer.data === 'string' &&
    'TTL' in answer &&
    typeof answer.TTL === 'number'
  )
}

type AnswerTxt = Answer & { type: 16 }
function isAnswerTxt(answer: Answer): answer is AnswerTxt {
  return answer.type === 16
}

function extractTxtData(answer: AnswerTxt): string {
  return answer.data.replace(/^"|"$/g, '').replace(/\\"/g, '"')
}
