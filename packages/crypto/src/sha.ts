import * as mf from 'multiformats/hashes/sha2'
import * as uint8arrays from 'uint8arrays'
import crypto from 'crypto'
import { Readable } from 'stream'

// takes either bytes of utf8 input
export const sha256 = async (
  input: Uint8Array | string,
): Promise<Uint8Array> => {
  const bytes =
    typeof input === 'string' ? uint8arrays.fromString(input, 'utf8') : input
  const hash = await mf.sha256.digest(bytes)
  return hash.digest
}

export const sha256Stream = async (stream: Readable): Promise<Uint8Array> => {
  const hash = crypto.createHash('sha256')
  try {
    for await (const chunk of stream) {
      hash.write(chunk)
    }
  } catch (err) {
    hash.end()
    throw err
  }
  hash.end()
  return hash.read()
}
