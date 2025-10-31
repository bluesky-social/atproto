import { CID } from 'multiformats/cid'
import { isObject, isPlainObject } from '../lib/is-object.js'
import { encodeLexLink, parseLexLink } from './cid.js'
import { Json } from './json.js'

export type JsonBlobRef = TypedJsonBlobRef | UntypedJsonBlobRef

export type TypedJsonBlobRef = {
  $type: 'blob'
  ref: CID
  mimeType: string
  size: number
}

export function parseTypedJsonBlobRef(
  input: unknown,
): TypedJsonBlobRef | undefined {
  if (
    isPlainObject(input) &&
    input.$type === 'blob' &&
    isObject(input.ref) &&
    typeof input.mimeType === 'string' &&
    typeof input.size === 'number' &&
    input.size >= 0 &&
    Number.isInteger(input.size) &&
    Object.keys(input).length === 4
  ) {
    const ref = CID.asCID(input.ref) || parseLexLink(input.ref)

    if (ref === input.ref) {
      // Already a TypedJsonBlobRef (keep input as is)
      return input as TypedJsonBlobRef
    }

    if (ref != null) {
      // Coerce to TypedJsonBlobRef
      return { ...input, ref } as TypedJsonBlobRef
    }
  }

  return undefined
}

export type UntypedJsonBlobRef = {
  cid: string
  mimeType: string
}

export function parseUntypedJsonBlobRef(
  input: unknown,
): UntypedJsonBlobRef | undefined {
  if (
    isPlainObject(input) &&
    typeof input.cid === 'string' &&
    typeof input.mimeType === 'string' &&
    Object.keys(input).length === 2
  ) {
    return input as UntypedJsonBlobRef
  }

  return undefined
}

export class BlobRef {
  constructor(
    public readonly ref: CID,
    public readonly mimeType: string,
    public readonly size: number,
    public readonly original?: JsonBlobRef,
  ) {}

  toJSON(): Json {
    // Keep the original encoding so that we don't change CIDs on re-encode
    const { original } = this
    if (original) {
      if ('ref' in original) {
        const copy = { ...original } as Record<string, unknown>
        copy.ref = encodeLexLink(original.ref)
        return copy as Json
      }

      return original
    }

    return {
      $type: 'blob',
      ref: encodeLexLink(this.ref),
      mimeType: this.mimeType,
      size: this.size,
    }
  }

  static asBlobRef(input: unknown): BlobRef | undefined {
    if (input instanceof BlobRef) {
      return input
    }

    if (isPlainObject(input)) {
      if ('$type' in input) {
        const blobRef = parseTypedJsonBlobRef(input)
        if (blobRef) return BlobRef.fromTypedJsonRef(blobRef)
      } else if ('cid' in input && 'mimeType' in input) {
        const blobRef = parseUntypedJsonBlobRef(input)
        if (blobRef) {
          try {
            return BlobRef.fromUntypedJsonRef(blobRef)
          } catch {
            return undefined
          }
        }
      }
    }

    return undefined
  }

  static fromTypedJsonRef(json: TypedJsonBlobRef): BlobRef {
    return new BlobRef(json.ref, json.mimeType, json.size, json)
  }

  static fromUntypedJsonRef(json: UntypedJsonBlobRef): BlobRef {
    const ref = CID.parse(json.cid) // throws
    return new BlobRef(ref, json.mimeType, -1, json)
  }
}

export function encodeJsonBlobRef(blobRef: BlobRef): Json {
  return blobRef.toJSON()
}
