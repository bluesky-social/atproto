import { InvalidDidError } from '../did-error.js'
import { Did } from '../did.js'

const DID_PLC_PREFIX = `did:plc:`
const DID_PLC_PREFIX_LENGTH = DID_PLC_PREFIX.length
const DID_PLC_LENGTH = 32

export { DID_PLC_PREFIX }

export function isDidPlc(input: unknown): input is Did<'plc'> {
  // Optimization: equivalent to try/catch around "assertDidPlc"
  if (typeof input !== 'string') return false
  if (input.length !== DID_PLC_LENGTH) return false
  if (!input.startsWith(DID_PLC_PREFIX)) return false
  for (let i = DID_PLC_PREFIX_LENGTH; i < DID_PLC_LENGTH; i++) {
    if (!isBase32Char(input.charCodeAt(i))) return false
  }
  return true
}

export function asDidPlc(input: unknown): Did<'plc'> {
  assertDidPlc(input)
  return input
}

export function assertDidPlc(input: unknown): asserts input is Did<'plc'> {
  if (typeof input !== 'string') {
    throw new InvalidDidError(typeof input, `DID must be a string`)
  }

  if (!input.startsWith(DID_PLC_PREFIX)) {
    throw new InvalidDidError(input, `Invalid did:plc prefix`)
  }

  if (input.length !== DID_PLC_LENGTH) {
    throw new InvalidDidError(
      input,
      `did:plc must be ${DID_PLC_LENGTH} characters long`,
    )
  }

  // The following check is not necessary, as the check below is more strict:

  // assertDidMsid(input, DID_PLC_PREFIX.length)

  for (let i = DID_PLC_PREFIX_LENGTH; i < DID_PLC_LENGTH; i++) {
    if (!isBase32Char(input.charCodeAt(i))) {
      throw new InvalidDidError(input, `Invalid character at position ${i}`)
    }
  }
}

const isBase32Char = (c: number): boolean =>
  (c >= 0x61 && c <= 0x7a) || (c >= 0x32 && c <= 0x37) // [a-z2-7]
