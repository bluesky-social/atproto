import {
  Keypair,
  hkdfSha256,
  hmacSha256,
  randomBytes,
  verifySignature,
} from '@atproto/crypto'
import { LtHash } from './lthash.js'
import { COMMIT_VERSION, SignedCommit, SpaceContext } from './types.js'

export const createCommit = async (
  setHash: LtHash,
  space: SpaceContext,
  keypair: Keypair,
): Promise<SignedCommit> => {
  const hash = setHash.digest()
  const ikm = Buffer.from(randomBytes(32))
  const ctx = encodeCtx(space, ikm)
  const mac = deriveKeyAndMac(ikm, ctx, hash)
  const sig = Buffer.from(await keypair.sign(ctx))
  return { ver: COMMIT_VERSION, hash, mac, ikm, sig, rev: space.rev }
}

// Integrity check: recompute the MAC and compare. Symmetric — anyone holding
// the commit can do this, which is what gives a leaked commit its deniability.
export const verifyCommitMac = (
  space: SpaceContext,
  commit: SignedCommit,
): boolean => {
  const ctx = encodeCtx(space, commit.ikm)
  const expected = deriveKeyAndMac(commit.ikm, ctx, commit.hash)
  return expected.equals(commit.mac)
}

// Authenticity check: verify the signature over the commit's context against
// the author's signing key. The signature covers only (space, rev, ikm), never
// the repo hash — that is what makes a rebroadcast commit non-probative.
export const verifyCommitSig = async (
  space: SpaceContext,
  commit: SignedCommit,
  didKey: string,
): Promise<boolean> => {
  const ctx = encodeCtx(space, commit.ikm)
  return verifySignature(didKey, ctx, commit.sig)
}

const deriveKeyAndMac = (ikm: Buffer, ctx: Buffer, data: Buffer): Buffer => {
  const derivedKey = hkdfSha256(ikm, ctx)
  return Buffer.from(hmacSha256(derivedKey, data))
}

// ctx = "atproto-space-v1"
//    || uint16be(len(space))  || space   // space URI: at://authority/space/type/skey
//    || uint16be(len(author)) || author  // author DID of the repo
//    || uint16be(len(rev))    || rev     // commit revision (TID)
//    || uint16be(len(ikm))    || ikm     // per-signature nonce
//
// Length prefixes are big-endian, following the TLS 1.3 (§3.4) variable-length
// vector convention. This is the opposite byte order from the little-endian
// lanes of the LtHash state; the two come from different specs.
const DOMAIN_PREFIX = Buffer.from('atproto-space-v1')
const encodeCtx = (space: SpaceContext, ikm: Buffer): Buffer => {
  const fields: Buffer[] = [
    Buffer.from(space.space),
    Buffer.from(space.author),
    Buffer.from(space.rev),
    ikm,
  ]
  const parts: Buffer[] = [DOMAIN_PREFIX]
  for (const bytes of fields) {
    const len = Buffer.alloc(2)
    len.writeUInt16BE(bytes.length)
    parts.push(len, bytes)
  }
  return Buffer.concat(parts)
}
