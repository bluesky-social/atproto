import { Keypair, hkdfSha256, hmacSha256, randomBytes } from '@atproto/crypto'
import { SetHash } from './set-hash'
import { SignedCommit, SpaceContext } from './types'

export const createCommit = async (
  setHash: SetHash,
  space: SpaceContext,
  keypair: Keypair,
): Promise<SignedCommit> => {
  const hash = setHash.toBytes()
  const ikm = Buffer.from(randomBytes(32))
  const hmac = deriveKeyAndHmac(ikm, setHash.toBytes(), space)
  const sig = Buffer.from(await keypair.sign(ikm))
  return { hash, hmac, ikm, sig }
}

export const verifyCommit = (
  space: SpaceContext,
  commit: SignedCommit,
): boolean => {
  const expected = deriveKeyAndHmac(commit.ikm, commit.hash, space)
  return expected.equals(commit.hmac)
}

export const deriveKeyAndHmac = (
  ikm: Buffer,
  data: Buffer,
  space: SpaceContext,
): Buffer => {
  const info = encodeCommitInfo(space)
  const derivedKey = hkdfSha256(ikm, info)
  return Buffer.from(hmacSha256(derivedKey, data))
}

// This is modeled after TLS 1.3
// @TODO should we be using varints instead (consistency with CARs)? delimiters (like Signal)?
const DOMAIN_PREFIX = Buffer.from('atproto-space-v1')
const encodeCommitInfo = (space: SpaceContext): Buffer => {
  const fields = [
    space.spaceDid,
    space.spaceType,
    space.spaceKey,
    space.userDid,
    space.rev.toString(),
    space.scope,
  ]
  const parts: Buffer[] = [DOMAIN_PREFIX]
  for (const field of fields) {
    const bytes = Buffer.from(field)
    const len = Buffer.alloc(2)
    len.writeUInt16BE(bytes.length)
    parts.push(len, bytes)
  }
  return Buffer.concat(parts)
}
