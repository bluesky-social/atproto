import { InvalidDidError } from './did-error.js'
import { Did } from './did.js'

export function wellKnownUrl(base: URL, path: string) {
  const wellKnownPath =
    base.pathname === '/'
      ? `/.well-known/${path}`
      : `${base.pathname.replace(/\/+$/, '')}/${path}`

  return new URL(wellKnownPath, base)
}

export const extractDidMethod = <D extends string>(did: D) => {
  if (!did.startsWith('did:')) {
    throw new InvalidDidError(did, `Not a DID`)
  }
  const secondColon = did.indexOf(':', 4)
  if (secondColon === -1) {
    throw new InvalidDidError(did, `Missing method name`)
  }
  if (secondColon === did.length - 1) {
    throw new InvalidDidError(did, `Missing method specific id`)
  }

  return did.slice(4, secondColon) as D extends Did<infer M> ? M : string
}

export type DigitChar =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'

export type LowerAlphaChar =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z'
