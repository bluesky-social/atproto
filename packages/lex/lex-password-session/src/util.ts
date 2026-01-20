import { LexMap, LexValue } from '@atproto/lex-client'
import { l } from '@atproto/lex-schema'

export const noop = () => {}

export async function extractXrpcErrorCode(
  response: Response,
): Promise<string | null> {
  const json = await peekJson(response, 10 * 1024) // Avoid reading large bodies
  if (json === undefined) return null
  if (!l.lexErrorData.matches(json)) return null
  return json.error
}

async function peekJson(
  response: Response,
  maxSize = Infinity,
): Promise<undefined | LexValue> {
  const type = extractType(response)
  if (type !== 'application/json') return undefined
  const length = extractLength(response)
  if (length != null && length > maxSize) return undefined

  try {
    return (await response.clone().json()) as Promise<LexValue>
  } catch {
    return undefined
  }
}

function extractLength({ headers }: Response) {
  return headers.get('Content-Length')
    ? Number(headers.get('Content-Length'))
    : undefined
}

function extractType({ headers }: Response) {
  return headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase()
}

export function extractPdsUrl(didDoc?: LexMap): string | null {
  const pdsService = ifArray(didDoc?.service)?.find((service) =>
    ifString((service as any)?.id)?.endsWith('#atproto_pds'),
  )
  const pdsEndpoint = ifString((pdsService as any)?.serviceEndpoint)
  return pdsEndpoint && URL.canParse(pdsEndpoint) ? pdsEndpoint : null
}

const ifString = <T>(v: T) =>
  (typeof v === 'string' ? v : undefined) as unknown extends T
    ? undefined | string
    : T extends string
      ? string
      : undefined

const ifArray = <T>(v: T) =>
  (Array.isArray(v) ? v : undefined) as unknown extends T
    ? undefined | unknown[]
    : T extends unknown[]
      ? Extract<T, unknown[]>
      : undefined
