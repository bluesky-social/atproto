declare module 'varint' {
  interface Decode {
    (buf: Uint8Array, offset?: number): number
    bytes: number
  }

  const varint: {
    encode(num: number): number[]
    decode: Decode
    encodingLength(num: number): number
  }

  export default varint
}
