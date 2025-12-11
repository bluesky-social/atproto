export const ifString = <T>(v: T) =>
  (typeof v === 'string' ? v : undefined) as unknown extends T
    ? undefined | string
    : T extends string
      ? string
      : undefined
export const ifArray = <T>(v: T) =>
  (Array.isArray(v) ? v : undefined) as unknown extends T
    ? undefined | unknown[]
    : T extends unknown[]
      ? Extract<T, unknown[]>
      : undefined

export async function peekJson(
  response: Response,
  maxSize = Infinity,
): Promise<unknown> {
  if (extractType(response) !== 'application/json') throw new Error('Not JSON')
  if (extractLength(response) > maxSize) throw new Error('Response too large')
  return response.clone().json()
}

function extractLength({ headers }: Response) {
  return headers.get('Content-Length')
    ? Number(headers.get('Content-Length'))
    : NaN
}

function extractType({ headers }: Response) {
  return headers.get('Content-Type')?.split(';')[0]?.trim()
}
