import { ResponseType } from '@atproto/xrpc'
import {
  InvalidRequestError,
  XRPCError as XRPCServerError,
} from '@atproto/xrpc-server'

export type AcceptFlags = { q: number }
export type Accept = [name: string, flags: AcceptFlags]

export const ACCEPT_ENCODING_COMPRESSED: readonly [Accept, ...Accept[]] = [
  ['gzip', { q: 1.0 }],
  ['deflate', { q: 0.9 }],
  ['br', { q: 0.8 }],
  ['identity', { q: 0.1 }],
]

export const ACCEPT_ENCODING_UNCOMPRESSED: readonly [Accept, ...Accept[]] = [
  ['identity', { q: 1.0 }],
  ['gzip', { q: 0.3 }],
  ['deflate', { q: 0.2 }],
  ['br', { q: 0.1 }],
]

// accept-encoding defaults to "identity with lowest priority"
const ACCEPT_ENC_DEFAULT = ['identity', { q: 0.001 }] as const satisfies Accept
const ACCEPT_FORBID_STAR = ['*', { q: 0 }] as const satisfies Accept

export function buildProxiedContentEncoding(
  acceptHeader: undefined | string | string[],
  preferCompressed: boolean,
): string {
  return negotiateContentEncoding(
    acceptHeader,
    preferCompressed
      ? ACCEPT_ENCODING_COMPRESSED
      : ACCEPT_ENCODING_UNCOMPRESSED,
  )
}

export function negotiateContentEncoding(
  acceptHeader: undefined | string | string[],
  preferences: readonly Accept[],
): string {
  const acceptMap = Object.fromEntries<undefined | AcceptFlags>(
    parseAcceptEncoding(acceptHeader),
  )

  // Make sure the default (identity) is covered by the preferences
  if (!preferences.some(coversIdentityAccept)) {
    preferences = [...preferences, ACCEPT_ENC_DEFAULT]
  }

  const common = preferences.filter(([name]) => {
    const acceptQ = (acceptMap[name] ?? acceptMap['*'])?.q
    // Per HTTP/1.1, "identity" is always acceptable unless explicitly rejected
    if (name === 'identity') {
      return acceptQ == null || acceptQ > 0
    } else {
      return acceptQ != null && acceptQ > 0
    }
  })

  // Since "identity" was present in the preferences, a missing "identity" in
  // the common array means that the client explicitly rejected it. Let's reflect
  // this by adding it to the common array.
  if (!common.some(coversIdentityAccept)) {
    common.push(ACCEPT_FORBID_STAR)
  }

  // If no common encodings are acceptable, throw a 406 Not Acceptable error
  if (!common.some(isAllowedAccept)) {
    throw new XRPCServerError(
      ResponseType.NotAcceptable,
      'this service does not support any of the requested encodings',
    )
  }

  return formatAcceptHeader(common as [Accept, ...Accept[]])
}

function coversIdentityAccept([name]: Accept): boolean {
  return name === 'identity' || name === '*'
}

function isAllowedAccept([, flags]: Accept): boolean {
  return flags.q > 0
}

/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Glossary/Quality_values}
 */
export function formatAcceptHeader(
  accept: readonly [Accept, ...Accept[]],
): string {
  return accept.map(formatAcceptPart).join(',')
}

function formatAcceptPart([name, flags]: Accept): string {
  return `${name};q=${flags.q}`
}

function parseAcceptEncoding(
  acceptEncodings: undefined | string | string[],
): Accept[] {
  if (!acceptEncodings?.length) return []

  return Array.isArray(acceptEncodings)
    ? acceptEncodings.flatMap(parseAcceptEncoding)
    : acceptEncodings.split(',').map(parseAcceptEncodingDefinition)
}

function parseAcceptEncodingDefinition(def: string): Accept {
  const { length, 0: encoding, 1: params } = def.trim().split(';', 3)

  if (length > 2) {
    throw new InvalidRequestError(`Invalid accept-encoding: "${def}"`)
  }

  if (!encoding || encoding.includes('=')) {
    throw new InvalidRequestError(`Invalid accept-encoding: "${def}"`)
  }

  const flags = { q: 1 }
  if (length === 2) {
    const { length, 0: key, 1: value } = params.split('=', 3)
    if (length !== 2) {
      throw new InvalidRequestError(`Invalid accept-encoding: "${def}"`)
    }

    if (key === 'q' || key === 'Q') {
      const q = parseFloat(value)
      if (q === 0 || (Number.isFinite(q) && q <= 1 && q >= 0.001)) {
        flags.q = q
      } else {
        throw new InvalidRequestError(`Invalid accept-encoding: "${def}"`)
      }
    } else {
      throw new InvalidRequestError(`Invalid accept-encoding: "${def}"`)
    }
  }

  return [encoding.toLowerCase(), flags]
}
