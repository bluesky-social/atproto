import { Decoder, addExtension } from 'cbor-x/decode'
import { CID } from 'multiformats/cid'

// @NOTE We use "cbor-x" here because it supports decoding multiple CBOR items
// from a single byte array (and because it is fast). We do *NOT* use it for
// encoding because it does not yield DAG-CBOR compliant CBOR.

// add extension for decoding CIDs
addExtension({
  Class: CID,
  tag: 42,
  encode: () => {
    throw new Error('cannot encode cids')
  },
  decode: (bytes: Uint8Array): CID => {
    // @NOTE code taken from @ipld/dag-cbor
    if (bytes[0] !== 0) {
      throw new Error('Invalid CID for CBOR tag 42; expected leading 0x00')
    }
    return CID.decode(bytes.subarray(1)) // ignore leading 0x00
  },
})

const decoder = new Decoder({
  // @ts-expect-error: not in types for some reason
  int64AsNumber: true,
  useRecords: false,
})

export const cborDecodeMulti = (encoded: Uint8Array): unknown[] => {
  return decoder.decodeMultiple(encoded)!
}
