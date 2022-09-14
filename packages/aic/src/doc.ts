import * as uint8arrays from 'uint8arrays'
import * as cbor from '@ipld/dag-cbor'
import { check } from '@adxp/common'
import { sha256, verifyDidSig } from '@adxp/crypto'
import {
  Operation,
  operation,
  create,
  rotateSigningKey,
  updateUsername,
  updateService,
  rotateRecoveryKey,
} from './operations'

type Document = {
  did: string
  signingKey: string
  recoveryKey: string
  username: string
  service: string
}

export const validateOperations = async (
  did: string,
  ops: Operation[],
): Promise<Document> => {
  for (const op of ops) {
    if (!check.is(op, operation)) {
      throw new Error(`Improperly formatted operation: ${op}`)
    }
  }
  for (const i in ops) {
    if (ops[i].num !== i) {
      throw new Error(`Misordered operation at index ${i}: ${ops[i]}`)
    }
  }

  const [first, ...rest] = ops
  if (!check.is(first, create)) {
    throw new Error('Expected first operation to be `create`')
  }
  await assureValidSig([first.signingKey], first)

  if (!did.startsWith('did:aic:')) {
    throw new Error('Expected DID to start with `did:aic:`')
  }

  const didIdentifier = did.slice(8)
  const hashOfGenesis = await sha256(cbor.encode(first))
  const hashB32 = uint8arrays.toString(hashOfGenesis, 'base32')
  if (!hashB32.startsWith(didIdentifier)) {
    throw new Error('Hash of genesis operation does not match DID identifier')
  }

  const doc: Document = {
    did,
    signingKey: first.signingKey,
    recoveryKey: first.recoveryKey,
    username: first.username,
    service: first.service,
  }

  for (const op of rest) {
    // @TODO should signing key be able to rotate reocvery key??
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
  }

  return doc
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
