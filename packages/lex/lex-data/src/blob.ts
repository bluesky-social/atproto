import { code as rawCodecCode } from 'multiformats/codecs/raw'
import { CID, parseLexLink } from './cid.js'

const TYPE = 'blob'

export type Blob = {
  $type: 'blob'
  mimeType: string
  ref: CID
  size: number
}

export function parseLexBlob(input: Record<string, unknown>): Blob {
  if (input.$type !== TYPE) {
    throw new Error(`$type property must be 'blob'`)
  }
  const { mimeType, size } = input
  if (typeof mimeType !== 'string') {
    throw new Error(`mimeType property must be a string`)
  }
  if (typeof size !== 'number' || size < 0 || !Number.isInteger(size)) {
    throw new Error(`size property must be an integer`)
  }
  if (typeof input.ref !== 'object' || input.ref === null) {
    throw new Error(`ref property must be a link object or CID`)
  }

  for (const key in input) {
    // https://atproto.com/specs/data-model
    // > Implementations should ignore unknown $ fields (to allow protocol evolution).
    if (key.codePointAt(0) === 36) {
      // Note that $link, $bytes, and $type are mutually exclusive
      if (key !== '$bytes' && key !== '$link') continue
    }

    if (key !== 'mimeType' && key !== 'ref' && key !== 'size') {
      throw new Error(`Invalid property in $blob object: ${key}`)
    }
  }

  const ref = CID.asCID(input.ref) ?? parseLexLink(input.ref)
  if (ref.code !== rawCodecCode) {
    throw new Error(`Invalid multicodec for blob ref; expected raw codec`)
  }

  return ref === input.ref
    ? (input as Blob) // Already a Blob
    : { $type: TYPE, mimeType, ref, size }
}
