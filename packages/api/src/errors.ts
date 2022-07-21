export enum ErrorCode {
  NetworkError = 'NetworkError',
  DidResolutionFailed = 'DidResolutionFailed',
  NameResolutionFailed = 'NameResolutionFailed',
}

export class NameResolutionFailed extends Error {
  code = ErrorCode.NameResolutionFailed
  constructor(name: string) {
    super(`Failed to resolve name "${name}"`)
  }
}

export class DidResolutionFailed extends Error {
  code = ErrorCode.DidResolutionFailed
  constructor(did: string) {
    super(`Failed to resolve DID "${did}"`)
  }
}

export class WritePermissionError extends Error {
  constructor() {
    super('No write permissions have been granted for this repo')
  }
}

export class APIResponseError extends Error {
  constructor(
    public httpStatusCode: number,
    public httpStatusText: string,
    public httpHeaders?: Record<string, string>,
    public httpResponseBody?: any,
  ) {
    super(httpResponseBody?.message || `${httpStatusCode} ${httpStatusText}`)
  }

  get code(): ErrorCode {
    return this.httpResponseBody?.code || 'NetworkError'
  }
}
