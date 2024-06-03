import { InvalidRedirectUriError } from '../errors/invalid-redirect-uri-error.js'

export function parseRedirectUri(redirectUri: string): URL {
  try {
    return new URL(redirectUri)
  } catch (err) {
    throw InvalidRedirectUriError.from(err)
  }
}
