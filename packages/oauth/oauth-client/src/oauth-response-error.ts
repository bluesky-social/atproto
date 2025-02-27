import { Json, ifObject, ifString } from '@atproto-labs/fetch'

export class OAuthResponseError extends Error {
  readonly error?: string
  readonly errorDescription?: string

  constructor(
    public readonly response: Response,
    public readonly payload: Json,
  ) {
    const error = ifString(ifObject(payload)?.['error'])
    const errorDescription = ifString(ifObject(payload)?.['error_description'])

    const messageError = error ? `"${error}"` : 'unknown'
    const messageDesc = errorDescription ? `: ${errorDescription}` : ''
    const message = `OAuth ${messageError} error${messageDesc}`

    super(message)

    this.error = error
    this.errorDescription = errorDescription
  }

  get status() {
    return this.response.status
  }

  get headers() {
    return this.response.headers
  }
}
