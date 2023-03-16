import { CID } from 'multiformats/cid'
import { z } from 'zod'
import { check, schema } from '.'

const blobRefType = z.union([
  z.literal('blob'),
  z.literal('image'),
  z.literal('video'),
  z.literal('audio'),
])
type BlobRefType = z.infer<typeof blobRefType>

const typedJsonBlobRef = z.object({
  $type: blobRefType,
  ref: schema.cid,
  mimeType: z.string(),
})
type TypedJsonBlobRef = z.infer<typeof typedJsonBlobRef>

const untypedJsonBlobRef = z.object({
  cid: z.string(),
  mimeType: z.string(),
})
type UntypedJsonBlobRef = z.infer<typeof untypedJsonBlobRef>

const jsonBlobRef = z.union([typedJsonBlobRef, untypedJsonBlobRef])
type JsonBlobRef = z.infer<typeof jsonBlobRef>

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
      return new BlobRef(json, 'blob', CID.parse(json.cid), json.mimeType)
    }
  }

  // get ref(): JsonBlobRef {
  //   return {
  //     $type: this.$type,
  //     ref: {
  //       '/': this.cid.toString(),
  //     },
  //     mimeType: this.mimeType,
  //   }
  // }
}
