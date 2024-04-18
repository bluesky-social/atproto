import { Transformer } from '@atproto-labs/transformer'

export type FetchErrorOptions = {
  cause?: unknown
  request?: Request
  response?: Response
}

export class FetchError extends Error {
  public readonly request?: Request
  public readonly response?: Response

  constructor(
    public readonly statusCode: number,
    message?: string,
    { cause, request, response }: FetchErrorOptions = {},
  ) {
    super(message, { cause })
    this.request = request
    this.response = response
  }

  static async from(err: unknown) {
    const cause = extractCause(err)
    return new FetchError(...extractInfo(cause), { cause })
  }
}

export const fetchFailureHandler: Transformer<unknown, never> = async (
  err: unknown,
) => {
  throw await FetchError.from(err)
}

function extractCause(err: unknown): unknown {
  // Unwrap the Network error from undici (i.e. Node's internal fetch() implementation)
  // https://github.com/nodejs/undici/blob/3274c975947ce11a08508743df026f73598bfead/lib/web/fetch/index.js#L223-L228
  if (
    err instanceof TypeError &&
    err.message === 'fetch failed' &&
    err.cause instanceof Error
  ) {
    return err.cause
  }

  return err
}

export function extractInfo(
  err: unknown,
): [statusCode: number, message: string] {
  if (typeof err === 'string' && err.length > 0) {
    return [502, err]
  }

  if (!(err instanceof Error)) {
    return [502, 'Unable to fetch']
  }

  if ('code' in err && typeof err.code === 'string') {
    switch (true) {
      case err.code === 'ENOTFOUND':
        return [404, 'Invalid hostname']
      case err.code === 'ECONNREFUSED':
        return [502, 'Connection refused']
      case err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT':
        return [502, 'Self-signed certificate']
      case err.code.startsWith('ERR_TLS'):
        return [502, 'TLS error']
      case err.code.startsWith('ECONN'):
        return [502, 'Connection error']
    }
  }

  // Let's assume that other errors are "bad gateway" errors
  return [502, err.message]
}
