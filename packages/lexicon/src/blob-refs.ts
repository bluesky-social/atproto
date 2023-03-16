import {
  check,
  IpldValue,
  jsonToIpldValue,
  JsonValue,
  schema,
} from '@atproto/common'
import { CID } from 'multiformats/cid'
import { z } from 'zod'

export const blobRefType = z.union([
  z.literal('blob'),
  z.literal('image'),
  z.literal('video'),
  z.literal('audio'),
])
export type BlobRefType = z.infer<typeof blobRefType>

export const typedJsonBlobRef = z
  .object({
    $type: blobRefType,
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
  constructor(
    public json: JsonBlobRef,
    public $type: BlobRefType,
    public ref: CID,
    public mimeType: string,
  ) {}

  static asBlobRef(obj: unknown): BlobRef | null {
    if (check.is(obj, jsonBlobRef)) {
      return BlobRef.fromJsonRef(obj)
    }
    return null
  }

  static fromJsonRef(json: JsonBlobRef): BlobRef {
    if (check.is(json, typedJsonBlobRef)) {
      return new BlobRef(json, json.$type, json.ref, json.mimeType)
    } else {
      return new BlobRef(
        json,
        mimeToBlobRefType(json.mimeType),
        CID.parse(json.cid),
        json.mimeType,
      )
    }
  }

  ipld(): TypedJsonBlobRef {
    return {
      $type: this.$type,
      ref: this.ref,
      mimeType: this.mimeType,
    }
  }
}

export const mimeToBlobRefType = (mime: string): BlobRefType => {
  switch (mime.split('/')[0]) {
    case 'image':
      return 'image'
    case 'video':
      return 'video'
    case 'audio':
      return 'audio'
  }
  return 'blob'
}
