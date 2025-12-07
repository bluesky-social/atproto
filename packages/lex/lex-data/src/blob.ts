import {
  Cid,
  RAW_BIN_MULTICODEC,
  SHA2_256_MULTIHASH_CODE,
  asCid,
  parseCid,
} from './cid.js'
import { isPlainObject } from './object.js'

export type BlobRef = {
  $type: 'blob'
  mimeType: string
  ref: Cid
  size: number
}

export function isBlobRef(
  input: unknown,
  options?: { strict?: boolean },
): input is BlobRef {
  if (!isPlainObject(input)) {
    return false
  }

  if (input?.$type !== 'blob') {
    return false
  }

  const { mimeType, size, ref } = input
  // @NOTE Very basic mime validation
  if (typeof mimeType !== 'string' || !mimeType.includes('/')) {
    return false
  }

  if (typeof size !== 'number' || size < 0 || !Number.isInteger(size)) {
    return false
  }

  if (typeof ref !== 'object' || ref === null) {
    return false
  }

  for (const key in input) {
    if (
      key !== '$type' &&
      key !== 'mimeType' &&
      key !== 'ref' &&
      key !== 'size'
    ) {
      return false
    }
  }

  const cid = asCid(ref)
  if (!cid) {
    return false
  }

  if (options?.strict) {
    if (cid.version !== 1) {
      return false
    }
    if (cid.code !== RAW_BIN_MULTICODEC) {
      return false
    }
    if (cid.multihash.code !== SHA2_256_MULTIHASH_CODE) {
      return false
    }
  }

  return true
}

export type LegacyBlobRef = {
  cid: string
  mimeType: string
}

export function isLegacyBlobRef(input: unknown): input is LegacyBlobRef {
  if (!isPlainObject(input)) {
    return false
  }

  const { cid, mimeType } = input
  if (typeof cid !== 'string') {
    return false
  }

  if (typeof mimeType !== 'string') {
    return false
  }

  for (const key in input) {
    if (key !== 'cid' && key !== 'mimeType') {
      return false
    }
  }

  try {
    parseCid(cid)
  } catch {
    return false
  }

  return true
}
