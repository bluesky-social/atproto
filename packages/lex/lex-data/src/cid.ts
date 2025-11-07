import { CID } from 'multiformats/cid'
import { code as rawCodecCode } from 'multiformats/codecs/raw'

export const DAG_CBOR_MULTICODEC = 0x71
export const RAW_BIN_MULTICODEC = rawCodecCode

export const SHA2_256_MULTIHASH_CODE = 0x12

export { CID }

export function isCid(value: unknown): value is CID {
  return CID.asCID(value) !== null
}

export function validateCidString(input: string): boolean {
  return parseCidString(input)?.toString() === input
}

export function parseCidString(input: string): CID | undefined {
  try {
    return CID.parse(input)
  } catch {
    return undefined
  }
}

export function ensureValidCidString(input: string): void {
  if (!validateCidString(input)) {
    throw new Error(`Invalid CID string`)
  }
}
