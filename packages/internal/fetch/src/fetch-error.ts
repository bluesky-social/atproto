export class FetchError extends Error {
  public readonly statusCode: number

  constructor(statusCode?: number, message?: string, options?: ErrorOptions) {
    if (statusCode == null || !message) {
      const info = extractInfo(extractRootCause(options?.cause))
      statusCode = statusCode ?? info[0]
      message = message || info[1]
    }

    super(message, options)

    this.statusCode = statusCode
  }
}

function extractRootCause(err: unknown): unknown {
  // Unwrap the Network error from undici (i.e. Node's internal fetch() implementation)
  // https://github.com/nodejs/undici/blob/3274c975947ce11a08508743df026f73598bfead/lib/web/fetch/index.js#L223-L228
  if (
    err instanceof TypeError &&
    err.message === 'fetch failed' &&
    err.cause !== undefined
  ) {
    return err.cause
  }

  return err
}

function extractInfo(err: unknown): [statusCode: number, message: string] {
  if (typeof err === 'string' && err.length > 0) {
    return [500, err]
  }

  if (!(err instanceof Error)) {
    return [500, 'Failed to fetch']
  }

  const code = err['code']
  if (typeof code === 'string') {
    switch (true) {
      case code === 'ENOTFOUND':
        return [400, 'Invalid hostname']
      case code === 'ECONNREFUSED':
        return [502, 'Connection refused']
      case code === 'DEPTH_ZERO_SELF_SIGNED_CERT':
        return [502, 'Self-signed certificate']
      case code.startsWith('ERR_TLS'):
        return [502, 'TLS error']
      case code.startsWith('ECONN'):
        return [502, 'Connection error']
      default:
        return [500, `${code} error`]
    }
  }

  return [500, err.message]
}
