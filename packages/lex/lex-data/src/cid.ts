import { CID } from 'multiformats/cid'
import { code as rawCodecCode } from 'multiformats/codecs/raw'
import { Json } from './json.js'

// DAG-CBOR multicodec code
export const DAG_CBOR_CODEC = 0x71

export { CID }

export function parseLexLink(input: { $link?: unknown }): CID {
  if (typeof input.$link !== 'string') {
    throw new Error(`$link property must be a string`)
  }

  for (const key in input) {
    // https://atproto.com/specs/data-model
    // > Implementations should ignore unknown $ fields (to allow protocol evolution).
    if (key.codePointAt(0) === 36) {
      // Note that $link, $bytes, and $type are mutually exclusive
      if (key !== '$bytes' && key !== '$type') continue
    }

    throw new Error(`Invalid property in $link object: ${key}`)
  }

  return validateCidFormat(CID.parse(input.$link))
}

export function encodeLexLink(cid: CID): Json {
  return { $link: validateCidFormat(cid).toString() }
}

/**
 * @see {@link https://atproto.com/specs/data-model#link-and-cid-formats CID Format Specification}
 */
export function validateCidFormat(cid: CID): CID {
  if (cid.version !== 1) {
    throw new Error(`CID must be version 1`)
  }
  if (cid.code !== rawCodecCode && cid.code !== DAG_CBOR_CODEC) {
    throw new Error(`CID must use raw or dag-cbor multicodec`)
  }
  return cid
}

export function asCID(value: unknown): CID | null {
  const cid = CID.asCID(value)
  if (cid === null) return null
  try {
    return validateCidFormat(cid)
  } catch {
    return null
  }
}

export function isCid(value: unknown): value is CID {
  return CID.asCID(value) !== null
}

export function validateCidString(input: string): boolean {
  try {
    const cid = validateCidFormat(CID.parse(input))
    return cid.toString() === input
  } catch {
    return false
  }
}

export function ensureValidCidString(input: string): void {
  if (!validateCidString(input)) {
    throw new Error(`Invalid CID string`)
  }
}
