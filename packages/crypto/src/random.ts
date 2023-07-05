import * as noble from '@noble/hashes/utils'
import * as uint8arrays from 'uint8arrays'
import { SupportedEncodings } from 'uint8arrays/to-string'
import { sha256 } from './sha'

export const randomBytes = noble.randomBytes

export const randomStr = (
  byteLength: number,
  encoding: SupportedEncodings,
): string => {
  const bytes = randomBytes(byteLength)
  return uint8arrays.toString(bytes, encoding)
}

export const randomIntFromSeed = async (
  seed: string,
  high: number,
  low = 0,
): Promise<number> => {
  const hash = await sha256(seed)
  const number = Buffer.from(hash).readUintBE(0, 6)
  const range = high - low
  const normalized = number % range
  return normalized + low
}
