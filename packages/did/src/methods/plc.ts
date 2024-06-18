import { InvalidDidError } from '../did-error.js'
import { Did } from '../did.js'

const DID_PLC_PREFIX = `did:plc:`
const DID_PLC_PREFIX_LENGTH = DID_PLC_PREFIX.length
const DID_PLC_LENGTH = 32

export { DID_PLC_PREFIX }

export function isDidPlc(input: unknown): input is Did<'plc'> {
  if (typeof input !== 'string') return false
  try {
    checkDidPlc(input)
    return true
  } catch {
    return false
  }
}

export function checkDidPlc(input: string): asserts input is Did<'plc'> {
  if (input.length !== DID_PLC_LENGTH) {
    throw new InvalidDidError(
      input,
      `did:plc must be ${DID_PLC_LENGTH} characters long`,
    )
  }

  if (!input.startsWith(DID_PLC_PREFIX)) {
    throw new InvalidDidError(input, `Invalid did:plc prefix`)
  }

  let c: number
  for (let i = DID_PLC_PREFIX_LENGTH; i < DID_PLC_LENGTH; i++) {
    c = input.charCodeAt(i)
    // Base32 encoding ([a-z2-7])
    if ((c < 0x61 || c > 0x7a) && (c < 0x32 || c > 0x37)) {
      throw new InvalidDidError(input, `Invalid character at position ${i}`)
    }
  }
}
