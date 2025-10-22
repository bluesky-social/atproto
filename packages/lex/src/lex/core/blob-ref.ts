import { CID } from 'multiformats/cid'
import { isPureObject } from '../lib/is-object.js'
import { encodeIpldLink, parseIpldLink } from './ipld.js'
import { Json } from './json.js'

export type JsonBlobRef = TypedJsonBlobRef | UntypedJsonBlobRef

export type TypedJsonBlobRef = {
  $type: 'blob'
  ref: CID
  mimeType: string
  size: number
}

export function parseTypedJsonBlobRef(input: unknown): BlobRef | undefined {
  if (
    isPureObject(input) &&
    input.$type === 'blob' &&
    typeof input.ref === 'object' &&
    typeof input.mimeType === 'string' &&
    typeof input.size === 'number' &&
    input.size >= 0 &&
    Number.isInteger(input.size) &&
    Object.keys(input).length === 4
  ) {
    const ref = CID.asCID(input.ref) || parseIpldLink(input.ref)

    if (ref === input.ref) {
      // Already a TypedJsonBlobRef (keep input as is)
      return BlobRef.fromTypedJsonRef(input as TypedJsonBlobRef)
    }

    if (ref) {
      // Coerce to TypedJsonBlobRef
      return BlobRef.fromTypedJsonRef({ ...input, ref } as TypedJsonBlobRef)
    }
  }

  return undefined
}

export type UntypedJsonBlobRef = {
  cid: string
  mimeType: string
}

export function parseUntypedJsonBlobRef(input: unknown): BlobRef | undefined {
  if (
    isPureObject(input) &&
    typeof input.cid === 'string' &&
    typeof input.mimeType === 'string' &&
    Object.keys(input).length === 2
  ) {
    try {
      return BlobRef.fromUntypedJsonRef(input as UntypedJsonBlobRef)
    } catch {
      return undefined
    }
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
        copy.ref = encodeIpldLink(original.ref)
        return copy as Json
      }

      return original
    }

    return {
      $type: 'blob',
      ref: encodeIpldLink(this.ref),
      mimeType: this.mimeType,
      size: this.size,
    }
  }

  static asBlobRef(input: unknown): BlobRef | null {
    if (!input || typeof input !== 'object') {
      return null
    }

    if (input instanceof BlobRef) {
      return input
    }

    if ('$type' in input) {
      const blobRef = parseTypedJsonBlobRef(input)
      if (blobRef) return blobRef
    } else if ('cid' in input && 'mimeType' in input) {
      const blobRef = parseUntypedJsonBlobRef(input)
      if (blobRef) return blobRef
    }

    return null
  }

  static fromTypedJsonRef(json: TypedJsonBlobRef): BlobRef {
    return new BlobRef(json.ref, json.mimeType, json.size, json)
  }

  static fromUntypedJsonRef(json: UntypedJsonBlobRef): BlobRef {
    return new BlobRef(CID.parse(json.cid), json.mimeType, -1, json)
  }
}

export function encodeJsonBlobRef(blobRef: BlobRef): Json {
  return blobRef.toJSON()
}
