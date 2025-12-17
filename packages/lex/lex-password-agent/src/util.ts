import { LexMap, l } from '@atproto/lex-schema'

export async function isExpiredTokenResponse(
  response: Response,
): Promise<boolean> {
  if (response.status !== 400) return false
  try {
    const json = await peekJson(response, 1024)
    return expiredTokenBodySchema.matches(json)
  } catch {
    return false
  }
}

async function peekJson(
  response: Response,
  maxSize = Infinity,
): Promise<unknown> {
  const type = extractType(response)
  if (type !== 'application/json') throw new Error('Not JSON')

  const length = extractLength(response)
  if (length == null || length > maxSize) throw new Error('Response too large')

  return response.clone().json()
}

function extractLength({ headers }: Response) {
  return headers.get('Content-Length')
    ? Number(headers.get('Content-Length'))
    : undefined
}

function extractType({ headers }: Response) {
  return headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase()
}

const expiredTokenBodySchema = l.object({
  error: l.literal('ExpiredToken'),
})

export function isUnrecoverableError(err: unknown) {
  return unrecoverableErrorSchema.matches(err)
}

const unrecoverableErrorSchema = l.enum([
  'AccountTakedown',
  'InvalidToken',
  'ExpiredToken',
])

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
