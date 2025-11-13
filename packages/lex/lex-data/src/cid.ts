import { CID } from 'multiformats/cid'
import { code as rawCodecCode } from 'multiformats/codecs/raw'

export const DAG_CBOR_MULTICODEC = 0x71
export const RAW_BIN_MULTICODEC = rawCodecCode

export const SHA2_256_MULTIHASH_CODE = 0x12

export { CID }

export function isCid(
  value: unknown,
  options?: { strict?: boolean },
): value is CID {
  const cid = CID.asCID(value)
  if (!cid) {
    return false
  }

  if (options?.strict) {
    if (cid.version !== 1) {
      return false
    }
    if (cid.code !== RAW_BIN_MULTICODEC && cid.code !== DAG_CBOR_MULTICODEC) {
      return false
    }
    if (cid.multihash.code !== SHA2_256_MULTIHASH_CODE) {
      return false
    }
  }

  return true
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
