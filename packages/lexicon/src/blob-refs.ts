import { check, schema } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { z } from 'zod'

export const typedJsonBlobRef = z
  .object({
    $type: z.literal('blob'),
    ref: schema.cid,
    mimeType: z.string(),
  })
  .strict()
export type TypedJsonBlobRef = z.infer<typeof typedJsonBlobRef>

export const untypedJsonBlobRef = z
  .object({
    cid: z.string(),
    mimeType: z.string(),
  })
  .strict()
export type UntypedJsonBlobRef = z.infer<typeof untypedJsonBlobRef>

export const jsonBlobRef = z.union([typedJsonBlobRef, untypedJsonBlobRef])
export type JsonBlobRef = z.infer<typeof jsonBlobRef>

export class BlobRef {
  public original: JsonBlobRef

  constructor(public ref: CID, public mimeType: string, json?: JsonBlobRef) {
    this.original = json ?? {
      $type: 'blob',
      ref,
      mimeType,
    }
  }

  static asBlobRef(obj: unknown): BlobRef | null {
    if (check.is(obj, jsonBlobRef)) {
      return BlobRef.fromJsonRef(obj)
    }
    return null
  }

  static fromJsonRef(json: JsonBlobRef): BlobRef {
    if (check.is(json, typedJsonBlobRef)) {
      return new BlobRef(json.ref, json.mimeType)
    } else {
      return new BlobRef(CID.parse(json.cid), json.mimeType, json)
    }
  }

  ipld(): TypedJsonBlobRef {
    return {
      $type: 'blob',
      ref: this.ref,
      mimeType: this.mimeType,
    }
  }
}
