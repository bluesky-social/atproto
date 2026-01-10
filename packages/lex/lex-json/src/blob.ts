import {
  BlobRef,
  BlobRefCheckOptions,
  LexMap,
  isBlobRef,
} from '@atproto/lex-data'
import { parseLexLink } from './link.js'

export function parseBlobRef(
  input: LexMap,
  options?: BlobRefCheckOptions,
): BlobRef | undefined {
  if (input.$type !== 'blob') return undefined

  const ref = input?.ref
  if (!ref || typeof ref !== 'object') return undefined

  // @NOTE Because json to lex conversion can be performed both in a depth-first
  // manner (e.g. via lexParse) or in a breadth-first manner (e.g. via
  // jsonToLex), the `ref` property may either be a LexMap with a $link
  // property, or it may already be a CID instance.

  if ('$link' in ref) {
    const cid = parseLexLink(ref)
    if (!cid) return undefined

    const blob = { ...input, ref: cid }
    if (isBlobRef(blob, options)) return blob
  }

  if (isBlobRef(input)) {
    return input
  }

  return undefined
}
