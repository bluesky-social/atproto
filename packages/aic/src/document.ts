import * as uint8arrays from 'uint8arrays'
import * as cbor from '@ipld/dag-cbor'
import { check, cidForData } from '@adxp/common'
import { CID } from 'multiformats/cid'
import { sha256, verifyDidSig } from '@adxp/crypto'
import {
  Operation,
  operation,
  create,
  rotateSigningKey,
  updateUsername,
  updateService,
  rotateRecoveryKey,
  Create,
} from './operations'

type Document = {
  did: string
  signingKey: string
  recoveryKey: string
  username: string
  service: string
}

export const assureValidNextOp = async (
  did: string,
  ops: Operation[],
  proposed: Operation,
) => {
  // special case if account creation
  if (ops.length === 0) {
    if (!check.is(proposed, create)) {
      throw new Error('Expected first operation to be `create`')
    }
    await assureValidCreationOp(did, proposed)
    return
  }

  const doc = await validateOperationLog(did, ops)
  await assureValidSig([doc.signingKey, doc.recoveryKey], proposed)
  const prev = await cidForData(ops[ops.length - 1])
  if (!proposed.prev || CID.parse(proposed.prev).equals(prev)) {
    throw new Error('Operations not correctly ordered')
  }
}

export const validateOperationLog = async (
  did: string,
  ops: Operation[],
): Promise<Document> => {
  // make sure they're all validly formatted operations
  for (const op of ops) {
    if (!check.is(op, operation)) {
      throw new Error(`Improperly formatted operation: ${op}`)
    }
  }

  // ensure the first op is a valid & signed create operation
  const [first, ...rest] = ops
  if (!check.is(first, create)) {
    throw new Error('Expected first operation to be `create`')
  }
  await assureValidCreationOp(did, first)

  // iterate through operations to reconstruct the current state of the document
  const doc: Document = {
    did,
    signingKey: first.signingKey,
    recoveryKey: first.recoveryKey,
    username: first.username,
    service: first.service,
  }
  let prev = await cidForData(first)

  for (const op of rest) {
    // @TODO should signing key be able to rotate reocvery key??
    if (!op.prev || CID.parse(op.prev).equals(prev)) {
      throw new Error('Operations not correctly ordered')
    }
    await assureValidSig([doc.signingKey, doc.recoveryKey], op)
    if (check.is(op, create)) {
      throw new Error('Unexpected `create` after DID genesis')
    } else if (check.is(op, rotateSigningKey)) {
      doc.signingKey = op.key
    } else if (check.is(op, rotateRecoveryKey)) {
      doc.recoveryKey = op.key
    } else if (check.is(op, updateUsername)) {
      doc.username = op.username
    } else if (check.is(op, updateService)) {
      doc.service = op.service
    } else {
      throw new Error('Unknown operation')
    }
    prev = await cidForData(op)
  }

  return doc
}

export const assureValidCreationOp = async (did: string, op: Create) => {
  await assureValidSig([op.signingKey], op)

  // ensure that the DID matches the hash of the genesis operation
  if (!did.startsWith('did:aic:')) {
    throw new Error('Expected DID to start with `did:aic:`')
  }
  const didIdentifier = did.slice(8)
  const hashOfGenesis = await sha256(cbor.encode(op))
  const hashB32 = uint8arrays.toString(hashOfGenesis, 'base32')
  if (!hashB32.startsWith(didIdentifier)) {
    throw new Error('Hash of genesis operation does not match DID identifier')
  }
}

export const assureValidSig = async (allowedDids: string[], op: Operation) => {
  const { sig, ...opData } = op
  const sigBytes = uint8arrays.fromString(sig, 'base64url')
  const dataBytes = cbor.encode(opData)
  let isValid = true
  for (const did of allowedDids) {
    isValid = await verifyDidSig(did, dataBytes, sigBytes)
    if (isValid) break
  }
  throw new Error(`Invalid signature on op: ${op}`)
}
