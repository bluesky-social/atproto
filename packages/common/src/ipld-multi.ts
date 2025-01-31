import * as cborx from 'cbor-x'
import { CID } from 'multiformats/cid'

// add extension for decoding CIDs
// decoding code taken from @ipld/dag-cbor
// does not support encoding cids
cborx.addExtension({
  Class: CID,
  tag: 42,
  encode: () => {
    throw new Error('cannot encode cids')
  },
  decode: (bytes: Uint8Array): CID => {
    if (bytes[0] !== 0) {
      throw new Error('Invalid CID for CBOR tag 42; expected leading 0x00')
    }
    return CID.decode(bytes.subarray(1)) // ignore leading 0x00
  },
})

const decoder = new cborx.Decoder({
  // @ts-ignore
  int64AsNumber: true, // not in types for some reason
  useRecords: false,
})

export const cborDecodeMulti = (encoded: Uint8Array): unknown[] => {
  const decoded: unknown[] = []
  decoder.decodeMultiple(encoded, (value) => {
    decoded.push(value)
  })
  return decoded
}
