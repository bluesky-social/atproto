import * as cbor from '@ipld/dag-cbor'
import * as uint8arrays from 'uint8arrays'
import { Keypair, sha256 } from '@atproto/crypto'
import * as t from './types'
import { check } from '@atproto/common'

export const didForCreateOp = async (op: t.CompatibleOp, truncate = 24) => {
  const hashOfGenesis = await sha256(cbor.encode(op))
  const hashB32 = uint8arrays.toString(hashOfGenesis, 'base32')
  const truncated = hashB32.slice(0, truncate)
  return `did:plc:${truncated}`
}

export const signOperation = async (
  op: t.UnsignedOperation,
  signingKey: Keypair,
): Promise<t.Operation> => {
  const data = new Uint8Array(cbor.encode(op))
  const sig = await signingKey.sign(data)
  return {
    ...op,
    sig: uint8arrays.toString(sig, 'base64url'),
  }
}

export const normalizeCreateOp = (op: t.CompatibleOp): t.Operation => {
  if (check.is(op, t.def.operation)) {
    return op
  }
  return {
    signingKey: op.signingKey,
    rotationKeys: [op.signingKey, op.recoveryKey],
    handles: [op.handle],
    services: {
      atpPds: op.service,
    },
    prev: op.prev,
    sig: op.sig,
  }
}
