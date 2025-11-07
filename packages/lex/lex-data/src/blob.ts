import { CID } from './cid.js'
import { asLexLink } from './link.js'
import { isPlainObject } from './object.js'

const TYPE = 'blob'

export type Blob = {
  $type: 'blob'
  mimeType: string
  ref: CID
  size: number
}

export function parseLexBlob(
  input: object & Record<string, unknown>,
): Blob | undefined {
  if (input?.$type !== TYPE) {
    return undefined
  }
  const { mimeType, size, ref } = input
  if (typeof mimeType !== 'string') {
    return undefined
  }
  if (typeof size !== 'number' || size < 0 || !Number.isInteger(size)) {
    return undefined
  }
  if (typeof ref !== 'object' || ref === null) {
    return undefined
  }

  for (const key in input) {
    if (
      key !== '$type' &&
      key !== 'mimeType' &&
      key !== 'ref' &&
      key !== 'size'
    ) {
      return undefined
    }
  }

  const cid = asLexLink(ref)
  if (!cid) return undefined

  return cid === ref
    ? (input as Blob) // Already a Blob
    : { $type: TYPE, mimeType, ref: cid, size }
}

/**
 * Coerce json or Lex into a Blob.
 */
export function asLexBlob(input: unknown): Blob | undefined {
  if (isPlainObject(input)) {
    return parseLexBlob(input)
  }

  return undefined
}
