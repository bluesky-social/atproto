import * as uint8arrays from 'uint8arrays'
import * as cbor from '@ipld/dag-cbor'
import { check } from '@adxp/common'
import { verifyDidSig } from '@adxp/crypto'
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
  signingKey: string
  recoveryKey: string
  username: string
  service: string
}

export const validateOperations = async (
  ops: Operation[],
): Promise<Document> => {
  for (const op of ops) {
    if (!check.is(op, operation)) {
      throw new Error(`Improperly formatted operation: ${op}`)
    }
  }

  const [first, ...rest] = ops
  if (!check.is(first, create)) {
    throw new Error('Expected first operation to be `create`')
  }
  await assureValidSig([first.signingKey], first)

  const doc: Document = {
    signingKey: first.signingKey,
    recoveryKey: first.recoveryKey,
    username: first.username,
    service: first.service,
  }

  for (const op of rest) {
    if (check.is(op, create)) {
      throw new Error('Unexpected `create` after DID genesis')
    }
    // @TODO should signing key be able to rotate reocvery key??
    await assureValidSig([doc.signingKey, doc.recoveryKey], op)
    if (check.is(op, rotateSigningKey)) {
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
