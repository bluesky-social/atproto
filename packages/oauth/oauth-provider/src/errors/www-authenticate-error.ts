import { VERIFY_ALGOS } from '../lib/util/crypto.js'
import { OAuthError } from './oauth-error.js'

export type WWWAuthenticateParams = Record<string, string | undefined>
export type WWWAuthenticate = Record<string, undefined | WWWAuthenticateParams>

export class WWWAuthenticateError extends OAuthError {
  public readonly wwwAuthenticate: WWWAuthenticate

  constructor(
    error: string,
    error_description: string,
    wwwAuthenticate: WWWAuthenticate,
    cause?: unknown,
  ) {
    super(error, error_description, 401, cause)

    this.wwwAuthenticate =
      wwwAuthenticate['DPoP'] != null
        ? {
            ...wwwAuthenticate,
            DPoP: { algs: VERIFY_ALGOS.join(' '), ...wwwAuthenticate['DPoP'] },
          }
        : wwwAuthenticate
  }

  get wwwAuthenticateHeader() {
    return formatWWWAuthenticateHeader(this.wwwAuthenticate)
  }
}

function formatWWWAuthenticateHeader(wwwAuthenticate: WWWAuthenticate): string {
  return Object.entries(wwwAuthenticate)
    .filter(isWWWAuthenticateEntry)
    .map(wwwAuthenticateEntryToString)
    .join(', ')
}

type WWWAuthenticateEntry = [type: string, params: WWWAuthenticateParams]
function isWWWAuthenticateEntry(
  entry: [string, unknown],
): entry is WWWAuthenticateEntry {
  const [, value] = entry
  return value != null && typeof value === 'object'
}

function wwwAuthenticateEntryToString([type, params]: WWWAuthenticateEntry) {
  const paramsEnc = Object.entries(params)
    .filter(isParamEntry)
    .map(paramEntryToString)

  return paramsEnc.length ? `${type} ${paramsEnc.join(', ')}` : type
}

type ParamEntry = [name: string, value: string]

function isParamEntry(entry: [string, unknown]): entry is ParamEntry {
  const [, value] = entry
  return typeof value === 'string' && value !== '' && !value.includes('"')
}

function paramEntryToString([name, value]: ParamEntry): string {
  return `${name}="${value}"`
}
