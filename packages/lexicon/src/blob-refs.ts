import { check, IpldValue, schema } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { z } from 'zod'
import { LexUserType } from './types'

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
    public cid: CID,
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

  get ref(): TypedJsonBlobRef {
    return {
      $type: this.$type,
      ref: this.cid,
      mimeType: this.mimeType,
    }
  }
}

// export type LexValue =
//   | IpldValue
//   | BlobRef
//   | Array<LexValue>
//   | { [key: string]: LexValue }
//   | { [key: number]: LexValue }

export const lexValueToIpld = (val: LexUserType): IpldValue => {
  if (check.is(val, schema.array)) {
    return val.map((item) => lexValueToIpld(item))
  } else if (check.is(val, schema.bytes)) {
    return {
      '/': {
        bytes: base64.encode(val).slice(1), // no mbase prefix (taken from dag-json code)
      },
    }
  } else if (check.is(val, schema.cid)) {
    return {
      '/': val.toString(),
    }
  } else if (check.is(val, schema.record)) {
    const toReturn = {}
    for (const key of Object.keys(val)) {
      toReturn[key] = ipldValueToJson(val[key])
    }
    return toReturn
  } else {
    return val
  }
}

// export const ipldValueToLex = (val: IpldValue): LexValue => {
//   if (check.is(val, schema.array)) {
//     return val.map((item) => ipldValueToLex(item))
//   } else if (check.is(val, schema.record)) {
//     const maybeCid = val['/']
//     if (maybeCid) {
//       if (Object.keys(val).length > 1) {
//         throw new Error()
//       }
//       const maybeBytes = maybeCid['bytes']
//       if (maybeBytes) {
//         if (
//           Object.keys(maybeCid).length > 1 ||
//           typeof maybeBytes !== 'string'
//         ) {
//           console.log('this err')
//           throw new Error()
//         }
//         return base64.decode(`m${maybeBytes}`) // add mbase prefix according to dag-json code
//       }
//       if (typeof maybeCid !== 'string') {
//         throw new Error()
//       }
//       return CID.parse(maybeCid)
//     } else {
//       const toReturn = {}
//       for (const key of Object.keys(val)) {
//         toReturn[key] = jsonToIpldValue(val[key])
//       }
//       return toReturn
//     }
//   } else {
//     return val
//   }
// }
