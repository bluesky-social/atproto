import type { Json } from '@atproto-labs/fetch'
import { ifString } from './util.js'

export class OAuthResponseError extends Error {
  readonly error?: string
  readonly errorDescription?: string

  constructor(
    public readonly response: Response,
    public readonly payload: Json,
  ) {
    const error = ifString((payload as any)?.['error'])
    const errorDescription = ifString((payload as any)?.['error_description'])

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
