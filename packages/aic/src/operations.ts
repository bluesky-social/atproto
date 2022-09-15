import * as cbor from '@ipld/dag-cbor'
import * as uint8arrays from 'uint8arrays'
import { DidableKey, sha256 } from '@adxp/crypto'
import {
  CreateOp,
  Operation,
  UnsignedCreateOp,
  UnsignedOperation,
  UnsignedRotateRecoveryKeyOp,
  UnsignedRotateSigningKeyOp,
  UnsignedUpdateServiceOp,
  UnsignedUpdateUsernameOp,
} from './types'

export const didForCreateOp = async (op: CreateOp, truncate = 24) => {
  const hashOfGenesis = await sha256(cbor.encode(op))
  const hashB32 = uint8arrays.toString(hashOfGenesis, 'base32')
  const truncated = hashB32.slice(0, truncate)
  return `did:aic:${truncated}`
}

export const signOperation = async (
  op: UnsignedOperation,
  signingKey: DidableKey,
): Promise<Operation> => {
  const data = new Uint8Array(cbor.encode(op))
  console.log('SIGNING: ', data)
  const sig = await signingKey.sign(data)
  console.log('SIG: ', sig)
  console.log('SIGNING DID: ', signingKey.did())
  return {
    ...op,
    sig: uint8arrays.toString(sig, 'base64url'),
  }
}

export const create = async (
  signingKey: DidableKey,
  recoveryKey: string,
  username: string,
  service: string,
): Promise<Operation> => {
  const op: UnsignedCreateOp = {
    type: 'create',
    signingKey: signingKey.did(),
    recoveryKey,
    username,
    service,
    prev: null,
  }
  return signOperation(op, signingKey)
}

export const rotateSigningKey = async (
  newKey: string,
  prev: string,
  signingKey: DidableKey,
): Promise<Operation> => {
  const op: UnsignedRotateSigningKeyOp = {
    type: 'rotate_signing_key',
    key: newKey,
    prev,
  }
  return signOperation(op, signingKey)
}

export const rotateRecoveryKey = async (
  newKey: string,
  prev: string,
  signingKey: DidableKey,
): Promise<Operation> => {
  const op: UnsignedRotateRecoveryKeyOp = {
    type: 'rotate_recovery_key',
    key: newKey,
    prev,
  }
  return signOperation(op, signingKey)
}

export const updateUsername = async (
  username: string,
  prev: string,
  signingKey: DidableKey,
): Promise<Operation> => {
  const op: UnsignedUpdateUsernameOp = {
    type: 'update_username',
    username,
    prev,
  }
  return signOperation(op, signingKey)
}

export const updateService = async (
  service: string,
  prev: string,
  signingKey: DidableKey,
): Promise<Operation> => {
  const op: UnsignedUpdateServiceOp = {
    type: 'update_service',
    service,
    prev,
  }
  return signOperation(op, signingKey)
}
