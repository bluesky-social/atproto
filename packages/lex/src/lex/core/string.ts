import { CID } from 'multiformats/cid'

const utf8Decoder = /*#__PURE__*/ new TextDecoder('utf-8', { fatal: false })

export function coerceToString(input: unknown): string | null {
  switch (typeof input) {
    case 'string':
      return input
    case 'object': {
      if (input == null) return null

      if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
        try {
          return utf8Decoder.decode(input)
        } catch {
          return null
        }
      }

      if (input instanceof Date) {
        if (Number.isNaN(input.getTime())) return null
        return input.toISOString()
      }

      if (input instanceof URL) {
        return input.toString()
      }

      if (input instanceof String) {
        return input.valueOf()
      }

      const cid = CID.asCID(input)
      if (cid) return cid.toString()
    }

    // falls through
    default:
      return null
  }
}
